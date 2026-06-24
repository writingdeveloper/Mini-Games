// Pure, dependency-free simulation for /garak-guksu (unit-testable; no DOM/three).
// Plan 2 = 4-station pipeline: 사리세팅 → 데치기(timed doneness) → 육수 → 마감(spice) → 배식.

// The chef walks this floor plane (x = left/right, z = depth toward counter).
export const KITCHEN = { minX: -4, maxX: 12, minZ: -2.5, maxZ: 2.5 }; // maxX 12: 창고 뒷길(우벽 출구 너머 어두운 도로)까지 나갈 수 있게

// Customer slots along the counter (front, z = 3.2), spread across x.
export const CUSTOMER_SLOTS = [
  { x: -3, z: 3.2 }, { x: -1, z: 3.2 }, { x: 1, z: 3.2 }, { x: 3, z: 3.2 },
];

export const REACH = 1.2;                            // how close counts as "at" a thing
export const PLACE_SLOTS = [{ x: -2.5, z: 2.3 }, { x: 0, z: 2.3 }, { x: 2.5, z: 2.3 }]; // 완성 그릇 놓는 진열대(서빙 카운터)
export const DOORWAY = { x: 4.7, z: 0 };             // 측면 창고 입구(문/칸막이 x). 닫히면 통행 차단, 열면 문간으로 통과.
export const DOOR_HALF = 0.9;                        // 문간 반폭 — |z|<DOOR_HALF 이고 문 열림일 때만 칸막이(x=DOORWAY.x) 통과
export const RIGHT_WALL = 7.4;                       // 건물 우벽(창고 바깥) — 창고 뒷길로 나가는 출구
export const RIGHT_GAP_HALF = 1.2;                   // 우벽 뒷길 출구 반폭 — |z|<RIGHT_GAP_HALF 에서만 통과(문 없음, 항상 열림)
// 알바(자율 일꾼) — 손님을 맡아 조리(추상 타이머)→배달 서빙까지 전체 루프를 스스로 수행.
export const ALBA_HOME = { x: 4.15, z: 0.7 };        // 1번 알바 대기 위치(조리·서빙 사이, 플레이어 동선 비켜)
export const ALBA_HOME2 = { x: 4.55, z: 1.5 };       // 2번 알바 대기 위치(겹침 방지)
export const ALBA_COOK_SPOT = { x: 3.5, z: -0.45 };  // 1번 조리 위치(카운터 앞)
export const ALBA_COOK_SPOT2 = { x: 2.7, z: -0.45 }; // 2번 조리 위치(겹침 방지)
export const ALBA_COOK_TIME = 3.0;                   // 한 그릇 조리 시간(초) — 더 빨리(5→3)
export const ALBA_SPEED = 4.0;                       // 이동 속도(units/s) — 더 빨리(3→4)
export const ALBA_RESCUE = 0.22;                     // 이 인내심% 넘긴 손님부터 맡음 — 더 열심히/일찍(0.35→0.22)

// The four cook stations. 화면 왼쪽=월드 +x(카메라가 +z 응시)이므로, 신규 플레이어가
// 왼쪽부터 ①→④ 순서로 읽도록 x를 +3→-3 로 배치(setting=면이 화면 맨 왼쪽). — 게이머 QA
export const STATIONS = {
  setting:  { x:  3, z: -1.5 },
  blancher: { x:  1, z: -1.5 },
  broth:    { x: -1, z: -1.5 },
  garnish:  { x: -3, z: -1.5 },
};

