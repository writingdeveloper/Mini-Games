// Pure, dependency-free simulation for /garak-guksu (unit-testable; no DOM/three).
// Plan 2 = 4-station pipeline: 사리세팅 → 데치기(timed doneness) → 육수 → 마감(spice) → 배식.

// The chef walks this floor plane (x = left/right, z = depth toward counter).
export const KITCHEN = { minX: -4, maxX: 4, minZ: -2.5, maxZ: 2.5 };

// Customer slots along the counter (front, z = 3.2), spread across x.
export const CUSTOMER_SLOTS = [
  { x: -3, z: 3.2 }, { x: -1, z: 3.2 }, { x: 1, z: 3.2 }, { x: 3, z: 3.2 },
];

export const REACH = 1.2;                            // how close counts as "at" a thing
export const PLACE_SLOTS = [{ x: -2.5, z: 2.3 }, { x: 0, z: 2.3 }, { x: 2.5, z: 2.3 }]; // 완성 그릇 놓는 진열대(서빙 카운터)

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
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);
export const SPAWN_INTERVAL = 2.5;     // seconds between spawns while a slot is free
export const BLANCH_SLOTS = 2;          // simultaneous baskets

// 5 waves = 5 trains. Era curve: steam(여유) → diesel(압박) → 막차(클라이맥스).
export const WAVES = [
  { era: '증기', dwell: 75, count: 3 },
  { era: '증기', dwell: 70, count: 4 },
  { era: '디젤', dwell: 55, count: 5 },
  { era: '디젤', dwell: 50, count: 6 },
  { era: '막차', dwell: 40, count: 8 },
];
export const INTERMISSION = 2.5; // seconds between waves (정산·안내방송)

export function createGame(seed = 1) {
  const rng = mulberry32(seed);
  return {
    player: { x: 0, z: 0, holding: null },
    blancher: { slots: new Array(BLANCH_SLOTS).fill(null) },
    placed: new Array(PLACE_SLOTS.length).fill(null), // 진열대에 놓인 그릇들

    customers: [],
    spawnTimer: 0,
    waveSpawned: 0,
    wave: 0,
    phase: 'serving',                 // 'serving' | 'intermission' | 'won' | 'over'
    dwellLeft: WAVES[0].dwell,
    intermissionLeft: 0,
    lives: 5,
    score: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    missed: 0,
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
  if (state.phase !== 'serving') return;
  if (state.waveSpawned >= WAVES[state.wave].count) return; // this wave's quota is full
  state.spawnTimer += dt;
  if (state.spawnTimer < SPAWN_INTERVAL) return;
  state.spawnTimer = 0;
  const occupied = new Set(state.customers.map((c) => c.slot));
  const free = CUSTOMER_SLOTS.findIndex((_, i) => !occupied.has(i));
  if (free === -1) return;
  const arche = ARCHETYPE_KEYS[Math.floor(state._rng() * ARCHETYPE_KEYS.length)];
  state.customers.push({ id: state._nextId++, slot: free, archetype: arche, order: makeOrder(state._rng, arche), t: 0 });
  state.waveSpawned += 1;
}

export function patienceProgress(c) { return c.t / ARCHETYPES[c.archetype].patience; }

function loseLife(state) {
  state.lives -= 1;
  if (state.lives <= 0) { state.lives = 0; state.phase = 'over'; }
}

// Advance every customer's patience; those past their limit storm off (lose a life each).
export function tickCustomers(state, dt) {
  if (state.phase !== 'serving') return;
  for (const c of state.customers) c.t += dt;
  const stayed = [];
  for (const c of state.customers) {
    if (c.t >= ARCHETYPES[c.archetype].patience) { loseLife(state); state.missed += 1; state.combo = 0; }
    else stayed.push(c);
  }
  state.customers = stayed;
}

export const PLAYER_SPEED = 4.5; // units/second

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// dir = {x, z} (roughly unit length), dt = seconds. Mutates + returns state.
export function movePlayer(state, dir, dt, speedMul = 1) {
  const s = PLAYER_SPEED * speedMul * dt;
  state.player.x = clamp(state.player.x + dir.x * s, KITCHEN.minX, KITCHEN.maxX);
  state.player.z = clamp(state.player.z + dir.z * s, KITCHEN.minZ, KITCHEN.maxZ);
  return state;
}

export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function near(ax, az, bx, bz, r = REACH) { return dist2(ax, az, bx, bz) <= r * r; }

export const SERVE_BASE = 100;
export const ACCURACY_BONUS = 30;
export const SPEED_MAX = 50; // max speed bonus when the customer is fully calm

// Consecutive correct serves raise the multiplier: 1 → +0.4 per streak → capped ×3 (×3 at streak 6).
export function comboMult(combo) {
  return Math.min(3, 1 + Math.max(0, combo - 1) * 0.4);
}

// Title from the run's outcome (read by the result screen).
export function grade(state) {
  if (state.phase === 'won' && state.missed === 0) return '역전의 명인';
  if (state.phase === 'won') return '0시 50분의 사나이';
  if (state.missed >= 6) return '기차 도살자';
  if (state.served >= 12) return '면치기 9단';
  if (state.served >= 5) return '오늘 장사 쏠쏠';
  return '오늘도 한 그릇';
}

// Serve the nearest in-range customer holding a DONE bowl.
// Correct: combo++, speed bonus, score = (base+doneness+speed+accuracy)×comboMult.
// Wrong spice: half base, no bonus, combo resets.
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
  const correct = p.holding.spice === best.order.spice;
  if (correct) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const speed = Math.round((1 - patienceProgress(best)) * SPEED_MAX);
    const raw = SERVE_BASE + p.holding.doneness + speed + ACCURACY_BONUS;
    state.score += Math.round(raw * comboMult(state.combo));
    state.served += 1;
  } else {
    state.score += Math.round(SERVE_BASE / 2); // mis-serve: half base, no bonus
    state.combo = 0;
  }
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

