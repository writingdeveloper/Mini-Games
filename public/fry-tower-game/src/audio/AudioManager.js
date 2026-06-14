// Procedural audio manager for Fryffel Tower.
// No external assets — all sounds synthesised via Web Audio API.
// Mirrors the desert-game AudioManager pattern: lazy init, master gain, no-op when not ready.

const STORAGE_KEY = 'fry-tower-audio';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._muted = false;
    this._volume = 0.5;
    this._bgmNodes = null;
    this._bgmScheduler = null;
    this._lastPlace = -Infinity;

    // Load persisted prefs immediately so the mute button reflects state on page load.
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (typeof saved.muted === 'boolean') this._muted = saved.muted;
      if (typeof saved.volume === 'number') this._volume = Math.max(0, Math.min(1, saved.volume));
    } catch (_) { /* ignore */ }
  }

  // ---- Lifecycle ----

  /** Lazily create AudioContext (must be called inside a user-gesture handler). */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : this._volume;
      this.master.connect(this.ctx.destination);
    } catch (_) {
      this.ctx = null;
    }
  }

  /** Resume after browser auto-suspend (call on gesture). */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // ---- Volume / mute ----

  get muted() { return this._muted; }

  setMuted(bool) {
    this._muted = !!bool;
    if (this.master) this.master.gain.value = this._muted ? 0 : this._volume;
    this._persist();
  }

  toggleMute() { this.setMuted(!this._muted); }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master && !this._muted) this.master.gain.value = this._volume;
    this._persist();
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: this._muted, volume: this._volume }));
    } catch (_) { /* ignore */ }
  }

  // ---- Internal helpers ----

  /** @returns {boolean} true if AudioContext is live and we can make sound. */
  get _ready() {
    return !!(this.ctx && this.ctx.state !== 'closed');
  }

  /** Create a one-shot oscillator. Auto-connects to master. Returns the osc. */
  _osc(type, freq, gainPeak, attackT, decayT, offset = 0) {
    if (!this._ready) return null;
    const t = this.ctx.currentTime + offset;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainPeak, t + attackT);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attackT + decayT);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + attackT + decayT + 0.01);
    return osc;
  }

  /** Burst of filtered noise for percussive hits. */
  _noise(durationSec, gainPeak, filterFreq, filterQ = 1, offset = 0) {
    if (!this._ready) return;
    const t = this.ctx.currentTime + offset;
    const bufLen = Math.ceil(this.ctx.sampleRate * durationSec);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainPeak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + durationSec + 0.01);
  }

  // ---- SFX ----

  /**
   * Crisp tok/crunch when a fry is placed.
   * Throttled: no stacking if called more often than every 80 ms.
   */
  place() {
    if (!this._ready) return;
    const now = this.ctx.currentTime;
    if (now - this._lastPlace < 0.08) return;
    this._lastPlace = now;

    // Click body: short noise burst (high-pass texture)
    this._noise(0.06, 0.45, 3000, 2.5);
    // Tok tone: short triangle click
    this._osc('triangle', 420, 0.12, 0.003, 0.06);
  }

  /** Clatter of collapsing fries: noise + descending tone. */
  collapse() {
    if (!this._ready) return;
    // Low rumble noise
    this._noise(0.4, 0.6, 280, 1.2);
    // Descending tone
    const osc = this._osc('sawtooth', 280, 0.18, 0.01, 0.35);
    if (osc) {
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.4);
    }
    // High crunch
    this._noise(0.15, 0.3, 1800, 0.8, 0.05);
  }

  /** Bright ascending chime on a stable/combo placement. */
  combo() {
    if (!this._ready) return;
    const freqs = [660, 880, 1100, 1320];
    freqs.forEach((f, i) => {
      this._osc('sine', f, 0.22, 0.01, 0.18, i * 0.07);
    });
  }

  /** Whoosh when firing a sabotage. */
  sabotageFire() {
    if (!this._ready) return;
    this._noise(0.3, 0.5, 1200, 5);
    const osc = this._osc('sine', 300, 0.15, 0.02, 0.25);
    if (osc) {
      osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.28);
    }
  }

  /** Splat/thud when a sabotage hits. */
  sabotageHit() {
    if (!this._ready) return;
    // Low thud
    this._noise(0.25, 0.7, 200, 1.5);
    this._osc('sine', 120, 0.3, 0.005, 0.2);
    // Splat high crunch
    this._noise(0.12, 0.4, 2400, 0.6, 0.03);
  }

  /** Short sting at round end. */
  roundEnd() {
    if (!this._ready) return;
    const freqs = [880, 660];
    freqs.forEach((f, i) => {
      this._osc('triangle', f, 0.25, 0.01, 0.2, i * 0.12);
    });
  }

  /** Brief fanfare at match end. */
  matchEnd() {
    if (!this._ready) return;
    const melody = [523, 659, 784, 1047, 1319];
    melody.forEach((f, i) => {
      this._osc('sine', f, 0.28, 0.01, 0.22, i * 0.11);
      this._osc('triangle', f * 0.5, 0.08, 0.01, 0.22, i * 0.11);
    });
  }

  // ---- BGM: gentle slow arpeggio loop ----

  startBgm() {
    if (!this._ready || this._bgmScheduler) return;
    // Low-gain pad: two slow LFO-modulated oscillators for ambience
    const padFreqs = [130.8, 164.8, 196.0]; // C3, E3, G3
    const padNodes = padFreqs.map((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = 0.025;
      osc.connect(g).connect(this.master);
      osc.start();
      return { osc, g };
    });

    // Arpeggio: schedule notes on a simple scheduler
    const arpFreqs = [261.6, 329.6, 392.0, 523.3, 392.0, 329.6];
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.5;
    const INTERVAL = 0.38; // seconds per note
    const LOOKAHEAD = 0.1; // schedule 100ms ahead

    const schedule = () => {
      if (!this.ctx || this.ctx.state === 'closed') return;
      while (nextTime < this.ctx.currentTime + LOOKAHEAD + 0.5) {
        const f = arpFreqs[step % arpFreqs.length];
        const t = nextTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.04, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + INTERVAL * 0.85);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + INTERVAL * 0.85 + 0.02);
        nextTime += INTERVAL;
        step++;
      }
    };

    schedule();
    const timerId = setInterval(schedule, 150);
    this._bgmNodes = padNodes;
    this._bgmScheduler = timerId;
  }

  stopBgm() {
    if (this._bgmScheduler) {
      clearInterval(this._bgmScheduler);
      this._bgmScheduler = null;
    }
    if (this._bgmNodes) {
      const t = this.ctx ? this.ctx.currentTime : 0;
      for (const { osc, g } of this._bgmNodes) {
        try {
          g.gain.setTargetAtTime(0, t, 0.3);
          osc.stop(t + 1.5);
        } catch (_) { /* already stopped */ }
      }
      this._bgmNodes = null;
    }
  }
}
