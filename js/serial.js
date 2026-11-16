/**
 * Serial port handler for AD8232 EKG sensor via Web Serial API.
 *
 * Fixes vs. original:
 * - Line parsing scans for newlines WITHIN chunks instead of comparing
 *   the entire chunk to "\n" (which almost never matched).
 * - Handles leads-off detection ('!' from Arduino) with a callback.
 */

class SerialHandler {
  constructor({ onData, onLeadsOff, onLeadsOn, onConnect, onDisconnect }) {
    this.port = null;
    this.reader = null;
    this.isReading = false;
    this.lineBuffer = "";

    this.onData = onData;
    this.onLeadsOff = onLeadsOff;
    this.onLeadsOn = onLeadsOn;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;

    this.baudRate = 9600;
    this.dataBits = 8;
    this.parity = "none";
    this.stopBits = 1;
  }

  static isSupported() {
    return "serial" in navigator;
  }

  async open() {
    this.port = await navigator.serial.requestPort();

    try {
      await this.port.open({
        baudRate: this.baudRate,
        dataBits: this.dataBits,
        parity: this.parity,
        stopBits: this.stopBits,
      });
    } catch (err) {
      await this.port.close();
      throw err;
    }

    this.isReading = true;
    if (this.onConnect) this.onConnect();
    this._readLoop();
  }

  async close() {
    this.isReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
        this.reader.releaseLock();
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

    if (this.onDisconnect) this.onDisconnect();
  }

  async _readLoop() {
    if (!this.port) {
      console.error("No serial port available");
      return;
    }

    const decoder = new TextDecoder();

    while (this.port.readable && this.isReading) {
      this.reader = this.port.readable.getReader();

      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;

          // Decode the chunk and append to our line buffer
          const chunk = decoder.decode(value, { stream: true });
          this.lineBuffer += chunk;

          // FIX: Scan for complete lines within the buffer.
          // Arduino sends: " " + value + "\r\n"
          // Split on newline, process each complete line.
          let newlineIdx;
          while ((newlineIdx = this.lineBuffer.indexOf("\n")) !== -1) {
            const line = this.lineBuffer.substring(0, newlineIdx).trim();
            this.lineBuffer = this.lineBuffer.substring(newlineIdx + 1);

            if (line.length === 0) continue;

            // FIX: Handle leads-off detection.
            // Arduino sends '!' when electrodes are disconnected.
            if (line === "!") {
              if (this.onLeadsOff) this.onLeadsOff();
              continue;
            }

            const value = parseFloat(line);
            if (!isNaN(value)) {
              if (this.onLeadsOn) this.onLeadsOn();
              if (this.onData) this.onData(value);
            }
          }
        }
      } catch (err) {
        console.error("Serial read error:", err);
      } finally {
        this.reader.releaseLock();
      }
    }
  }
}
