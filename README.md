# EKG Web Monitor

This website shows your heartbeat live in a web browser.

You stick three electrodes on your body. They connect to a small heart sensor
wired to an ESP32 board. When you plug the ESP32 into a laptop and open this
website, your heartbeat appears as a scrolling line, like a hospital heart
monitor. The UF Dream Team Engineering EKG Team built it as a low-cost
teaching tool for showing how an EKG works.

**Try it:** https://dreamteamse.github.io/EKG/

No hardware? Open the monitor page and click **Demo Mode** to see a
simulated heartbeat.

---

## What you need

- **A laptop with Chrome or Edge.** Other browsers can't talk to USB devices
  from a web page. Phones and tablets don't work.
- **An ESP32 development board**, such as an ESP32 DevKit, and a USB cable
  that carries data. Some cables only carry power.
- **An AD8232 heart-rate sensor board** with its three-electrode cable.
- **Electrode pads.**

## Hardware setup

### 1. Wire the sensor to the ESP32

| AD8232 pin | ESP32 pin |
| --- | --- |
| GND | GND |
| 3.3v | 3V3 |
| OUTPUT | GPIO 34 |
| LO+ | GPIO 32 |
| LO- | GPIO 33 |

Notes on pin choice:
- Use an ADC1 pin (GPIO 32–39) for OUTPUT. ADC2 pins stop working when
  Wi-Fi is on.
- Don't use GPIO 6–11. They're connected to the board's flash memory.
- Power the AD8232 from **3V3, not 5V**.

### 2. Upload the sketch

1. In the Arduino IDE, install the **esp32** board package by Espressif
   (Tools → Board → Boards Manager).
2. Select your board, for example **ESP32 Dev Module**.
3. Paste this sketch and upload it:

```cpp
const int ECG_PIN  = 34; // AD8232 OUTPUT
const int LO_PLUS  = 32; // AD8232 LO+
const int LO_MINUS = 33; // AD8232 LO-

void setup() {
  Serial.begin(115200);
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_MINUS, INPUT);
}

void loop() {
  if (digitalRead(LO_PLUS) == HIGH || digitalRead(LO_MINUS) == HIGH) {
    Serial.println('!');                 // an electrode is off
  } else {
    Serial.println(analogRead(ECG_PIN)); // heart signal, 0–4095
  }
  delay(4); // about 250 samples per second
}
```

If you wired different pins, change the three numbers at the top of the
sketch.

After uploading, **close the Serial Monitor and Serial Plotter** in the
Arduino IDE. Only one program can use the USB port at a time.

### 3. Place the electrodes

| Electrode | Placement |
| --- | --- |
| 🔴 Red | Right arm |
| 🟢 Green | Left arm |
| 🟡 Yellow | Leg |

Sit still while recording. Movement and talking add noise to the signal.

## Using the monitor

1. Open https://dreamteamse.github.io/EKG/ and click **View** on the EKG Team
   card.
2. Check that the baud dropdown matches `Serial.begin(...)` in the sketch.
   The sketch above uses **115200**.
3. Click **Open**. Chrome asks which device to use. Choose the ESP32, which
   is usually listed as "CP210x" or "USB-SERIAL CH340", depending on the
   board's USB chip.
4. The heartbeat starts scrolling within a second or two. The ESP32 may
   restart when the port opens; that's normal.
5. Click **Close** when you're done.

### What the banner means

| Banner | Meaning | What to do |
| --- | --- | --- |
| 🟢 Connected — reading data | Everything is working. | Nothing. |
| 🟡 Leads disconnected | An electrode is loose or off. | Check the pads and the cable. |
| 🟡 No data from the board | The port is open, but the data is unreadable. | Match the baud dropdown to the sketch, and make sure the board runs the sketch above. |
| 🟡 Device disconnected | The USB cable was unplugged. | Plug it back in and click **Open**. |
| 🟡 Could not open the serial port | Another program is using the port. | Close the Arduino IDE Serial Monitor, then click **Open** again. |

### If the ESP32 doesn't appear in the device list