// 충돌 blocker(원형) — 플레이어가 작업대/화덕/진열대를 관통하지 않게(garak은 물리엔진 없음 → 수동 push).
// 외곽(기차·기둥·손님·카운터)은 KITCHEN 박스가 이미 차단 → 막을 내부 에셋은 8개뿐.
// 반경은 REACH(1.2) 보존이 핵심: 조리대 r 0.8 + PLAYER_RADIUS 0.32 = 1.12 < 1.2 → 조리 판정 유지.
export const PLAYER_RADIUS = 0.32;
export const BLOCKERS = [
  ...Object.values(STATIONS).map((s) => ({ x: s.x, z: s.z, r: 0.8 })), // 조리대 4종(작업대 라인)
  { x: 4.0, z: -1.5, r: 0.6 },                                          // 주방 화덕(작업대 우측 끝)
  ...PLACE_SLOTS.map((s) => ({ x: s.x, z: s.z, r: 0.45 })),             // 진열대 3칸(서빙 카운터)
  // 창고 가구(문 열고 들어갔을 때 관통 방지) — scene.js makeSideStorage 배치와 일치.
  { x: 5.35, z: -2.95, r: 0.62 },                                       // 냉장고
  { x: 6.6, z: -3.0, r: 0.62 },                                         // 선반
  { x: 6.98, z: 1.9, r: 0.8 },                                          // 궤짝 더미
];

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
    doorOpen: false,                  // 측면 창고 문(닫힘=창고 진입 차단)
    albas: [ // 자율 일꾼 2명(조리→배달). 각자 home/cook 좌표를 가져 겹치지 않음.
      { phase: 'idle', t: 0, x: ALBA_HOME.x, z: ALBA_HOME.z, home: ALBA_HOME, cook: ALBA_COOK_SPOT, targetId: -1, bowlSpice: null, lastSlot: -1, serveCount: 0 },
      { phase: 'idle', t: 0, x: ALBA_HOME2.x, z: ALBA_HOME2.z, home: ALBA_HOME2, cook: ALBA_COOK_SPOT2, targetId: -1, bowlSpice: null, lastSlot: -1, serveCount: 0 },
    ],

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
  const prevX = state.player.x;
  let nx = clamp(prevX + dir.x * s, KITCHEN.minX, KITCHEN.maxX);
  let nz = clamp(state.player.z + dir.z * s, KITCHEN.minZ, KITCHEN.maxZ);
  // 칸막이 벽(x=DOORWAY.x): 문간(|z|<DOOR_HALF) + 문 열림에서만 통과. 그 외엔 부드러운 벽(현재 있는 쪽으로 막아 스냅·끼임 방지).
  if (!(Math.abs(nz) < DOOR_HALF && state.doorOpen)) {
    if (prevX < DOORWAY.x && nx > DOORWAY.x - PLAYER_RADIUS) nx = DOORWAY.x - PLAYER_RADIUS;       // 주방 쪽 → 칸막이 못 넘음
    else if (prevX > DOORWAY.x && nx < DOORWAY.x + PLAYER_RADIUS) nx = DOORWAY.x + PLAYER_RADIUS;  // 창고 쪽 → 칸막이 못 넘음(문 닫히면 안에 머묾)
  }
  // 우벽(x=RIGHT_WALL): 창고 뒷길 출구(|z|<RIGHT_GAP_HALF)에서만 통과. 그 외엔 부드러운 벽(스냅·끼임 방지).
  if (Math.abs(nz) >= RIGHT_GAP_HALF) {
    if (prevX < RIGHT_WALL && nx > RIGHT_WALL - PLAYER_RADIUS) nx = RIGHT_WALL - PLAYER_RADIUS;       // 창고 쪽 → 우벽 못 넘음
    else if (prevX > RIGHT_WALL && nx < RIGHT_WALL + PLAYER_RADIUS) nx = RIGHT_WALL + PLAYER_RADIUS;  // 뒷길 쪽 → 우벽 못 넘음
  }
  // 에셋 충돌: 각 blocker 원과 겹치면 표면 밖(법선 방향)으로 밀어냄 → 벽 따라 미끄러짐(slide).
  for (const b of BLOCKERS) {
    const dx = nx - b.x, dz = nz - b.z;
    const rr = b.r + PLAYER_RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 1e-4;
      nx = b.x + (dx / d) * rr;
      nz = b.z + (dz / d) * rr;
    }
  }
  // push 후 다시 경계 안으로(모서리에서 밖으로 밀리는 것 방지).
  state.player.x = clamp(nx, KITCHEN.minX, KITCHEN.maxX);
  state.player.z = clamp(nz, KITCHEN.minZ, KITCHEN.maxZ);
  return state;
}

// 창고 문 토글(여닫기). 플레이어가 입구(DOORWAY) 근처일 때 main.js가 호출.
export function toggleDoor(state) { state.doorOpen = !state.doorOpen; return state.doorOpen; }

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

// Serve the nearest in-range customer a DONE bowl — from hand, or (미리만들기 보상)
// from a nearby 진열대 done bowl if hands aren't holding a finished one.
// Correct: combo++, speed bonus, score = (base+doneness+speed+accuracy)×comboMult.
// Wrong spice: half base, no bonus, combo resets.
export function serve(state) {
  const p = state.player;
  // 1) 어떤 완성 그릇으로 낼지 결정 — 손이 우선, 없으면 가까운 진열대의 완성 그릇(버퍼).
  let bowl = (p.holding && p.holding.stage === 'done') ? p.holding : null;
  let fromShelf = -1;
  if (!bowl) {
    let bd = REACH * REACH;
    PLACE_SLOTS.forEach((s, i) => {
      const b = state.placed[i];
      if (b && b.stage === 'done') {
        const d = dist2(p.x, p.z, s.x, s.z);
        if (d <= bd) { bd = d; fromShelf = i; bowl = b; }
      }
    });
  }
  if (!bowl) return false;
  // 2) 가까운 손님 선택.
  let best = null, bestD = REACH * REACH;
  for (const c of state.customers) {
    const slot = CUSTOMER_SLOTS[c.slot];
    const d = dist2(p.x, p.z, slot.x, slot.z);
    if (d <= bestD) { best = c; bestD = d; }
  }
  if (!best) return false;
  const correct = bowl.spice === best.order.spice;
  if (correct) {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const speed = Math.round((1 - patienceProgress(best)) * SPEED_MAX);
    const raw = SERVE_BASE + bowl.doneness + speed + ACCURACY_BONUS;
    state.score += Math.round(raw * comboMult(state.combo));
    state.served += 1;
  } else {
    state.score += Math.round(SERVE_BASE / 2); // mis-serve: half base, no bonus
    state.combo = 0;
  }
  if (fromShelf >= 0) state.placed[fromShelf] = null; else p.holding = null;
  state.customers = state.customers.filter((c) => c.id !== best.id);
  return true;
}

