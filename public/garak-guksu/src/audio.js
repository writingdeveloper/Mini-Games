// Audio for /garak-guksu: voice clip playback (preloaded) + mute.
// Pattern mirrors /makima-says/src/audio.js.

const VOICE_FILES = {
  orderBasic: 'cust-order-basic',
  orderGop:   'cust-order-gop',
  orderSpicy: 'cust-order-spicy',
  orderMild:  'cust-order-mild',
  rush:       'cust-rush',
  chefReady:  'chef-ready',
  chefBlow:   'chef-blow',
  happy:      'happy',
  leave:      'leave',
  combo:      'combo',
  pa:         'pa-depart',
};

const MUTE_KEY = 'garak-guksu-muted';

export function createAudio() {
  const clips = {};
  for (const [key, file] of Object.entries(VOICE_FILES)) {
    const a = new Audio(`/garak-guksu/audio/${file}.wav`);
    a.preload = 'auto';
    clips[key] = a;
  }

  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

  let current = null;

  function playVoice(key) {
    if (muted) return;
    const clip = clips[key];
    if (!clip) return;
    if (current && !current.paused) { current.pause(); current.currentTime = 0; }
    clip.currentTime = 0;
    current = clip;
    clip.play().catch(() => {});
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ }
  }

  function isMuted() { return muted; }

  return { playVoice, isMuted, setMuted };
}
