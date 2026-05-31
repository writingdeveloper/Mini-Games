// t in [0,1): 0 dawn (sun at east horizon), 0.25 noon (top),
// 0.5 dusk (west horizon), 0.75 midnight (below horizon).
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => ({ r: lerp(c1.r, c2.r, t), g: lerp(c1.g, c2.g, t), b: lerp(c1.b, c2.b, t) });
const C = (r, g, b) => ({ r, g, b });

export function sunDirection(t) {
  const a = (t % 1) * TAU;
  const x = Math.cos(a), y = Math.sin(a), z = 0.2; // small constant tilt
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
}

// Four key palettes blended by phase.
const KEY = {
  dawn:  { top: C(0.55, 0.62, 0.80), bottom: C(0.98, 0.78, 0.55), fog: C(0.92, 0.80, 0.66) },
  noon:  { top: C(0.45, 0.68, 0.95), bottom: C(0.95, 0.86, 0.66), fog: C(0.86, 0.82, 0.70) },
  dusk:  { top: C(0.62, 0.40, 0.55), bottom: C(0.98, 0.62, 0.34), fog: C(0.85, 0.55, 0.40) },
  night: { top: C(0.05, 0.07, 0.16), bottom: C(0.12, 0.13, 0.26), fog: C(0.08, 0.10, 0.20) },
};

export function skyPalette(t) {
  const x = ((t % 1) + 1) % 1;
  let a, b, f;
  if (x < 0.25) { a = KEY.dawn; b = KEY.noon; f = x / 0.25; }
  else if (x < 0.5) { a = KEY.noon; b = KEY.dusk; f = (x - 0.25) / 0.25; }
  else if (x < 0.75) { a = KEY.dusk; b = KEY.night; f = (x - 0.5) / 0.25; }
  else { a = KEY.night; b = KEY.dawn; f = (x - 0.75) / 0.25; }
  return { top: mix(a.top, b.top, f), bottom: mix(a.bottom, b.bottom, f), fog: mix(a.fog, b.fog, f) };
}

export function isNight(t) { const d = sunDirection(t); return d.y < 0; }
export function timeLabel(t) {
  const x = ((t % 1) + 1) % 1;
  if (x < 0.15 || x >= 0.9) return "여명";
  if (x < 0.4) return "낮";
  if (x < 0.6) return "노을";
  return "밤";
}
