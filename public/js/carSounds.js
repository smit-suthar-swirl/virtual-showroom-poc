export class CarSounds {
  constructor() {
    this.ctx = null;
    this.activeNodes = [];
    this.masterGain = null;
  }

  ensureContext() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  stop() {
    this.activeNodes.forEach(n => { try { n.stop(); } catch {} });
    this.activeNodes = [];
    try { this.masterGain?.disconnect(); } catch {}
  }

  createNoiseBuffer(duration) {
    const sr = this.ctx.sampleRate, len = sr * duration;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _osc(type, freqRamps, gainRamps, start, stop) {
    const ctx = this.ctx, now = ctx.currentTime, out = this.masterGain;
    const osc = ctx.createOscillator();
    osc.type = type;
    freqRamps.forEach(([t, v, exp]) =>
      exp ? osc.frequency.exponentialRampToValueAtTime(v, now + t) : osc.frequency.setValueAtTime(v, now + t)
    );
    const g = ctx.createGain();
    gainRamps.forEach(([t, v, exp]) =>
      exp ? g.gain.exponentialRampToValueAtTime(v, now + t) : g.gain.linearRampToValueAtTime(v, now + t)
    );
    osc.connect(g).connect(out);
    osc.start(now + start);
    osc.stop(now + stop);
    this.activeNodes.push(osc);
    return osc;
  }

  _noise(duration, filterType, filterFreq, filterQ, gainRamps, start, stop, loop = false) {
    const ctx = this.ctx, now = ctx.currentTime, out = this.masterGain;
    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(duration);
    src.loop = loop;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = filterFreq;
    if (filterQ) f.Q.value = filterQ;
    const g = ctx.createGain();
    gainRamps.forEach(([t, v]) => g.gain.linearRampToValueAtTime(v, now + t));
    src.connect(f).connect(g).connect(out);
    src.start(now + start);
    src.stop(now + stop);
    this.activeNodes.push(src);
  }

  playStartup() {
    this.ensureContext();
    this.stop();
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Electric whine
    this._osc("sine",
      [[0, 180, false], [0.8, 750, true], [1.5, 350, true]],
      [[0, 0.25, false], [1.5, 0.12, false], [2.0, 0, false]], 0, 2.0);
    this._osc("sine",
      [[0, 360, false], [0.8, 1500, true], [1.5, 700, true]],
      [[0, 0.06, false], [1.8, 0, false]], 0, 1.8);

    // Starter crank
    this._noise(1.2, "bandpass", 280, 2.5, (() => {
      const pts = [];
      for (let i = 0; i < 10; i++) { pts.push([0.3 + i * 0.09, 0.22]); pts.push([0.3 + i * 0.09 + 0.045, 0.04]); }
      pts.push([1.2, 0.04], [1.4, 0]);
      return pts;
    })(), 0.3, 1.5);

    // Engine catch
    this._osc("sawtooth",
      [[1.2, 30, false], [1.8, 58, true], [3.5, 26, true], [5.0, 26, false]],
      [[1.2, 0, false], [1.6, 0.28, false], [3.5, 0.14, false], [5.0, 0.1, false], [6.0, 0, false]], 1.2, 6.0);
    this._osc("sine",
      [[1.2, 60, false], [1.8, 116, true], [3.5, 52, true]],
      [[1.2, 0, false], [1.8, 0.1, false], [3.5, 0.05, false], [6.0, 0, false]], 1.2, 6.0);
    this._osc("sine",
      [[1.2, 15, false], [1.8, 29, true], [3.5, 13, true]],
      [[1.2, 0, false], [1.8, 0.15, false], [3.5, 0.08, false], [6.0, 0, false]], 1.2, 6.0);

    // Exhaust pop
    this._noise(0.6, "lowpass", 120, 0,
      [[1.25, 0], [1.35, 0.35], [2.0, 0.01]], 1.25, 2.1);

    // Cabin clicks
    this._osc("square", [[0, 3000, false]],
      [[0, 0, false], [0.05, 0.04, false], [0.08, 0, false], [0.15, 0.03, false], [0.18, 0, false]], 0, 0.2);
  }

  playRunning() {
    this.ensureContext();
    this.stop();
    this.ensureContext();
    const now = this.ctx.currentTime, out = this.masterGain;

    // Base engine with LFO
    const base = this.ctx.createOscillator();
    base.type = "sawtooth";
    base.frequency.setValueAtTime(38, now);
    base.frequency.linearRampToValueAtTime(48, now + 1.0);
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine"; lfo.frequency.value = 0.4;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 4;
    lfo.connect(lfoG).connect(base.frequency);
    lfo.start(now); this.activeNodes.push(lfo);
    const baseLP = this.ctx.createBiquadFilter();
    baseLP.type = "lowpass"; baseLP.frequency.value = 220; baseLP.Q.value = 1.5;
    const baseG = this.ctx.createGain();
    baseG.gain.setValueAtTime(0, now); baseG.gain.linearRampToValueAtTime(0.22, now + 0.8);
    base.connect(baseLP).connect(baseG).connect(out);
    base.start(now); this.activeNodes.push(base);

    // Harmonics
    this._osc("sine", [[0, 96, false]], [[0, 0, false], [0.8, 0.07, false]], 0, 10);
    this._osc("sine", [[0, 192, false]], [[0, 0, false], [0.8, 0.03, false]], 0, 10);

    // Noise layers
    this._noise(12, "bandpass", 80, 1.5, [[0, 0], [1.0, 0.06]], 0, 10, true);
    this._noise(12, "bandpass", 450, 0.4, [[0, 0], [1.5, 0.05]], 0, 10, true);
    this._noise(12, "highpass", 2200, 0, [[0, 0], [2.0, 0.025]], 0, 10, true);

    out.gain.setValueAtTime(0.5, now + 8);
    out.gain.linearRampToValueAtTime(0, now + 10);
    setTimeout(() => this.stop(), 10500);
  }
}