// 들고 있는 완성 그릇을 던진다(아무 데나 놓기/내던지기). 손을 비우고 그릇 정보를 반환(없으면 null).
// 물리(비행·낙하·멀면 깨짐)는 scene.js 가 처리 — 점수와 무관한 자유 행동.
export function throwBowl(state) {
  const b = state.player.holding;
  if (!b || b.stage !== 'done') return null;
  state.player.holding = null;
  return b;
}

// 알바를 목표(gx,gz)로 이동. 도착하면 true.
function albaMoveTo(a, gx, gz, dt) {
  const dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz), step = ALBA_SPEED * dt;
  if (d <= step || d < 1e-4) { a.x = gx; a.z = gz; return true; }
  a.x += (dx / d) * step; a.z += (dz / d) * step; return false;
}

// 알바(자율 일꾼) 2명: 각자 손님을 맡아 ① 조리대로 이동→조리(ALBA_COOK_TIME) ② 손님께 이동→서빙 루프를 돈다.
// 가장 급한(인내심 ALBA_RESCUE 초과 중 최고) 손님부터 맡되, 다른 알바가 맡은 손님은 건너뜀(중복 방지).
// 콤보는 안 올림(플레이어 몫). scene.js 는 albas[i].{x,z,phase} 로 렌더, serveCount 로 서빙 알림.
function resetAlba(a) { a.phase = 'idle'; a.targetId = -1; a.bowlSpice = null; }

function albaStep(state, a, dt, taken) {
  // 타겟이 사라졌으면(플레이어가 먼저 서빙/이탈) 작업 취소.
  if (a.targetId >= 0 && !state.customers.some((c) => c.id === a.targetId)) resetAlba(a);

  if (a.phase === 'idle') {
    albaMoveTo(a, a.home.x, a.home.z, dt);
    let pick = null, best = ALBA_RESCUE;
    for (const c of state.customers) {
      if (taken.has(c.id)) continue;                 // 다른 알바가 이미 맡음
      const pr = patienceProgress(c);
      if (pr > best) { best = pr; pick = c; }
    }
    if (pick) { a.targetId = pick.id; taken.add(pick.id); a.bowlSpice = pick.order.spice; a.phase = 'cook'; a.t = 0; }
    return null;
  }
  if (a.phase === 'cook') {
    if (albaMoveTo(a, a.cook.x, a.cook.z, dt)) a.t += dt; // 조리대 도착 후부터 조리
    if (a.t >= ALBA_COOK_TIME) { a.phase = 'deliver'; a.t = 0; }
    return null;
  }
  if (a.phase === 'deliver') {
    const cust = state.customers.find((c) => c.id === a.targetId);
    if (!cust) { resetAlba(a); return null; }
    const slot = CUSTOMER_SLOTS[cust.slot];
    if (albaMoveTo(a, slot.x, Math.min(slot.z, 2.6), dt)) {
      const speed = Math.round((1 - patienceProgress(cust)) * SPEED_MAX); // 알바는 주문대로 조리 → 정확
      state.score += SERVE_BASE + ACCURACY_BONUS + speed; // 콤보 배수 없음(보조 점수)
      state.served += 1;
      state.customers = state.customers.filter((c) => c.id !== cust.id);
      a.lastSlot = cust.slot; a.serveCount += 1;
      resetAlba(a);
      return { servedSlot: cust.slot };
    }
    return null;
  }
  return null;
}

export function albaTick(state, dt) {
  if (state.phase !== 'serving') return null;
  // 이미 맡은 손님 집합(중복 처리 방지) — 루프 중 각 알바의 신규 픽도 추가됨.
  const taken = new Set(state.albas.filter((a) => a.targetId >= 0).map((a) => a.targetId));
  let served = null;
  for (const a of state.albas) { const ev = albaStep(state, a, dt, taken); if (ev) served = ev; }
  return served;
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
