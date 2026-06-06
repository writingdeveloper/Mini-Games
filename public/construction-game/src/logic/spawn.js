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

// Workers cluster around the build zone (buildings sit at z≈-6, spanning x≈±12) so they're
// on-camera, grouped, and reachable for confrontation — not scattered to the far corners of
// the 44×44 lot (which made them tiny, off-focus, and impossible to soothe).
const WORKER_SPAWN = { halfX: 11, centerZ: -6, halfZ: 7 };

export function spawnWorkers(seed, count) {
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const archetypeId = ARCHETYPE_LIST[Math.floor(rng() * ARCHETYPE_LIST.length)].id;
    const x = +((rng() * 2 - 1) * WORKER_SPAWN.halfX).toFixed(3);
    const z = +(WORKER_SPAWN.centerZ + (rng() * 2 - 1) * WORKER_SPAWN.halfZ).toFixed(3);
    out.push({ id: i, archetypeId, x, z });
  }
  return out;
}

const SKYLINE_SEED_OFFSET = 999; // uncorrelated with workers (seed) and props (seed+555)

// Deterministic distant-city ring around the lot: two jittered radius bands for parallax depth, with
// taller/denser towers biased into the -Z hemisphere (the camera's hero vista). Returns per-building
// { x, z, w, h, d, ry }. Rendered as 2 InstancedMeshes in Site.js (bodies + windows).
export function spawnSkyline(seed, count) {
  const rng = mulberry32(seed + SKYLINE_SEED_OFFSET);
  const out = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (rng() * 2 - 1) * 0.06;
    const ring = rng() < 0.5 ? 80 + rng() * 22 : 105 + rng() * 32; // inner / outer band (kept well into the fog)
    const x = +(Math.sin(ang) * ring).toFixed(3);
    const z = +(Math.cos(ang) * ring).toFixed(3);
    const hero = z < 0; // far side the camera faces → taller, denser
    const w = +(8 + rng() * 10).toFixed(3);
    const d = +(8 + rng() * 10).toFixed(3);
    const h = +((hero ? 22 : 14) + rng() * (hero ? 33 : 18)).toFixed(3);
    const ry = +((rng() * 2 - 1) * 0.4).toFixed(3);
    out.push({ x, z, w, h, d, ry });
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
