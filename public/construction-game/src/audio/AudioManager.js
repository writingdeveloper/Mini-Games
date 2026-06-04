export class AudioManager {
  constructor() { this.ctx = null; this.master = null; this.enabled = false; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    this.hum = this.ctx.createOscillator();
    this.hum.type = 'triangle';
    this.hum.frequency.value = 55;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.03;
    this.hum.connect(this.humGain).connect(this.master);
    this.hum.start();
    this.enabled = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  blip(freq, dur = 0.12, type = 'square', gain = 0.25) {
    if (!this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  shout(tacticId) {
    if (tacticId === 'bark') this.blip(180, 0.22, 'sawtooth', 0.35);
    else if (tacticId === 'taunt') this.blip(420, 0.16, 'square', 0.25);
    else this.blip(330, 0.2, 'sine', 0.22);
  }
  combo() { [660, 880, 1100].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.3), i * 70)); }
  floorUp() { [523, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'square', 0.3), i * 90)); }
  alarm() { this.blip(140, 0.4, 'sawtooth', 0.4); }
}
