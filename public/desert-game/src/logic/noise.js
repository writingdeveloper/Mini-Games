// Deterministic 2D value noise (no deps). Returns a sampler in [-1, 1].
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295; // [0,1]
}
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function makeValueNoise(seed = 0) {
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const v00 = hash2(x0, y0, seed), v10 = hash2(x0 + 1, y0, seed);
    const v01 = hash2(x0, y0 + 1, seed), v11 = hash2(x0 + 1, y0 + 1, seed);
    const top = lerp(v00, v10, fx), bot = lerp(v01, v11, fx);
    return lerp(top, bot, fy) * 2 - 1; // [-1,1]
  };
}

// Multi-octave dune height. Origin is flattened into a spawn pad.
export function terrainHeight(x, z, seed = 1) {
  const n = makeValueNoise(seed);
  let h = 0, amp = 1, freq = 0.012, sum = 0;
  for (let o = 0; o < 4; o++) {
    h += n(x * freq, z * freq) * amp;
    sum += amp; amp *= 0.5; freq *= 2.1;
  }
  h = (h / sum) * 26; // peak dune height ~26 units
  const d = Math.hypot(x, z);
  const flatten = Math.min(1, d / 60); // flat within ~60 units of origin
  return h * flatten;
}
