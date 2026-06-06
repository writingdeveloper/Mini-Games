import { SETTINGS } from '../logic/settings.js';

// Sample manifest — EMPTY by default so loadPack() makes no requests (a 404 for an absent file logs a
// console error). To add real audio, drop CC0 .ogg into assets/sfx/ (or TTS-generated Korean voice into
// assets/voice/) and UNCOMMENT the matching lines below; present cues then replace the procedural synth,
// the rest keep falling back. See docs/superpowers/assets-acquisition.md for the exact CC0 packs +
// the MeloTTS Korean-voice pipeline.
const SFX_MANIFEST = {
  // hammer:   './assets/sfx/hammer.ogg',
  // ambience: './assets/sfx/ambience.ogg',
  // floor:    './assets/sfx/floor.ogg',
  // building: './assets/sfx/building.ogg',
  // alarm:    './assets/sfx/alarm.ogg',
};
const VOICE_MANIFEST = {
  // bark:   ['./assets/voice/bark_01.ogg', './assets/voice/bark_02.ogg', './assets/voice/bark_03.ogg'],
  // taunt:  ['./assets/voice/taunt_01.ogg', './assets/voice/taunt_02.ogg'],
  // soothe: ['./assets/voice/soothe_01.ogg', './assets/voice/soothe_02.ogg'],
};

export class AudioManager {
  constructor() {
    this.ctx = null; this.master = null; this.enabled = false; this.muted = false; this._vol = 0.5;
    this.buffers = new Map();   // name -> AudioBuffer (loaded samples; absent => synth fallback)
    this.voice = new Map();     // tacticId -> AudioBuffer[]
    this._noise = null;
    this._lastHammer = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.muted = !!SETTINGS.muted;
    this.master.gain.value = this.muted ? 0 : this._vol;
    this.master.connect(this.ctx.destination);

    // Site ambience bed: a low rumble + a quiet filtered-noise layer (distant machinery), so the
    // background reads as a working site rather than a flat 55Hz tone.
    this.hum = this.ctx.createOscillator();
    this.hum.type = 'triangle'; this.hum.frequency.value = 52;
    this.humGain = this.ctx.createGain(); this.humGain.gain.value = 0.025;
    this.hum.connect(this.humGain).connect(this.master);
    this.hum.start();

    const bed = this.ctx.createBufferSource();
    bed.buffer = this._noiseBuffer(2.0); bed.loop = true;
    const bedFilter = this.ctx.createBiquadFilter();
    bedFilter.type = 'lowpass'; bedFilter.frequency.value = 320;
    this._bedGain = this.ctx.createGain(); this._bedGain.gain.value = 0.015;
    bed.connect(bedFilter).connect(this._bedGain).connect(this.master);
    bed.start();

    this.enabled = true;
    this.loadPack(); // best-effort: pull in any bundled samples/voice (all optional, never throws)
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(b) { this.muted = !!b; if (this.master) this.master.gain.value = this.muted ? 0 : this._vol; }
  setVolume(v) { this._vol = v; if (this.master && !this.muted) this.master.gain.value = v; }

  // --- sample loading (graceful: a missing/failed file just leaves the synth fallback in place) ----
  async loadPack() {
    if (!this.ctx) return;
    const get = async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { return null; }
    };
    for (const [name, url] of Object.entries(SFX_MANIFEST)) {
      const buf = await get(url); if (buf) this.buffers.set(name, buf);
    }
    for (const [tactic, urls] of Object.entries(VOICE_MANIFEST)) {
      const bufs = (await Promise.all(urls.map(get))).filter(Boolean);
      if (bufs.length) this.voice.set(tactic, bufs);
    }
  }

  _noiseBuffer(seconds = 1) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _playBuffer(buf, gain = 0.6, rate = 1) {
    if (!this.enabled || !buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.master); src.start();
  }

  // --- cues (sample if present, else procedural synth) ----------------------------------------------
  blip(freq, dur = 0.12, type = 'square', gain = 0.25) {
    if (!this.enabled) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  }

  // Procedural metallic hammer hit: a short noise transient through a bandpass + a quick pitched ring.
  // Globally throttled so a whole crew hammering reads as a steady work rhythm, not a cacophony.
  hammer() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this._lastHammer < 0.22) return;
    this._lastHammer = now;
    if (this.buffers.has('hammer')) { this._playBuffer(this.buffers.get('hammer'), 0.5, 0.92 + Math.random() * 0.16); return; }
    const src = this.ctx.createBufferSource(); src.buffer = this._noise || (this._noise = this._noiseBuffer(0.3));
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600 + Math.random() * 700; bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, now); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.14);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + 0.16);
    this.blip(220 + Math.random() * 60, 0.07, 'square', 0.12); // metallic ring
  }

  // Foreman shout: a bundled Korean voice clip if present, else a per-tactic synth bark.
  shout(tacticId) {
    if (this._playVoice(tacticId)) return;
    if (tacticId === 'bark') { this.blip(150, 0.1, 'sawtooth', 0.34); this.blip(110, 0.22, 'sawtooth', 0.3); }
    else if (tacticId === 'taunt') { this.blip(430, 0.14, 'square', 0.24); this.blip(360, 0.12, 'square', 0.2); }
    else { this.blip(320, 0.2, 'sine', 0.22); }
  }
  _playVoice(tacticId) {
    const bufs = this.voice.get(tacticId);
    if (!bufs || !bufs.length) return false;
    this._playBuffer(bufs[Math.floor(Math.random() * bufs.length)], 0.85);
    return true;
  }

  combo() { [660, 880, 1100].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.3), i * 70)); }
  floorUp() {
    if (this.buffers.has('floor')) { this._playBuffer(this.buffers.get('floor'), 0.7); return; }
    [523, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'square', 0.3), i * 90));
  }
  buildingDone() {
    if (this.buffers.has('building')) { this._playBuffer(this.buffers.get('building'), 0.8); return; }
    this.combo();
  }
  alarm() {
    if (this.buffers.has('alarm')) { this._playBuffer(this.buffers.get('alarm'), 0.7); return; }
    this.blip(140, 0.4, 'sawtooth', 0.4);
  }
}
