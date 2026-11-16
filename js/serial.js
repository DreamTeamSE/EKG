/**
 * Serial port handler for AD8232 EKG sensor via Web Serial API.
 *
 * Expected board output: one value per line at the selected baud rate,
 * e.g. Serial.println(analogRead(34)), or "!" when the leads are off.
 *
 * Callbacks:
 * - onData(value): called per sample; value is null for a leads-off line
 *   so the plot can leave a gap while keeping time.
 * - onLeadsChange(off): called only when the leads-off state flips.
 * - onConnect()
 * - onDisconnect(lost): lost is true when the device went away
 *   (e.g. USB unplugged) rather than the user clicking Close.
 */

class SerialHandler {
  constructor({ baudRate = 115200, onData, onLeadsChange, onConnect, onDisconnect }) {
    this.port = null;
    this.reader = null;
    this.isReading = false;
    this.lineBuffer = "";
    this.discardFirstLine = true;
    this.leadsOff = false;
    this.lastLineTime = 0;

    this.onData = onData;
    this.onLeadsChange = onLeadsChange;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;

    this.baudRate = baudRate;
    this.dataBits = 8;
    this.parity = "none";
    this.stopBits = 1;
  }

  static isSupported() {
    return "serial" in navigator;
  }

  async open() {
    this.port = await navigator.serial.requestPort();

    // If open() fails the port was never opened, so there is nothing to
    // close; let the original error (e.g. port in use) reach the caller.
    await this.port.open({
      baudRate: this.baudRate,
      dataBits: this.dataBits,
      parity: this.parity,
      stopBits: this.stopBits,
    });

    // ESP32 dev boards wire DTR/RTS to their reset and boot pins.
    // Release both so the board runs its sketch instead of being held
    // in reset or bootloader mode.
    try {
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch (err) {
      console.warn("Could not set serial control signals:", err);
    }

    this.isReading = true;
    this.lastLineTime = Date.now();
    if (this.onConnect) this.onConnect();
    this._readLoop();
  }

  async close(lost = false) {
    this.isReading = false;

    const reader = this.reader;
    if (reader) {
      try {
        await reader.cancel();
        reader.releaseLock();
      } catch (err) {
        console.error("Error closing reader:", err);
      } finally {
        this.reader = null;
      }
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (err) {
        console.error("Error closing port:", err);
      } finally {
        this.port = null;
      }
    }

    if (this.onDisconnect) this.onDisconnect(lost);
  }

  msSinceLastLine() {
    return Date.now() - this.lastLineTime;
  }

  async _readLoop() {
    const decoder = new TextDecoder();

    while (this.port && this.port.readable && this.isReading) {
      this.reader = this.port.readable.getReader();

      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;

          this.lineBuffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = this.lineBuffer.indexOf("\n")) !== -1) {
            const line = this.lineBuffer.substring(0, newlineIdx).trim();
            this.lineBuffer = this.lineBuffer.substring(newlineIdx + 1);

            // The port may open mid-line, so the first line can be a
            // fragment (e.g. "23" from "523").
            if (this.discardFirstLine) {
              this.discardFirstLine = false;
              continue;
            }

            this._handleLine(line);
          }
        }
      } catch (err) {
        console.error("Serial read error:", err);
      } finally {
        if (this.reader) this.reader.releaseLock();
        this.reader = null;
      }
    }

    // Loop ended without the user clicking Close: the device was lost.
    if (this.isReading) await this.close(true);
  }

  _handleLine(line) {
    if (line.length === 0) return;

    if (line === "!") {
      this.lastLineTime = Date.now();
      this._setLeadsOff(true);
      if (this.onData) this.onData(null);
      return;
    }

    // Strict match: parseFloat would accept boot-log text like "12abc".
    if (!/^-?\d+(\.\d+)?$/.test(line)) return;
    const value = Number(line);

    this.lastLineTime = Date.now();
    this._setLeadsOff(false);
    if (this.onData) this.onData(value);
  }

  _setLeadsOff(off) {
    if (off === this.leadsOff) return;
    this.leadsOff = off;
    if (this.onLeadsChange) this.onLeadsChange(off);
  }
}
