/**
 * EKG real-time plotter using Plotly.
 *
 * Fixes vs. original:
 * - Uses Plotly.react() instead of Plotly.newPlot() for updates.
 *   react() reuses the existing chart; newPlot() destroys and recreates
 *   the entire DOM element every frame, causing lag and flicker.
 */

class EkgPlot {
  constructor(elementId, windowLength = 500) {
    this.elementId = elementId;
    this.windowLength = windowLength;
    this.xData = [];
    this.yData = [];
    this.startTime = Date.now();
    this.intervalId = null;
    this.started = false;

    this.plotData = [{
      x: this.xData,
      y: this.yData,
      type: "scatter",
      mode: "lines",
      line: { color: "#d63384", width: 1.5 },
    }];

    this.layout = {
      title: "EKG Signal Plot",
      responsive: true,
      xaxis: { title: "Time (ms)" },
      yaxis: { title: "Amplitude" },
      margin: { t: 40, r: 20, b: 50, l: 50 },
    };
  }

  init() {
    Plotly.newPlot(this.elementId, this.plotData, this.layout, {
      responsive: true,
    });
  }

  addSample(value) {
    if (!this.started) {
      this.started = true;
      this.startTime = Date.now();
      this._startUpdateLoop();
    }

    const ts = Date.now() - this.startTime;
    this.xData.push(ts);
    this.yData.push(value);

    // Rolling window: drop oldest samples beyond the window length
    while (this.xData.length > this.windowLength) {
      this.xData.shift();
      this.yData.shift();
    }
  }

  _startUpdateLoop() {
    // FIX: Use Plotly.react() — same signature as newPlot() but
    // efficiently updates the existing chart instead of recreating it.
    this.intervalId = setInterval(() => {
      // Data arrays are mutated in place, so bump datarevision to make
      // Plotly.react see the change.
      this.layout.datarevision = (this.layout.datarevision || 0) + 1;
      Plotly.react(this.elementId, this.plotData, this.layout);
    }, 60);
  }

  reset() {
    this.xData.length = 0;
    this.yData.length = 0;
    this.started = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    Plotly.react(this.elementId, this.plotData, this.layout);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
