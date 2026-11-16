// EKG sketch for the NodeMCU 1.0 (ESP-12E, ESP8266) and the
// SparkFun AD8232 heart rate monitor (SEN-12650).
//
// Sends one reading per line at 115200 baud, or "!" when an electrode
// is off. The web monitor at https://dreamteamse.github.io/EKG/ reads
// this format.
//
// Wiring (matches the team PCB):
//   AD8232 OUTPUT -> A0
//   AD8232 LO+    -> D2
//   AD8232 LO-    -> D1
//   AD8232 3.3v   -> 3V3
//   AD8232 GND    -> GND
//   AD8232 SDN    -> 3V3 (required: if SDN is left unconnected the
//                    sensor stays shut down and A0 reads ~0. The first
//                    PCB revision needs a jumper wire for this.)

#include <ESP8266WiFi.h>

const int LO_PLUS  = D2; // AD8232 LO+
const int LO_MINUS = D1; // AD8232 LO-

void setup() {
  // The radio isn't used. Turning it off reduces noise on A0.
  WiFi.mode(WIFI_OFF);

  Serial.begin(115200);
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_MINUS, INPUT);
}

void loop() {
  if (digitalRead(LO_PLUS) == HIGH || digitalRead(LO_MINUS) == HIGH) {
    Serial.println('!');            // an electrode is off
  } else {
    Serial.println(analogRead(A0)); // heart signal, 0–1023
  }
  delay(4); // about 250 samples per second
}
