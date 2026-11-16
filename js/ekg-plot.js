/**
 * EKG real-time plotter using Plotly.
 *
 * - Uses Plotly.react() instead of Plotly.newPlot() for updates.
 *   react() reuses the existing chart; newPlot() destroys and recreates
 *   the entire DOM element every frame, causing lag and flicker.
 * - X values come from sample index times an estimated sample period,
 *   not arrival time. Serial data arrives in bursts of several lines,
 *   so arrival timestamps would bunch samples into vertical clusters.
 * - The y-range follows the data but shrinks slowly, so the trace does
 *   not jump each time a spike scrolls out of the window.
 */

class EkgPlot {
  constructor(elementId, windowLength = 500) {
    this.elementId = elementId;
    this.windowLength = windowLength;
    this.intervalId = null;
    this._clear();

    this.plotData = [{
      x: [],
      y: this.yData,
      type: "scatter",
      mode: "lines",
      line: { color: "#d63384", width: 1.5 },
    }];

    this.layout = {
      title: "EKG Signal Plot",
      xaxis: { title: "Time (ms)", fixedrange: true },
      yaxis: { title: "Amplitude", fixedrange: true },
      margin: { t: 40, r: 20, b: 50, l: 50 },
    };
  }

  init() {
    Plotly.newPlot(this.elementId, this.plotData, this.layout, {
      responsive: true,
    });
  }

  // value may be null for a leads-off sample: it keeps time but leaves
  // a gap in the trace.
  addSample(value) {
    const now = performance.now();
    if (!this.started) {
      this.started = true;
      this.firstArrival = now;
      this._startUpdateLoop();
    }
    this.lastArrival = now;

    this.indices.push(this.sampleCount++);
    this.yData.push(value);

    // Rolling window: drop oldest samples beyond the window length
    while (this.indices.length > this.windowLength) {
      this.indices.shift();
      this.yData.shift();
    }
  }

  _periodMs() {
    if (this.sampleCount < 2) return 0;
    return (this.lastArrival - this.firstArrival) / (this.sampleCount - 1);
  }

  _updateYRange() {
    let min = Infinity;
    let max = -Infinity;
    for (const y of this.yData) {
      if (y === null) continue;
      if (y < min) min = y;
      if (y > max) max = y;
    }
    if (min === Infinity) return;

    const pad = Math.max((max - min) * 0.1, 1);
    const target = [min - pad, max + pad];

    if (!this.yRange) {
      this.yRange = target;
    } else {
      // Expand immediately, shrink gradually.
      const [lo, hi] = this.yRange;
      this.yRange = [
        target[0] < lo ? target[0] : lo + (target[0] - lo) * 0.05,
        target[1] > hi ? target[1] : hi + (target[1] - hi) * 0.05,
      ];
    }
    this.layout.yaxis.range = this.yRange;
    this.layout.yaxis.autorange = false;
  }

  _render() {
    const period = this._periodMs();
    this.plotData[0].x = this.indices.map((i) => i * period);
    this.plotData[0].y = this.yData;
    this._updateYRange();
    // Bump datarevision so Plotly.react redraws even when the arrays
    // are the same objects.
    this.layout.datarevision = (this.layout.datarevision || 0) + 1;
    Plotly.react(this.elementId, this.plotData, this.layout);
  }

  _startUpdateLoop() {
    this.intervalId = setInterval(() => this._render(), 60);
  }

  _stopUpdateLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  _clear() {
    this.indices = [];
    this.yData = [];
    this.sampleCount = 0;
    this.firstArrival = 0;
    this.lastArrival = 0;
    this.yRange = null;
    this.started = false;
  }

  reset() {
    this._stopUpdateLoop();
    this._clear();
    this.plotData[0].x = [];
    this.plotData[0].y = this.yData;
    delete this.layout.yaxis.range;
    this.layout.yaxis.autorange = true;
    this.layout.datarevision = (this.layout.datarevision || 0) + 1;
    Plotly.react(this.elementId, this.plotData, this.layout);
  }

  destroy() {
    this._stopUpdateLoop();
  }
}
