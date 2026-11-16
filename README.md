# EKG Web Monitor

This website shows your heartbeat live in a web browser.

You stick three electrodes on your body. They connect to a small heart sensor
on the team's circuit board, next to a NodeMCU microcontroller. When you plug
the NodeMCU into a laptop and open this website, your heartbeat appears as a
scrolling line, like a hospital heart monitor. The UF Dream Team Engineering
EKG Team built it as a low-cost teaching tool for showing how an EKG works.

**Try it:** https://dreamteamse.github.io/EKG/

No hardware? Open the monitor page and click **Demo Mode** to see a
simulated heartbeat.

---

## What you need

- **A laptop with Chrome or Edge.** Other browsers can't talk to USB devices
  from a web page. Phones and tablets don't work.
- **The EKG board**, with these two parts:
  - a **NodeMCU 1.0 (ESP-12E)**, an ESP8266 board
  - a **SparkFun AD8232 heart rate monitor** (SEN-12650)
- **A micro-USB cable that carries data.** Some cables only carry power.
- **The three-electrode cable and electrode pads.**

## Hardware setup

### 1. Wiring

The PCB already connects the parts like this:

| AD8232 pin | NodeMCU pin |
| --- | --- |
| GND | GND |
| 3.3v | 3V3 |
| OUTPUT | A0 |
| LO- | D1 |
| LO+ | D2 |
| SDN | 3V3 (**jumper wire needed**, see below) |

> **Connect SDN to 3.3V.** SDN is the sensor's shutdown pin. If it's left
> unconnected, the AD8232 stays switched off. A0 then reads about 0, and
> the electrodes have no effect. The first PCB revision doesn't connect SDN,
> so solder a jumper wire from the AD8232's SDN pin to its 3.3v pin. The next
> revision should route SDN to 3V3.

Once SDN is connected, the red LED on the AD8232 board flashes with each
heartbeat when the electrodes are on. That's a quick check that the sensor
works, independent of the code and the website.

### 2. Upload the sketch

The sketch is in [`firmware/ekg_nodemcu/ekg_nodemcu.ino`](firmware/ekg_nodemcu/ekg_nodemcu.ino).

1. In the Arduino IDE, open **File → Preferences** and add this to
   **Additional boards manager URLs**:
   `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
2. Open **Tools → Board → Boards Manager** and install **esp8266** by ESP8266
   Community.
3. Select **Tools → Board → NodeMCU 1.0 (ESP-12E Module)** and choose the
   board's port.
4. Open `ekg_nodemcu.ino` and click **Upload**.

The sketch sends one reading per line at **115200 baud**, about 250 times a
second. When an electrode is off, it sends `!` instead.

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
2. Check that the baud dropdown says **115200**, which matches the sketch.
3. Click **Open**. Chrome asks which device to use. Choose the NodeMCU, which
   is usually listed as "CP2102" or "USB-SERIAL CH340", depending on the
   board's USB chip.
4. The heartbeat starts scrolling within a second or two. The NodeMCU may
   restart when the port opens; that's normal.
5. Click **Close** when you're done.

### What the banner means

| Banner | Meaning | What to do |
| --- | --- | --- |
| 🟢 Connected — reading data | Everything is working. | Nothing. |
| 🟡 Leads disconnected | An electrode is loose or off. | Use sticky gel pads on all three leads (bare snaps held in fingers usually trip this), and push the cable fully into the sensor's jack. |
| 🟡 No data from the board | The port is open, but the data is unreadable. | Match the baud dropdown to the sketch, and make sure the sketch is uploaded. |
| 🟡 Device disconnected | The USB cable was unplugged. | Plug it back in and click **Open**. |
| 🟡 Could not open the serial port | Another program is using the port. | Close the Arduino IDE Serial Monitor, then click **Open** again. |

### If the NodeMCU doesn't appear in the device list

- **Driver.** Install the driver for the board's USB chip, either
  [CP210x](https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers)
  or [CH340](https://www.wch-ic.com/downloads/CH341SER_EXE.html). The chip's
  name is printed on the board, next to the USB port.
- **Cable.** Try another USB cable. Charge-only cables are common.

---

## How it works

The site is plain HTML and JavaScript. It has no server and no build step.
Everything runs in the browser.

```
Electrodes → AD8232 → NodeMCU ──USB──▶ Browser (Web Serial API)
                                          │
                                   SerialHandler   reads text lines and turns them into numbers
                                          │
                                      EkgPlot      keeps the last 4 seconds and draws them
                                          │
                                       Plotly      renders the chart
```

### 1. The NodeMCU sends one reading per line

The AD8232 turns the heart's tiny electrical signal into a voltage. The
NodeMCU reads that voltage on A0 about 250 times a second and sends each
reading over USB as a line of text: a number from 0 to 1023. When an
electrode comes off, the AD8232 raises LO+ or LO-, and the NodeMCU sends `!`
instead of a number. The sketch turns Wi-Fi off, because the radio adds
noise to A0 readings.

### 2. The browser reads the USB data

When you click **Open**, the page uses Chrome's
[Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
to connect to the board at the baud rate chosen in the dropdown.
`SerialHandler` (`js/serial.js`) then reads the incoming data:

- **Board reset.** The NodeMCU uses two of the USB control lines (DTR and
  RTS) to reset itself. After opening the port, the handler releases both
  lines so the board runs its sketch normally.
- **Splitting lines.** USB delivers data in chunks, and a chunk can end
  partway through a line. The handler keeps a buffer and processes only
  complete lines. It drops the first line after connecting, because the
  connection may start mid-line.
- **Readings.** Only lines that are exactly a number count as readings. This
  skips the boot messages the NodeMCU prints when it starts. Each reading is
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
  scrolls off. It's never shorter than 200 units, so a dead or disconnected
  sensor shows as a flat line instead of magnified noise.
- **Zoom.** Zoom is turned off, so a stray click or drag can't freeze the
  view.

### 4. The page watches for problems

While connected, the page checks every half second when the last valid line
arrived. If nothing readable arrives for 3 seconds, it shows "No data from
the board". The usual causes are a wrong baud rate or a missing sketch.

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
| `firmware/ekg_nodemcu/` | Arduino sketch for the NodeMCU |
| `assets/` | Images and icons |
| `vendor/` | Plotly 2.35.2, Bootstrap 5.3.3 and Bootstrap Icons 1.11.3 |

## Branches and deployment

- `ekg-v2`: the current version. GitHub Pages publishes this branch, so a
  push here updates the live site within a minute or two.
- `main`: the earlier version, kept for reference.

If you change the sketch's baud rate, pick the same rate in the monitor's
dropdown. To add a rate to the dropdown, add an `<option>` to `#baudSelect`
in `ekg/index.html`.
