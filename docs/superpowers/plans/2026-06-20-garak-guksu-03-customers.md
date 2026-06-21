# 가락국수 Plan 3: 손님 동시성 (5아키타입 · 초조 게이지 · 멀티 채반 · 라이프) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 단일 손님·단일 채반을 **다수 손님(`customers[]`) + 멀티 채반(`slots[]`)** 으로 마이그레이션하고, 5아키타입·초조 게이지·시차 스폰·이탈 라이프·게임오버를 더한다. 끝나면 여러 손님이 줄지어 각자 초조해하고, 두 채반을 저글링하며 응대하다 라이프가 떨어지면 영업종료된다.

**Architecture:** `logic.js`에서 `customer`(단일)→`customers[]`, `blancher.bowl`(단일)→`blancher.slots[]`로 바꾼다. 아키타입은 인내심·주문 성향을 정의하는 순수 데이터. 스폰/초조/이탈은 매 프레임 tick되는 순수 함수. `serve`는 가장 가까운 손님을 찾아 배식한다. 렌더는 슬롯별 손님 메시 풀 + 초조 게이지 + 멀티 채반 게이지. `main.js`는 spawn/customer tick을 루프에 더하고 게임오버를 처리한다.

**Tech Stack:** 기존과 동일. **웨이브·시대·정차타이머는 Plan 4**, **콤보·결과화면은 Plan 5**, **폴리시는 Plan 6**, **음성은 Plan 7**.

**작업 트리:** worktree `Mini-Games-garak`(브랜치 `feat/garak-guksu`).

**현재 상태(Plan 2 완료):** `logic.js`는 `createGame(seed)`={player, blancher:{bowl}, customer:{present,served,order:{spice}}, score, _rng}; 함수 setNoodle/putInBlancher/tickBlancher/blancherProgress/liftFromBlancher/pourBroth/garnish/serve(단일 customer); STATIONS·CUSTOMER_SLOT·ARCHETYPE 없음. 21 유닛 + 3 E2E green.

> ⚠️ **마이그레이션 주의:** `customer`→`customers[]`, `blancher.bowl`→`blancher.slots[]`, `CUSTOMER_SLOT`(단일)→`CUSTOMER_SLOTS`(배열)로 바뀐다. Plan 2의 다수 테스트(createGame/데치기/serve)와 `scene.js`/`main.js`의 참조가 영향을 받으므로 각 Task에서 함께 갱신한다. **logic Task 1-4는 한 묶음으로 실행**(중간엔 옛 테스트가 깨지고 Task 4 끝에 전체 green).

---

### Task 1: 아키타입 + customers[] + 슬롯 + 시차 스폰 (logic)

