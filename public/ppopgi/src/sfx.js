// Self-contained procedural Web Audio for /ppopgi (no fry-tower AudioManager dep).
// All methods are no-op-safe before init() / when the context can't start.
let actx = null, _muted = false;

function tone(freq, dur, type, vol, when) {
  if (!actx || _muted) return;
  try {
    const t = actx.currentTime + (when || 0);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch (e) { /* */ }
}

export const sfx = {
  init() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* */ } } },
  resume() { if (actx && actx.state === 'suspended') actx.resume(); },
  setMuted(m) { _muted = !!m; },
  coin() { tone(900, 0.05, 'square', 0.18, 0); tone(1350, 0.07, 'square', 0.16, 0.05); tone(640, 0.13, 'triangle', 0.14, 0.13); },
  card() { tone(1500, 0.05, 'sine', 0.2, 0); tone(2050, 0.08, 'sine', 0.18, 0.08); },
  start() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, 'square', 0.18, i * 0.08)); },
  place() { tone(180, 0.09, 'sine', 0.22, 0); },                      // claw bottoms out
  grab() { tone(420, 0.05, 'square', 0.16, 0); tone(300, 0.07, 'square', 0.13, 0.04); }, // metallic clamp
  slip() { tone(220, 0.12, 'sawtooth', 0.16, 0); tone(150, 0.16, 'sawtooth', 0.12, 0.06); }, // miss
  get() { [784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'square', 0.2, i * 0.07)); }, // prize collected
  whiff() { tone(240, 0.09, 'sine', 0.13, 0); tone(150, 0.13, 'sine', 0.1, 0.06); },   // empty grab — hollow, no clamp (distinct from grab)
  creak() { tone(135, 0.2, 'sawtooth', 0.11, 0); tone(98, 0.24, 'sawtooth', 0.09, 0.07); }, // grip straining — slip imminent
  combo(step) { const base = 660 + Math.min(step, 6) * 90; tone(base, 0.09, 'square', 0.17, 0); tone(base * 1.5, 0.1, 'square', 0.13, 0.05); }, // rising combo chime
  milestone() { [659, 880, 1175, 1568].forEach((f, i) => tone(f, 0.16, 'square', 0.2, i * 0.09)); }, // score milestone fanfare
};