// 완성/진행중 그릇을 진열대에 놓거나 집기 — 손에 들었으면 가까운 빈 슬롯에 놓고, 빈손이면 가까운 채워진 슬롯에서 집는다.
export function placeOrPickup(state) {
  const p = state.player;
  let idx = -1, bestD = REACH * REACH;
  PLACE_SLOTS.forEach((s, i) => {
    const free = state.placed[i] === null;
    if (p.holding ? !free : free) return; // 들었으면 빈 슬롯만, 빈손이면 채워진 슬롯만 대상
    const d = dist2(p.x, p.z, s.x, s.z);
    if (d <= bestD) { bestD = d; idx = i; }
  });
  if (idx === -1) return false;
  if (p.holding) { state.placed[idx] = p.holding; p.holding = null; }
  else { p.holding = state.placed[idx]; state.placed[idx] = null; }
  return true;
}

function startWave(state, i) {
  state.phase = 'serving';
  state.dwellLeft = WAVES[i].dwell;
  state.waveSpawned = 0;
  state.spawnTimer = 0;
}

function endWave(state) {
  state.customers = [];       // the train departs — remaining customers leave (score loss only, no life penalty)
  state.wave += 1;
  if (state.wave >= WAVES.length) { state.phase = 'won'; }
  else { state.phase = 'intermission'; state.intermissionLeft = INTERMISSION; }
}

// Drive the dwell timer (serving) and the intermission timer. Call each frame.
export function tickWave(state, dt) {
  if (state.phase === 'serving') {
    state.dwellLeft -= dt;
    if (state.dwellLeft <= 0) endWave(state);
  } else if (state.phase === 'intermission') {
    state.intermissionLeft -= dt;
    if (state.intermissionLeft <= 0) startWave(state, state.wave);
  }
}
