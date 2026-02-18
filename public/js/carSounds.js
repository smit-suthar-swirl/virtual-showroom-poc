export class CarSounds {
  constructor() {
    this.ctx = null;
    this.activeNodes = [];
    this.masterGain = null;
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  stop() {
    this.activeNodes.forEach(n => {
      try { n.stop(); } catch (e) { /* already stopped */ }
    });
    this.activeNodes = [];
    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch (e) {}
    }
  }

  createNoiseBuffer(duration) {
    const sr = this.ctx.sampleRate;
    const len = sr * duration;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  // ── Engine Start Sound ────────────────────────
  playStartup() {
    this.ensureContext();
    this.stop();
    this.ensureContext(); // re-create masterGain after stop

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.masterGain;

    // ── Phase 1: Electric system wake-up whine (0 – 1.5s) ──
    const elec = ctx.createOscillator();
    elec.type = 'sine';
    elec.frequency.setValueAtTime(180, now);
    elec.frequency.exponentialRampToValueAtTime(750, now + 0.8);
    elec.frequency.exponentialRampToValueAtTime(350, now + 1.5);

    const elecGain = ctx.createGain();
    elecGain.gain.setValueAtTime(0.25, now);
    elecGain.gain.linearRampToValueAtTime(0.12, now + 1.5);
    elecGain.gain.linearRampToValueAtTime(0, now + 2.0);

    elec.connect(elecGain).connect(out);
    elec.start(now);
    elec.stop(now + 2.0);
    this.activeNodes.push(elec);

    // Subtle secondary harmonic
    const elec2 = ctx.createOscillator();
    elec2.type = 'sine';
    elec2.frequency.setValueAtTime(360, now);
    elec2.frequency.exponentialRampToValueAtTime(1500, now + 0.8);
    elec2.frequency.exponentialRampToValueAtTime(700, now + 1.5);
    const elec2Gain = ctx.createGain();
    elec2Gain.gain.setValueAtTime(0.06, now);
    elec2Gain.gain.linearRampToValueAtTime(0, now + 1.8);
    elec2.connect(elec2Gain).connect(out);
    elec2.start(now);
    elec2.stop(now + 1.8);
    this.activeNodes.push(elec2);

    // ── Phase 2: Starter motor crank (0.3 – 1.3s) ──
    const starterBuf = this.createNoiseBuffer(1.2);
    const starter = ctx.createBufferSource();
    starter.buffer = starterBuf;

    const starterBP = ctx.createBiquadFilter();
    starterBP.type = 'bandpass';
    starterBP.frequency.value = 280;
    starterBP.Q.value = 2.5;

    const starterGain = ctx.createGain();
    // Pulse to simulate cranking
    for (let i = 0; i < 10; i++) {
      const t = now + 0.3 + i * 0.09;
      starterGain.gain.setValueAtTime(0.22, t);
      starterGain.gain.linearRampToValueAtTime(0.04, t + 0.045);
    }
    starterGain.gain.setValueAtTime(0.04, now + 1.2);
    starterGain.gain.linearRampToValueAtTime(0, now + 1.4);

    starter.connect(starterBP).connect(starterGain).connect(out);
    starter.start(now + 0.3);
    starter.stop(now + 1.5);
    this.activeNodes.push(starter);

    // ── Phase 3: Combustion engine catch & idle (1.2 – 5.5s) ──
    // Primary engine oscillator (sawtooth for rich harmonics)
    const eng1 = ctx.createOscillator();
    eng1.type = 'sawtooth';
    eng1.frequency.setValueAtTime(30, now + 1.2);
    eng1.frequency.exponentialRampToValueAtTime(58, now + 1.8);  // rev up on catch
    eng1.frequency.exponentialRampToValueAtTime(26, now + 3.5);  // settle to idle
    eng1.frequency.setValueAtTime(26, now + 5.0);

    const eng1LP = ctx.createBiquadFilter();
    eng1LP.type = 'lowpass';
    eng1LP.frequency.value = 180;
    eng1LP.Q.value = 1;

    const eng1Gain = ctx.createGain();
    eng1Gain.gain.setValueAtTime(0, now + 1.2);
    eng1Gain.gain.linearRampToValueAtTime(0.28, now + 1.6);
    eng1Gain.gain.linearRampToValueAtTime(0.14, now + 3.5);
    eng1Gain.gain.linearRampToValueAtTime(0.1, now + 5.0);
    eng1Gain.gain.linearRampToValueAtTime(0, now + 6.0);

    eng1.connect(eng1LP).connect(eng1Gain).connect(out);
    eng1.start(now + 1.2);
    eng1.stop(now + 6.0);
    this.activeNodes.push(eng1);

    // 2nd harmonic
    const eng2 = ctx.createOscillator();
    eng2.type = 'sine';
    eng2.frequency.setValueAtTime(60, now + 1.2);
    eng2.frequency.exponentialRampToValueAtTime(116, now + 1.8);
    eng2.frequency.exponentialRampToValueAtTime(52, now + 3.5);

    const eng2Gain = ctx.createGain();
    eng2Gain.gain.setValueAtTime(0, now + 1.2);
    eng2Gain.gain.linearRampToValueAtTime(0.1, now + 1.8);
    eng2Gain.gain.linearRampToValueAtTime(0.05, now + 3.5);
    eng2Gain.gain.linearRampToValueAtTime(0, now + 6.0);

    eng2.connect(eng2Gain).connect(out);
    eng2.start(now + 1.2);
    eng2.stop(now + 6.0);
    this.activeNodes.push(eng2);

    // 3rd sub-harmonic for depth
    const eng3 = ctx.createOscillator();
    eng3.type = 'sine';
    eng3.frequency.setValueAtTime(15, now + 1.2);
    eng3.frequency.exponentialRampToValueAtTime(29, now + 1.8);
    eng3.frequency.exponentialRampToValueAtTime(13, now + 3.5);

    const eng3Gain = ctx.createGain();
    eng3Gain.gain.setValueAtTime(0, now + 1.2);
    eng3Gain.gain.linearRampToValueAtTime(0.15, now + 1.8);
    eng3Gain.gain.linearRampToValueAtTime(0.08, now + 3.5);
    eng3Gain.gain.linearRampToValueAtTime(0, now + 6.0);

    eng3.connect(eng3Gain).connect(out);
    eng3.start(now + 1.2);
    eng3.stop(now + 6.0);
    this.activeNodes.push(eng3);

    // ── Exhaust pop at ignition ──
    const exBuf = this.createNoiseBuffer(0.6);
    const exhaust = ctx.createBufferSource();
    exhaust.buffer = exBuf;

    const exLP = ctx.createBiquadFilter();
    exLP.type = 'lowpass';
    exLP.frequency.value = 120;

    const exGain = ctx.createGain();
    exGain.gain.setValueAtTime(0, now + 1.25);
    exGain.gain.linearRampToValueAtTime(0.35, now + 1.35);
    exGain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);

    exhaust.connect(exLP).connect(exGain).connect(out);
    exhaust.start(now + 1.25);
    exhaust.stop(now + 2.1);
    this.activeNodes.push(exhaust);

    // ── Cabin relay clicks (subtle) ──
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.value = 3000;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0, now);
    clickGain.gain.setValueAtTime(0.04, now + 0.05);
    clickGain.gain.linearRampToValueAtTime(0, now + 0.08);
    clickGain.gain.setValueAtTime(0.03, now + 0.15);
    clickGain.gain.linearRampToValueAtTime(0, now + 0.18);
    click.connect(clickGain).connect(out);
    click.start(now);
    click.stop(now + 0.2);
    this.activeNodes.push(click);
  }

  // ── Engine Running / Driving Sound ────────────
  playRunning() {
    this.ensureContext();
    this.stop();
    this.ensureContext();

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.masterGain;

    // ── Base engine frequency ~45Hz with RPM flutter ──
    const base = ctx.createOscillator();
    base.type = 'sawtooth';
    base.frequency.setValueAtTime(38, now);
    base.frequency.linearRampToValueAtTime(48, now + 1.0);

    // LFO for RPM variation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain).connect(base.frequency);
    lfo.start(now);
    this.activeNodes.push(lfo);

    const baseLP = ctx.createBiquadFilter();
    baseLP.type = 'lowpass';
    baseLP.frequency.value = 220;
    baseLP.Q.value = 1.5;

    const baseGain = ctx.createGain();
    baseGain.gain.setValueAtTime(0, now);
    baseGain.gain.linearRampToValueAtTime(0.22, now + 0.8);

    base.connect(baseLP).connect(baseGain).connect(out);
    base.start(now);
    this.activeNodes.push(base);

    // ── 2nd harmonic ──
    const h2 = ctx.createOscillator();
    h2.type = 'sine';
    h2.frequency.value = 96;
    const h2Gain = ctx.createGain();
    h2Gain.gain.setValueAtTime(0, now);
    h2Gain.gain.linearRampToValueAtTime(0.07, now + 0.8);
    h2.connect(h2Gain).connect(out);
    h2.start(now);
    this.activeNodes.push(h2);

    // ── 4th harmonic (adds character) ──
    const h4 = ctx.createOscillator();
    h4.type = 'sine';
    h4.frequency.value = 192;
    const h4Gain = ctx.createGain();
    h4Gain.gain.setValueAtTime(0, now);
    h4Gain.gain.linearRampToValueAtTime(0.03, now + 0.8);
    h4.connect(h4Gain).connect(out);
    h4.start(now);
    this.activeNodes.push(h4);

    // ── Exhaust rumble (filtered noise) ──
    const exBuf = this.createNoiseBuffer(12);
    const exNoise = ctx.createBufferSource();
    exNoise.buffer = exBuf;
    exNoise.loop = true;

    const exBP = ctx.createBiquadFilter();
    exBP.type = 'bandpass';
    exBP.frequency.value = 80;
    exBP.Q.value = 1.5;

    const exGain = ctx.createGain();
    exGain.gain.setValueAtTime(0, now);
    exGain.gain.linearRampToValueAtTime(0.06, now + 1.0);

    exNoise.connect(exBP).connect(exGain).connect(out);
    exNoise.start(now);
    this.activeNodes.push(exNoise);

    // ── Road / tire noise ──
    const roadBuf = this.createNoiseBuffer(12);
    const roadNoise = ctx.createBufferSource();
    roadNoise.buffer = roadBuf;
    roadNoise.loop = true;

    const roadBP = ctx.createBiquadFilter();
    roadBP.type = 'bandpass';
    roadBP.frequency.value = 450;
    roadBP.Q.value = 0.4;

    const roadGain = ctx.createGain();
    roadGain.gain.setValueAtTime(0, now);
    roadGain.gain.linearRampToValueAtTime(0.05, now + 1.5);

    roadNoise.connect(roadBP).connect(roadGain).connect(out);
    roadNoise.start(now);
    this.activeNodes.push(roadNoise);

    // ── Wind noise ──
    const windBuf = this.createNoiseBuffer(12);
    const windNoise = ctx.createBufferSource();
    windNoise.buffer = windBuf;
    windNoise.loop = true;

    const windHP = ctx.createBiquadFilter();
    windHP.type = 'highpass';
    windHP.frequency.value = 2200;

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0, now);
    windGain.gain.linearRampToValueAtTime(0.025, now + 2.0);

    windNoise.connect(windHP).connect(windGain).connect(out);
    windNoise.start(now);
    this.activeNodes.push(windNoise);

    // ── Auto-stop with fade at 10s ──
    out.gain.setValueAtTime(0.5, now + 8);
    out.gain.linearRampToValueAtTime(0, now + 10);

    setTimeout(() => this.stop(), 10500);
  }
}