- **Driver.** Install the driver for the board's USB chip, either
  [CP210x](https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers)
  or [CH340](https://www.wch-ic.com/downloads/CH341SER_EXE.html). The chip's
  name is printed on the board, next to the USB port.
- **Cable.** Try another USB cable. Charge-only cables are common.
- **Native USB boards.** On an ESP32-S3 or C3 that has no separate USB chip,
  enable **USB CDC On Boot** under the Arduino IDE's Tools menu before
  uploading.

---

## How it works

The site is plain HTML and JavaScript. It has no server and no build step.
Everything runs in the browser.

```
Electrodes → AD8232 → ESP32 ──USB──▶ Browser (Web Serial API)
                                        │
                                 SerialHandler   reads text lines and turns them into numbers
                                        │
                                    EkgPlot      keeps the last 4 seconds and draws them
                                        │
                                     Plotly      renders the chart
```

### 1. The ESP32 sends one reading per line

The AD8232 turns the heart's tiny electrical signal into a voltage. The
ESP32 reads that voltage about 250 times a second and sends each reading
over USB as a line of text: a number from 0 to 4095. When an electrode comes
off, the sensor's LO+ and LO- pins detect it, and the ESP32 sends `!`
instead of a number.

### 2. The browser reads the USB data

When you click **Open**, the page uses Chrome's
[Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
to connect to the board at the baud rate chosen in the dropdown.
`SerialHandler` (`js/serial.js`) then reads the incoming data:

- **Board reset.** ESP32 boards use two of the USB control lines (DTR and
  RTS) to reset themselves. After opening the port, the handler releases
  both lines so the board runs its sketch normally.
- **Splitting lines.** USB delivers data in chunks, and a chunk can end
  partway through a line. The handler keeps a buffer and processes only
  complete lines. It drops the first line after connecting, because the
  connection may start mid-line.
- **Readings.** Only lines that are exactly a number count as readings. This
  skips the boot messages the ESP32 prints when it starts. Each reading is
  passed to the plot.
- **Leads-off lines.** A `!` line switches the banner to "Leads disconnected"
  and leaves a gap in the trace.
- **Disconnects.** If the cable is unplugged, the handler notices that the
  connection ended and resets the page.

### 3. The page draws the chart

`EkgPlot` (`js/ekg-plot.js`) keeps the latest 4 seconds of signal, usually
four or five heartbeats. About 16 times a second, it redraws the chart with
[Plotly](https://plotly.com/javascript/).

- **Time axis.** Readings don't arrive evenly; they come in bursts. So the
  plot doesn't use arrival times. It measures the average rate of incoming
  samples and spaces them evenly on the time axis. This keeps the waveform's
  shape correct.
- **Vertical axis.** The axis grows as soon as the signal needs more room,
  then shrinks slowly. This stops the chart from jumping when a large spike
  scrolls off.
- **Zoom.** Zoom is turned off, so a stray click or drag can't freeze the
  view.

### 4. The page watches for problems

While connected, the page checks every half second when the last valid line
arrived. If nothing readable arrives for 3 seconds, it shows "No data from
the board". The usual causes are a wrong baud rate or a different sketch.

### Demo Mode

Demo Mode builds a fake heartbeat in JavaScript. It adds the P wave, QRS
spike and T wave as smooth bumps, plus a little noise, and feeds the result
through the same plot.

---

## Run it locally

Web Serial works only on `https` pages or `localhost`, so opening the HTML
file directly won't work. Serve the folder instead:

```sh
python -m http.server 8000
```

Then open http://localhost:8000. All libraries are included in `vendor/`, so
the site works without internet.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Home page with the project cards |
| `ekg/index.html` | Monitor page: buttons, status banner, chart and Demo Mode |
| `js/serial.js` | `SerialHandler`: USB connection and line parsing |
| `js/ekg-plot.js` | `EkgPlot`: rolling chart |
| `css/styles.css` | Styles |
| `assets/` | Images and icons |
| `vendor/` | Plotly 2.35.2, Bootstrap 5.3.3 and Bootstrap Icons 1.11.3 |

## Branches and deployment

- `ekg-v2`: the current version. GitHub Pages publishes this branch, so a
  push here updates the live site within a minute or two.
- `main`: the earlier version, kept for reference.

To add a baud rate to the dropdown, add an `<option>` to `#baudSelect` in
`ekg/index.html`.
