import { CONFIG } from './config.js';
import { ARCHETYPE_LIST } from './archetypes.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROPS_SEED_OFFSET = 555; // keeps the prop RNG stream uncorrelated with workers

const PROP_KINDS = ['barrel', 'crate', 'cone', 'pipe', 'scaffold'];

export function spawnWorkers(seed, count) {
  const rng = mulberry32(seed);
  const halfW = CONFIG.site.width / 2 - 2;
  const halfD = CONFIG.site.depth / 2 - 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const archetypeId = ARCHETYPE_LIST[Math.floor(rng() * ARCHETYPE_LIST.length)].id;
    const x = +((rng() * 2 - 1) * halfW).toFixed(3);
    const z = +((rng() * 2 - 1) * halfD).toFixed(3);
    out.push({ id: i, archetypeId, x, z });
  }
  return out;
}

export function spawnProps(seed, count) {
  const rng = mulberry32(seed + PROPS_SEED_OFFSET);
  const halfW = CONFIG.site.width / 2 - 1;
  const halfD = CONFIG.site.depth / 2 - 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    const kind = PROP_KINDS[Math.floor(rng() * PROP_KINDS.length)];
    const x = +((rng() * 2 - 1) * halfW).toFixed(3);
    const z = +((rng() * 2 - 1) * halfD).toFixed(3);
    out.push({ x, z, kind });
  }
  return out;
}
