// Pure, dependency-free simulation for /garak-guksu (unit-testable; no DOM/three).
// Plan 2 = 4-station pipeline: 사리세팅 → 데치기(timed doneness) → 육수 → 마감(spice) → 배식.

// The chef walks this floor plane (x = left/right, z = depth toward counter).
export const KITCHEN = { minX: -4, maxX: 4, minZ: -2.5, maxZ: 2.5 };

// Customer slots along the counter (front, z = 3.2), spread across x.
export const CUSTOMER_SLOTS = [
  { x: -3, z: 3.2 }, { x: -1, z: 3.2 }, { x: 1, z: 3.2 }, { x: 3, z: 3.2 },
];

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

// 5 archetypes: patience (seconds before they storm off) + display name + spice tendency.
export const ARCHETYPES = {
  soldier: { name: '군인',   patience: 12, spice: 'extra'  },
  worker:  { name: '회사원', patience: 15, spice: 'extra'  },
  student: { name: '통학생', patience: 18, spice: 'normal' },
  couple:  { name: '연인',   patience: 24, spice: 'normal' },
  granny:  { name: '할머니', patience: 25, spice: 'none'   },
};
export const ARCHETYPE_KEYS = ['soldier', 'worker', 'student', 'couple', 'granny'];
export const SPAWN_INTERVAL = 2.5;     // seconds between spawns while a slot is free
export const BLANCH_SLOTS = 2;          // simultaneous baskets

export function createGame(seed = 1) {
  const rng = mulberry32(seed);
  return {
    player: { x: 0, z: 0, holding: null },
    blancher: { slots: new Array(BLANCH_SLOTS).fill(null) }, // each: null | { t }
    customers: [],         // active: { id, slot, archetype, order:{spice}, t }
    spawnTimer: 0,
    lives: 5,
    over: false,
    score: 0,
    _rng: rng,
    _nextId: 1,
  };
}

// 70% the archetype's preferred spice, else a random one (so it's not fully predictable).
function makeOrder(rng, arche) {
  const spice = rng() < 0.7 ? ARCHETYPES[arche].spice : SPICES[Math.floor(rng() * 3)];
  return { spice };
}

// Spawn one customer into the first free slot once the spawn timer passes SPAWN_INTERVAL.
export function tickSpawns(state, dt) {
  if (state.over) return;
  state.spawnTimer += dt;
  if (state.spawnTimer < SPAWN_INTERVAL) return;
  const occupied = new Set(state.customers.map((c) => c.slot));
  const free = CUSTOMER_SLOTS.findIndex((_, i) => !occupied.has(i));
  if (free === -1) return;
  state.spawnTimer = 0;
  const arche = ARCHETYPE_KEYS[Math.floor(state._rng() * ARCHETYPE_KEYS.length)];
  state.customers.push({ id: state._nextId++, slot: free, archetype: arche, order: makeOrder(state._rng, arche), t: 0 });
}

export function patienceProgress(c) { return c.t / ARCHETYPES[c.archetype].patience; }

function loseLife(state) {
  state.lives -= 1;
  if (state.lives <= 0) { state.lives = 0; state.over = true; }
}

// Advance every customer's patience; those past their limit storm off (lose a life each).
export function tickCustomers(state, dt) {
  if (state.over) return;
  for (const c of state.customers) c.t += dt;
  const stayed = [];
  for (const c of state.customers) {
    if (c.t >= ARCHETYPES[c.archetype].patience) loseLife(state);
    else stayed.push(c);
  }
  state.customers = stayed;
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

// Serve the nearest in-range customer holding a DONE bowl. Score = base + doneness + accuracy.
export function serve(state) {
  const p = state.player;
  if (!p.holding || p.holding.stage !== 'done') return false;
  let best = null, bestD = REACH * REACH;
  for (const c of state.customers) {
    const slot = CUSTOMER_SLOTS[c.slot];
    const d = dist2(p.x, p.z, slot.x, slot.z);
    if (d <= bestD) { best = c; bestD = d; }
  }
  if (!best) return false;
  const accuracy = p.holding.spice === best.order.spice ? ACCURACY_BONUS : 0;
  state.score += SERVE_BASE + p.holding.doneness + accuracy;
  p.holding = null;
  state.customers = state.customers.filter((c) => c.id !== best.id);
  return true;
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
  if (!(p.holding && p.holding.stage === 'noodle')) return false;
  if (!near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) return false;
  const free = state.blancher.slots.findIndex((s) => s === null);
  if (free === -1) return false;
  state.blancher.slots[free] = { t: 0 };
  p.holding = null;
  return true;
}

export function tickBlancher(state, dt) {
  for (const s of state.blancher.slots) if (s) s.t += dt;
}

export function slotProgress(slot) { return slot ? slot.t / BLANCH_TIME : 0; }

// Lift the most-cooked slot (auto-pick — first basket ready leaves first).
export function liftFromBlancher(state) {
  const p = state.player;
  if (p.holding !== null || !near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) return false;
  let idx = -1, best = -1;
  state.blancher.slots.forEach((s, i) => { if (s && s.t > best) { best = s.t; idx = i; } });
  if (idx === -1) return false;
  p.holding = { stage: 'blanched', doneness: donenessScore(slotProgress(state.blancher.slots[idx])) };
  state.blancher.slots[idx] = null;
  return true;
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
