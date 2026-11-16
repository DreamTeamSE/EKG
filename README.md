# EKG Web Monitor

This website shows your heartbeat live in a web browser.

You stick three electrodes on your body. They connect to a small heart sensor
wired to an Arduino. When you plug the Arduino into a laptop and open this
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
- **An Arduino**, such as an Uno, and a USB cable.
- **An AD8232 heart-rate sensor board** with its three-electrode cable.
- **Electrode pads.**

## Hardware setup

### 1. Wire the sensor to the Arduino

| AD8232 pin | Arduino pin |
| --- | --- |
| GND | GND |
| 3.3v | 3.3V |
| OUTPUT | A0 |
| LO- | 11 |
| LO+ | 10 |

### 2. Upload the sketch

Open the Arduino IDE, paste this sketch and upload it to the board:

```cpp
void setup() {
  Serial.begin(9600);
  pinMode(10, INPUT); // LO+
  pinMode(11, INPUT); // LO-
}

void loop() {
  if (digitalRead(10) == 1 || digitalRead(11) == 1) {
    Serial.println('!');            // an electrode is off
  } else {
    Serial.println(analogRead(A0)); // heart signal, 0–1023
  }
  delay(1);
}
```

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
2. Click **Open**. Chrome asks which device to use. Choose the Arduino, which
   is often listed as "USB Serial" or "Arduino Uno".
3. The heartbeat starts scrolling within a second.
4. Click **Close** when you're done.

### What the banner means

| Banner | Meaning | What to do |
| --- | --- | --- |
| 🟢 Connected — reading data | Everything is working. | Nothing. |
| 🟡 Leads disconnected | An electrode is loose or off. | Check the pads and the cable. |
| 🟡 No data from the Arduino | The port is open, but the data is unreadable. | Make sure the board runs the sketch above at 9600 baud. |
| 🟡 Device disconnected | The USB cable was unplugged. | Plug it back in and click **Open**. |
| 🟡 Could not open the serial port | Another program is using the port. | Close the Arduino IDE Serial Monitor, then click **Open** again. |

---

## How it works

The site is plain HTML and JavaScript. It has no server and no build step.
Everything runs in the browser.

```
Electrodes → AD8232 → Arduino ──USB──▶ Browser (Web Serial API)
                                          │
                                   SerialHandler   reads text lines and turns them into numbers
                                          │
                                      EkgPlot      keeps the last 500 samples and draws them
                                          │
                                       Plotly      renders the chart
```

### 1. The Arduino sends one reading per line

The AD8232 turns the heart's tiny electrical signal into a voltage. The
Arduino reads that voltage hundreds of times a second and sends each reading
over USB as a line of text: a number from 0 to 1023. When an electrode comes
off, the sensor's LO+ and LO- pins detect it, and the Arduino sends `!`
instead of a number.

### 2. The browser reads the USB data

When you click **Open**, the page uses Chrome's
[Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
to connect to the Arduino at 9600 baud. `SerialHandler` (`js/serial.js`)
then reads the incoming data:

- **Splitting lines.** USB delivers data in chunks, and a chunk can end
  partway through a line. The handler keeps a buffer and processes only
  complete lines. It drops the first line after connecting, because the
  connection may start mid-line.
- **Readings.** Each number is passed to the plot.
- **Leads-off lines.** A `!` line switches the banner to "Leads disconnected"
  and leaves a gap in the trace.
- **Disconnects.** If the cable is unplugged, the handler notices that the
  connection ended and resets the page.

### 3. The page draws the chart

`EkgPlot` (`js/ekg-plot.js`) keeps the latest 500 samples, a few seconds of
signal. About 16 times a second, it redraws the chart with
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
the Arduino". The usual causes are a wrong baud rate or a different sketch.

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

To change the serial settings, edit `baudRate` in `js/serial.js`. It must
match the `Serial.begin(...)` value in the Arduino sketch.
