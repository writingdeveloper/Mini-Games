// Pure, dependency-free simulation for /garak-guksu (unit-testable; no DOM/three).
// Plan 1 = vertical slice: one cook station, one customer, single-step "make a bowl".

// The chef walks this floor plane (x = left/right, z = depth toward counter).
export const KITCHEN = { minX: -4, maxX: 4, minZ: -2.5, maxZ: 2.5 };

// Fixed positions.
export const CUSTOMER_SLOT = { x: 0, z: 3.2 };       // across the counter (beyond the kitchen)
export const REACH = 1.2;                            // how close counts as "at" a thing

// The four cook stations, left→right across the back of the kitchen.
export const STATIONS = {
  setting:  { x: -3, z: -1.5 },
  blancher: { x: -1, z: -1.5 },
  broth:    { x:  1, z: -1.5 },
  garnish:  { x:  3, z: -1.5 },
};

// Deterministic RNG (mulberry32) so orders are reproducible in tests/QA.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SPICES = ['none', 'normal', 'extra']; // 안맵게 / 기본 / 많이

export function createGame(seed = 1) {
  const rng = mulberry32(seed);
  return {
    player: { x: 0, z: 0, holding: null },
    blancher: { bowl: null }, // bowl: null | { t }
    customer: { present: true, served: false, order: { spice: SPICES[Math.floor(rng() * 3)] } },
    score: 0,
    _rng: rng,
  };
}

export const PLAYER_SPEED = 4.5; // units/second

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// dir = {x, z} (roughly unit length), dt = seconds. Mutates + returns state.
export function movePlayer(state, dir, dt) {
  const s = PLAYER_SPEED * dt;
  state.player.x = clamp(state.player.x + dir.x * s, KITCHEN.minX, KITCHEN.maxX);
  state.player.z = clamp(state.player.z + dir.z * s, KITCHEN.minZ, KITCHEN.maxZ);
  return state;
}

export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function near(ax, az, bx, bz, r = REACH) { return dist2(ax, az, bx, bz) <= r * r; }

export const SERVE_BASE = 100;
export const ACCURACY_BONUS = 30;

export function serve(state) {
  const p = state.player, c = state.customer;
  if (p.holding && p.holding.stage === 'done' && c.present && !c.served &&
      near(p.x, p.z, CUSTOMER_SLOT.x, CUSTOMER_SLOT.z)) {
    const accuracy = p.holding.spice === c.order.spice ? ACCURACY_BONUS : 0;
    state.score += SERVE_BASE + p.holding.doneness + accuracy;
    p.holding = null;
    c.served = true;
    c.present = false;
    return true;
  }
  return false;
}

export const BLANCH_TIME = 2.5;

export function donenessScore(progress) {
  if (progress >= 0.75 && progress <= 0.85) return 50;
  if (progress >= 0.7 && progress <= 0.9) return 20;
  return 0;
}

export function setNoodle(state) {
  const p = state.player;
  if (p.holding === null && near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) {
    p.holding = { stage: 'noodle' };
    return true;
  }
  return false;
}

export function putInBlancher(state) {
  const p = state.player;
  if (p.holding && p.holding.stage === 'noodle' && state.blancher.bowl === null &&
      near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    state.blancher.bowl = { t: 0 };
    p.holding = null;
    return true;
  }
  return false;
}

export function tickBlancher(state, dt) {
  if (state.blancher.bowl) state.blancher.bowl.t += dt;
}

export function blancherProgress(state) {
  return state.blancher.bowl ? state.blancher.bowl.t / BLANCH_TIME : 0;
}

export function liftFromBlancher(state) {
  const p = state.player;
  if (p.holding === null && state.blancher.bowl &&
      near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    p.holding = { stage: 'blanched', doneness: donenessScore(blancherProgress(state)) };
    state.blancher.bowl = null;
    return true;
  }
  return false;
}

export function pourBroth(state) {
  const p = state.player;
  if (p.holding && p.holding.stage === 'blanched' &&
      near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) {
    p.holding = { stage: 'brothed', doneness: p.holding.doneness };
    return true;
  }
  return false;
}

export function garnish(state, spice) {
  const p = state.player;
  if (p.holding && p.holding.stage === 'brothed' && SPICES.includes(spice) &&
      near(p.x, p.z, STATIONS.garnish.x, STATIONS.garnish.z)) {
    p.holding = { stage: 'done', doneness: p.holding.doneness, spice };
    return true;
  }
  return false;
}
