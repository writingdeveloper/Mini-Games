export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.enabled = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // engine: sawtooth through a lowpass, pitch/volume track speed
    this.engine = this.ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    this.engine.connect(lp).connect(this.engineGain).connect(this.master);
    this.engine.frequency.value = 60;
    this.engine.start();
    this.enabled = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSpeed(speed) {
    if (!this.enabled) return;
    const s = Math.min(1, Math.abs(speed) / 40);
    this.engine.frequency.setTargetAtTime(60 + s * 180, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(0.04 + s * 0.1, this.ctx.currentTime, 0.1);
  }

  blip(freq, dur = 0.12, type = 'triangle', gain = 0.25) {
    if (!this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  collect() { this.blip(1320, 0.12, 'triangle'); }
  discover() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'sine', 0.3), i * 90));
  }

  update(_dt, game) { this.setSpeed(game.car.state.speed); }
}