**Files:** Modify `public/garak-guksu/src/logic.js`, `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

import에 `CUSTOMER_SLOTS, ARCHETYPES, ARCHETYPE_KEYS, tickSpawns, SPAWN_INTERVAL` 추가. (옛 `CUSTOMER_SLOT` 단수는 Task 3에서 제거되니 지금은 둘 다 import해도 됨 — 단, 옛 serve/createGame 테스트는 Task 3까지 깨진 채 둔다.) 새 describe:
```ts
describe('스폰 (tickSpawns)', () => {
  it('spawns into a free slot after SPAWN_INTERVAL with a valid archetype + order', () => {
    const g = createGame(1);
    expect(g.customers).toEqual([]);
    tickSpawns(g, SPAWN_INTERVAL); // exactly the interval
    expect(g.customers.length).toBe(1);
    const c = g.customers[0];
    expect(ARCHETYPE_KEYS).toContain(c.archetype);
    expect(typeof c.slot).toBe('number');
    expect(SPICES).toContain(c.order.spice);
    expect(c.t).toBe(0);
  });
  it('does not spawn before the interval elapses', () => {
    const g = createGame(1);
    tickSpawns(g, SPAWN_INTERVAL * 0.5);
    expect(g.customers.length).toBe(0);
  });
  it('fills at most all slots (never double-books a slot)', () => {
    const g = createGame(1);
    for (let i = 0; i < 50; i++) tickSpawns(g, SPAWN_INTERVAL);
    expect(g.customers.length).toBe(CUSTOMER_SLOTS.length);
    const slots = g.customers.map((c) => c.slot);
    expect(new Set(slots).size).toBe(slots.length); // unique
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인** — `npx vitest run __tests__/unit/garak-guksu/logic.test.ts -t "스폰"` → FAIL.

- [ ] **Step 3: logic.js 수정 — createGame 재구성 + 아키타입/슬롯/스폰**

`CUSTOMER_SLOT`(단수) 줄을 아래로 교체:
```js
// Customer slots along the counter (front, z = 3.2), spread across x.
export const CUSTOMER_SLOTS = [
  { x: -3, z: 3.2 }, { x: -1, z: 3.2 }, { x: 1, z: 3.2 }, { x: 3, z: 3.2 },
];
```
`SPICES` 줄 아래에 아키타입 추가:
```js
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
```
`createGame`을 교체:
```js
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
```

- [ ] **Step 4: 새 스폰 테스트 통과 확인** — `npx vitest run __tests__/unit/garak-guksu/logic.test.ts -t "스폰"` → PASS. (옛 createGame/serve/데치기 테스트는 Task 3·4에서 정리.)

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): customers[] + 5 archetypes + slotted spawn"
```

---

### Task 2: 초조 게이지 + 이탈 + 라이프 + 게임오버 (logic)

**Files:** Modify `logic.js`, `logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

import에 `tickCustomers, patienceProgress`:
```ts
describe('초조 + 이탈 (tickCustomers / lives)', () => {
  function withOneCustomer(g, arche = 'soldier') {
    g.customers.push({ id: 1, slot: 0, archetype: arche, order: { spice: 'normal' }, t: 0 });
    return g.customers[0];
  }
  it('patienceProgress is t / patience', () => {
    const g = createGame(1);
    const c = withOneCustomer(g, 'soldier'); // patience 12
    c.t = 6;
    expect(patienceProgress(c)).toBeCloseTo(0.5, 5);
  });
  it('a customer past patience leaves and costs a life', () => {
    const g = createGame(1);
    withOneCustomer(g, 'soldier'); // patience 12
    tickCustomers(g, 12.1);
    expect(g.customers.length).toBe(0);
    expect(g.lives).toBe(4);
  });
  it('lives hitting 0 sets over', () => {
    const g = createGame(1);
    g.lives = 1;
    withOneCustomer(g, 'soldier');
    tickCustomers(g, 13);
    expect(g.lives).toBe(0);
    expect(g.over).toBe(true);
  });
  it('does not advance once over', () => {
    const g = createGame(1);
    g.over = true;
    const c = withOneCustomer(g);
    tickCustomers(g, 100);
    expect(c.t).toBe(0);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인** — `... -t "초조"` → FAIL.

- [ ] **Step 3: logic.js 추가**
```js
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
```

- [ ] **Step 4: 통과 확인** — `... -t "초조"` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): patience gauge, walkout, lives, game over"
```

---

### Task 3: serve 다수 손님 (가장 가까운 손님) (logic)

**Files:** Modify `logic.js`, `logic.test.ts`

- [ ] **Step 1: 테스트 갱신 (옛 단일-customer serve 교체)**

import에서 `CUSTOMER_SLOT`(단수)를 제거하고 `CUSTOMER_SLOTS`만 남긴다. Plan 2의 `describe('serve (완성도 + 정확)', ...)` 블록을 아래로 교체:
```ts
describe('serve (가장 가까운 손님)', () => {
  function customerAt(g, slot, spice, arche = 'student') {
    const c = { id: g._nextId++, slot, archetype: arche, order: { spice }, t: 0 };
    g.customers.push(c);
    return c;
  }
  function doneBowl(spice, doneness = 50) { return { stage: 'done', doneness, spice }; }

  it('serves the nearest in-range customer, scoring completeness + accuracy', () => {
    const g = createGame(1);
    const c = customerAt(g, 1, 'extra'); // slot 1 = x:-1
    const slot = CUSTOMER_SLOTS[1];
    g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(SERVE_BASE + 50 + 30);
    expect(g.player.holding).toBe(null);
    expect(g.customers.find((x) => x.id === c.id)).toBeUndefined(); // left satisfied
  });
  it('omits accuracy when spice is wrong', () => {
    const g = createGame(1);
    customerAt(g, 0, 'none');
    const slot = CUSTOMER_SLOTS[0];
    g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 20);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(SERVE_BASE + 20);
  });
  it('refuses when no customer is in range', () => {
    const g = createGame(1);
    customerAt(g, 3, 'normal'); // far slot
    g.player.holding = doneBowl('normal', 50); // chef at origin
    expect(serve(g)).toBe(false);
    expect(g.score).toBe(0);
  });
  it('refuses a non-done bowl', () => {
    const g = createGame(1);
    customerAt(g, 0, 'normal');
    const slot = CUSTOMER_SLOTS[0];
    g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = { stage: 'brothed', doneness: 50 };
    expect(serve(g)).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인** — `... -t "가장 가까운"` → FAIL.

- [ ] **Step 3: logic.js — serve 교체**

Plan 2의 `serve` 함수를 아래로 교체:
```js
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
```

- [ ] **Step 4: 통과 확인** — `... -t "가장 가까운"` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): serve the nearest in-range customer"
```

---

### Task 4: 멀티 채반 slots[] (logic)

**Files:** Modify `logic.js`, `logic.test.ts`

- [ ] **Step 1: 테스트 갱신 (옛 단일 채반 → 멀티슬롯)**

import에서 `blancherProgress`를 제거하고 `slotProgress`를 추가. Plan 2의 `describe('데치기 채반 (putIn / tick / lift)', ...)` 블록을 교체:
```ts
describe('멀티 채반 (slots)', () => {
  function atBlancher(g) {
    g.player.x = STATIONS.blancher.x; g.player.z = STATIONS.blancher.z;
    return g;
  }
  it('putInBlancher fills the first free slot, freeing hands', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' };
    expect(putInBlancher(g)).toBe(true);
    expect(g.player.holding).toBe(null);
    expect(g.blancher.slots[0]).toEqual({ t: 0 });
    expect(g.blancher.slots[1]).toBe(null);
  });
  it('two noodles fill both slots; a third is refused', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' }; putInBlancher(g);
    g.player.holding = { stage: 'noodle' }; putInBlancher(g);
    expect(g.blancher.slots.every((s) => s !== null)).toBe(true);
    g.player.holding = { stage: 'noodle' };
    expect(putInBlancher(g)).toBe(false); // no free slot
  });
  it('tickBlancher advances all slots; slotProgress = t / BLANCH_TIME', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' }; putInBlancher(g);
    tickBlancher(g, BLANCH_TIME * 0.8);
    expect(slotProgress(g.blancher.slots[0])).toBeCloseTo(0.8, 5);
  });
  it('liftFromBlancher takes the MOST-cooked slot, scored by doneness', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' }; putInBlancher(g); // slot 0
    tickBlancher(g, BLANCH_TIME * 0.8);                        // slot 0 at 0.8
    g.player.holding = { stage: 'noodle' }; putInBlancher(g); // slot 1 (t=0)
    expect(liftFromBlancher(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'blanched', doneness: 50 }); // slot 0 (more cooked)
    expect(g.blancher.slots[0]).toBe(null);
    expect(g.blancher.slots[1]).not.toBe(null);
  });
  it('liftFromBlancher does nothing with all slots empty', () => {
    const g = atBlancher(createGame(1));
    expect(liftFromBlancher(g)).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인** — `... -t "멀티 채반"` → FAIL.

- [ ] **Step 3: logic.js — putIn/tick/lift 교체, blancherProgress→slotProgress**

`putInBlancher`, `tickBlancher`, `blancherProgress`, `liftFromBlancher`를 아래로 교체:
```js
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
```

- [ ] **Step 4: 전체 유닛 green 확인** — `npx vitest run __tests__/unit/garak-guksu/logic.test.ts` → 전체 PASS. 옛 단일 customer/채반 테스트는 사라지고 새 테스트로 대체됐다. createGame 테스트(Plan 1/2 잔재)가 남아 있으면 새 구조(`blancher.slots`, `customers: []`, `lives`, `over`)에 맞게 갱신한다.

> NOTE: Plan 2의 `describe('createGame', ...)`는 옛 `customer`/`blancher.bowl` 구조를 단언하므로 이 시점에 깨진다. 그 테스트를 새 구조로 갱신하라:
> ```ts
> it('starts with empty hands, no customers, two empty baskets, 5 lives', () => {
>   const g = createGame(1);
>   expect(g.player).toEqual({ x: 0, z: 0, holding: null });
>   expect(g.customers).toEqual([]);
>   expect(g.blancher.slots).toEqual([null, null]);
>   expect(g.lives).toBe(5);
>   expect(g.over).toBe(false);
>   expect(g.score).toBe(0);
> });
> ```
> (옛 `customer`/`KITCHEN bounds` 단언은 유지하거나 정리. KITCHEN 테스트는 그대로 둔다.)

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): multi-basket blancher (juggle 2 noodles)"
```

---

### Task 5: 다수 손님 렌더 + 초조/채반 게이지 (models + scene)

**Files:** Modify `models.js`, `scene.js`

- [ ] **Step 1: models.js — 손님 색 인자 + 초조 게이지 재사용**

`createCustomer()` 를 `createCustomer(color)` 로 (아키타입별 색). `createGauge`는 이미 있음(재사용). 추가로 손님 머리 위 작은 초조 바를 위해 `createGauge`를 그대로 쓴다(작게 스케일). `createCustomer` 변경:
```js
export function createCustomer(color = 0x4a6a8a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.7, 6, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  body.position.y = 0.75; body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.7 })
  );
  head.position.y = 1.45; head.castShadow = true;
  g.add(body, head);
  return g;
}
```

- [ ] **Step 2: scene.js — 슬롯별 손님 풀 + 초조 게이지 + 멀티 채반 게이지**

`scene.js`를 갱신한다. import 교체:
```js
import * as THREE from 'three';
import { createFloor, createChef, createStation, createCustomer, createGauge } from './models.js';
import { STATIONS, CUSTOMER_SLOTS, ARCHETYPES, slotProgress, patienceProgress, BLANCH_SLOTS } from './logic.js';
```
손님/게이지 셋업 — 기존 단일 customer 블록을 슬롯 풀로 교체(스테이션 루프·chef·heldBowl·gauge는 유지하되 blancher gauge를 슬롯 수만큼):
```js
  // archetype display colors (Plan 6 polish refines these)
  const ARCH_COLOR = { soldier: 0x4a6a4a, worker: 0x4a5a8a, student: 0x8a7a4a, couple: 0xaa5a7a, granny: 0x8a8a8a };

  // one reusable customer mesh + patience gauge per counter slot
  const slotCustomers = CUSTOMER_SLOTS.map((pos) => {
    const c = createCustomer();
    c.position.set(pos.x, 0, pos.z); c.visible = false;
    scene.add(c);
    const pg = createGauge();
    pg.scale.set(0.6, 0.6, 0.6);
    pg.position.set(pos.x, 2.0, pos.z);
    pg.rotation.x = -0.2;
    scene.add(pg);
    return { mesh: c, body: c.children[0], gauge: pg, fill: pg.getObjectByName('fill') };
  });

  // one gauge per blancher slot, fanned out over the blancher
  const slotGauges = Array.from({ length: BLANCH_SLOTS }, (_, i) => {
    const gg = createGauge();
    gg.scale.set(0.8, 0.8, 0.8);
    gg.position.set(STATIONS.blancher.x + (i - (BLANCH_SLOTS - 1) / 2) * 0.5, 1.6 + i * 0.25, STATIONS.blancher.z);
    gg.rotation.x = -0.35;
    scene.add(gg);
    return { group: gg, fill: gg.getObjectByName('fill') };
  });
```
(Plan 2의 single `customer`/single `gauge` add-block과 `heldBowl`/`gaugeFill` refs는 제거하고 위로 대체. chef·stations·floor 추가는 유지.) `sync(state)` 교체:
```js
  function gaugeColor(p) { return p > 0.9 ? 0xff5a5a : (p >= 0.7 && p <= 0.9) ? 0x6dff8f : 0xffcf6a; }
  function setGaugeFill(fill, p, color) {
    fill.scale.x = Math.min(1, p);
    fill.position.x = -(1 - Math.min(1, p)) * 0.5;
    fill.material.color.setHex(color);
  }

  function sync(state) {
    chef.position.set(state.player.x, 0, state.player.z);
    heldBowl.visible = state.player.holding !== null;

    // customers by slot
    const bySlot = new Map(state.customers.map((c) => [c.slot, c]));
    slotCustomers.forEach((sc, i) => {
      const c = bySlot.get(i);
      sc.mesh.visible = !!c;
      sc.gauge.visible = !!c;
      if (c) {
        sc.body.material.color.setHex(ARCH_COLOR[c.archetype] ?? 0x4a6a8a);
        const pp = patienceProgress(c);
        // patience: green when calm → red when about to leave
        setGaugeFill(sc.fill, pp, pp > 0.75 ? 0xff5a5a : pp > 0.5 ? 0xffcf6a : 0x6dff8f);
      }
    });

    // blancher slots
    slotGauges.forEach((sg, i) => {
      const slot = state.blancher.slots[i];
      sg.group.visible = !!slot;
      if (slot) { const p = slotProgress(slot); setGaugeFill(sg.fill, p, gaugeColor(p)); }
    });
  }
```

- [ ] **Step 3: 커밋**
```bash
git add public/garak-guksu/src/models.js public/garak-guksu/src/scene.js
git commit -m "feat(garak-guksu): render customer pool + patience/basket gauges"
```

---

### Task 6: main 배선 + 스폰/초조 tick + 라이프 HUD + 게임오버 + E2E

**Files:** Modify `main.js`, `index.html`, `e2e/garak-guksu.spec.ts`

- [ ] **Step 1: index.html — HUD에 라이프 추가**

`#hud` 안 `점수` span 앞이나 뒤에 추가:
```html
    <span class="lives" id="lives" aria-label="라이프">❤❤❤❤❤</span>
```
그리고 `#result` 오버레이의 `#result-sub`는 그대로 둔다(게임오버 문구를 main이 채운다).

- [ ] **Step 2: main.js — 갱신**

`main.js`에서: (a) import에 `tickSpawns, tickCustomers, ARCHETYPES` 추가하고 `CUSTOMER_SLOT`→없음(serve가 내부에서 처리하니 import 불필요), `blancherProgress`→제거; (b) 루프에 spawn/customer tick + 게임오버 체크; (c) renderHud에 라이프; (d) `__garak`에 customers/lives/over/tickSpawns/tickCustomers 노출. 구체:

import 줄을:
```js
import {
  createGame, movePlayer, near, STATIONS,
  setNoodle, putInBlancher, liftFromBlancher, tickBlancher, tickSpawns, tickCustomers,
  pourBroth, garnish, serve,
} from './logic.js';
```
`action()`의 `serve` 분기를 손님 근처가 아니라 "그 외 = serve 시도"로 단순화(serve가 내부에서 가까운 손님 판단):
```js
function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) setNoodle(state);
  else if (near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    if (state.blancher.slots.some((s) => s)) liftFromBlancher(state); else putInBlancher(state);
  } else if (near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) pourBroth(state);
  else serve(state); // serve picks the nearest in-range customer (no-op if none)
  renderHud();
}
```
`renderHud`:
```js
function renderHud() {
  $('score').textContent = state.score;
  $('lives').textContent = '❤'.repeat(Math.max(0, state.lives)) || '—';
  const nearby = nearestCustomer();
  $('order').textContent = nearby ? SPICE_KO[nearby.order.spice] : '-';
  $('held').textContent = state.player.holding ? STAGE_KO[state.player.holding.stage] : '빈손';
}
function nearestCustomer() {
  const p = state.player; let best = null, bestD = Infinity;
  for (const c of state.customers) {
    const slot = CUSTOMER_SLOTS_REF[c.slot];
    const d = (p.x - slot.x) ** 2 + (p.z - slot.z) ** 2;
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}
```
> NOTE: `renderHud` needs CUSTOMER_SLOTS for nearestCustomer. Add `CUSTOMER_SLOTS` to the import and alias `const CUSTOMER_SLOTS_REF = CUSTOMER_SLOTS;` OR just import CUSTOMER_SLOTS and use it directly. Simpler: import `CUSTOMER_SLOTS` and use it in nearestCustomer.

loop에 tick + game over:
```js
function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  movePlayer(state, input.getMoveDir(), dt);
  tickBlancher(state, dt);
  tickSpawns(state, dt);
  tickCustomers(state, dt);
  scene.sync(state);
  scene.render();
  renderHud(); // HUD updates each frame now (patience changes over time)
  if (state.over) { running = false; gameOver(); return; }
  rafId = requestAnimationFrame(loop);
}

function gameOver() {
  $('result-title').textContent = '영업 종료';
  $('result-sub').textContent = `점수 ${state.score} · 손님 ${state.lives <= 0 ? '너무 많이 놓쳤습니다' : '마감'}`;
  $('result').classList.remove('off');
}
```
`__garak`에 추가:
```js
  get customers() { return state.customers; },
  get lives() { return state.lives; },
  get over() { return state.over; },
  tickSpawns(dt) { tickSpawns(state, dt); },
  tickCustomers(dt) { tickCustomers(state, dt); },
```
(기존 STATIONS/score/holding/teleport/setNoodle/putInBlancher/tick/liftFromBlancher/pourBroth/garnish/serve 유지. `order`/`progress` getter는 단일 가정이라 제거하거나 nearestCustomer 기반으로. 제거 권장.)

- [ ] **Step 3: e2e — 멀티 손님 풀 사이클 + 이탈/게임오버**

`e2e/garak-guksu.spec.ts`의 3번째 테스트를 교체(mount/hub 유지):
```ts
test('spawns a customer, serves them via the pipeline, scores', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();

  const result = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak; const S = g.STATIONS;
    g.tickSpawns(2.5);                       // force one spawn
    const c = g.customers[0];
    // cook a perfect bowl matching the order
    g.teleport(S.setting.x, S.setting.z); g.setNoodle();
    g.teleport(S.blancher.x, S.blancher.z); g.putInBlancher();
    g.tick(2.5 * 0.8);
    g.liftFromBlancher();
    g.teleport(S.broth.x, S.broth.z); g.pourBroth();
    g.teleport(S.garnish.x, S.garnish.z); g.garnish(c.order.spice);
    // teleport to the customer's slot and serve
    const slot = [{x:-3,z:3.2},{x:-1,z:3.2},{x:1,z:3.2},{x:3,z:3.2}][c.slot];
    g.teleport(slot.x, slot.z); g.serve();
    return { score: g.score, remaining: g.customers.length };
  });
  expect(result.score).toBe(180); // 100 + 50 + 30
  expect(result.remaining).toBe(0);
});

test('a timed-out customer costs a life', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();
  const lives = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    g.tickSpawns(2.5);          // one customer
    g.tickCustomers(30);        // way past any patience → walkout
    return g.lives;
  });
  expect(lives).toBe(4);
});
```

- [ ] **Step 4: 게이트 실행**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium` → 4 tests PASS.
Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts` → 전체 PASS.

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/main.js public/garak-guksu/index.html e2e/garak-guksu.spec.ts
git commit -m "feat(garak-guksu): wire spawn/patience loop + lives HUD + game over + e2e"
```

---

## Plan 3 완료 기준

- 손님이 슬롯에 시차로 스폰되고(5아키타입, 색/인내심 다름), 각자 머리 위 초조 게이지가 차오른다.
- 두 채반을 동시에 돌려(저글링) 데치고, 파이프라인을 거쳐 가장 가까운 손님에게 배식한다.
- 인내심을 넘긴 손님은 떠나며 라이프(❤×5)가 깎이고, 0이 되면 "영업 종료".
- 유닛 + E2E(스폰·배식·이탈) green.

**다음:** Plan 4(웨이브 + 시대 곡선(증기→디젤→막차) + 정차 타이머 + 완주). 무한 스폰을 웨이브 구조로 감싸고 정차 타이머를 전체 데드라인으로 얹는다.
