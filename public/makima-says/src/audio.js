// Audio for /makima-says: voice clip playback (preloaded) + WebAudio SFX + mute.

const VOICE_FILES = {
  "makima-up": "up", "makima-down": "down", "makima-left": "left", "makima-right": "right",
  "makima-intro": "intro", "makima-good": "good", "makima-fail": "fail",
  "reze-up": "up", "reze-down": "down", "reze-left": "left", "reze-right": "right",
  "reze-intro": "intro", "reze-tempt": "tempt", "reze-laugh": "laugh",
};

const MUTE_KEY = "makima-says-muted";

export function createAudio() {
  const clips = {};
  for (const name of Object.keys(VOICE_FILES)) {
    const a = new Audio(`/makima-says/audio/${name}.wav`);
    a.preload = "auto";
    clips[name] = a;
  }
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let current = null;
  let ctx = null;

  const audioCtx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

  function playVoice(speaker, key) {
    if (muted) return;
    const clip = clips[`${speaker}-${key}`];
    if (!clip) return;
    if (current && !current.paused) { current.pause(); current.currentTime = 0; }
    clip.currentTime = 0;
    current = clip;
    clip.play().catch(() => {});
  }

  function tone(freq, dur, type = "sine", gain = 0.2) {
    if (muted) return;
    const c = audioCtx();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function ding() { tone(880, 0.12, "triangle", 0.18); tone(1320, 0.14, "triangle", 0.12); }

  function boom() {
    if (muted) return;
    const c = audioCtx();
    const buf = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.setValueAtTime(0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
    src.connect(g); g.connect(c.destination); src.start();
  }

  function setMuted(m) { muted = m; localStorage.setItem(MUTE_KEY, m ? "1" : "0"); }
  function isMuted() { return muted; }

  return { playVoice, ding, boom, setMuted, isMuted, resume: () => audioCtx().resume() };
}
