# EKG Web Monitor

A browser-based EKG monitor for UF Dream Team Engineering. An Arduino reads an
AD8232 heart-rate sensor and sends readings over USB. The web page plots them
live. It has no backend and no build step.

**Live site:** https://dreamteamse.github.io/EKG/ (served from the `ekg-v2` branch)

## Requirements

- Chrome or Edge on a desktop or laptop. The page uses the Web Serial API,
  which other browsers do not support.
- An Arduino wired to an AD8232 board, connected over USB.

## Arduino sketch

The page expects this output format:

- 9600 baud.
- One reading per line (`Serial.println`).
- A line containing only `!` when the electrodes are off.

This sketch uses the standard SparkFun AD8232 wiring: OUTPUT to A0, LO+ to
pin 10, LO- to pin 11. If your wiring differs, change the pin numbers.

```cpp
void setup() {
  Serial.begin(9600);
  pinMode(10, INPUT); // LO+
  pinMode(11, INPUT); // LO-
}

void loop() {
  if (digitalRead(10) == 1 || digitalRead(11) == 1) {
    Serial.println('!');
  } else {
    Serial.println(analogRead(A0));
  }
  delay(1);
}
```

## Test with the hardware

1. Upload the sketch. Then close the Arduino IDE Serial Monitor and Serial
   Plotter. Only one program can use the port at a time.
2. Open the live site in Chrome or Edge and click **View** on the EKG Team card.
3. Click **Open** and choose the Arduino's port (often "USB Serial" or
   "Arduino Uno").
4. Place the electrodes as the guide on the page shows. The trace should
   start scrolling within a second.

Check these behaviors:

| Action | Expected result |
| --- | --- |
| Remove an electrode | A yellow "Leads disconnected" banner appears and the trace shows a gap. |
| Reattach the electrode | The banner goes back to green "Connected". |
| Unplug the USB cable | A "Device disconnected" banner appears and **Open** works again. |
| Click **Close**, then **Open** | The plot clears and starts fresh. |
| Wrong baud rate or sketch | After 3 seconds, a "No data from the Arduino" banner appears. |

To check the page without hardware, click **Demo Mode**. It plots a simulated
signal.

## Run locally

Web Serial needs `https` or `localhost`, so opening the file directly won't
work. Serve the folder instead:

```sh
python -m http.server 8000
```

Then open http://localhost:8000. All libraries are in `vendor/`, so the page
works offline.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Home page with project cards |
| `ekg/index.html` | Monitor page: controls, status banner, plot, Demo Mode |
| `js/serial.js` | `SerialHandler`: Web Serial connection and line parsing |
| `js/ekg-plot.js` | `EkgPlot`: rolling 500-sample Plotly chart |
| `css/styles.css` | Styles |
| `vendor/` | Plotly 2.35.2, Bootstrap 5.3.3, Bootstrap Icons 1.11.3 |
