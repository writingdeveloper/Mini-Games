# 가락국수 Plan 2: 조리 4단계 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 1의 단일-스텝 `interact`를 **사리세팅 → 데치기(타이밍·완성도) → 육수 → 마감(고춧가루 변형)** 4스테이션 파이프라인으로 교체하고, 손님 주문(고춧가루 변형)과 배식 정확도 + 완성도 점수를 더한다.

**Architecture:** 순수 시뮬레이션(`logic.js`)에 그릇 상태머신(noodle→blanched→brothed→done)과 데치기 시간 모델(`blancher.bowl.t`, 매 프레임 tick)을 추가한다. `serve`는 완성도(데치기) + 정확(주문 일치) 점수로 확장한다. 렌더(`scene.js`/`models.js`)는 4스테이션 + 데치기 게이지 메시를, `main.js`는 스테이션별 액션 라우팅 + 데치기 tick + 변형 입력(1/2/3)을 더한다. `interact`/`COOK_STATION`(Plan 1)은 제거된다.

**Tech Stack:** 기존과 동일 — Three.js 0.184.0 ESM · 순수 `logic.js` · Vitest · Playwright(:3099) · `__garak` 디버그 훅.

**작업 트리:** worktree `Mini-Games-garak`(브랜치 `feat/garak-guksu`). 모든 경로 상대.

**현재 상태(Plan 1 완료):** `logic.js`는 `createGame`(player.holding=null|'bowl', customer{present,served}, score), `interact`(COOK_STATION에서 'bowl'), `serve`(+100), `movePlayer`/`near`/`clamp`/`dist2` 보유. `main.js`의 `action()`은 COOK_STATION이면 interact, CUSTOMER_SLOT이면 serve. 12 유닛 + 3 E2E green.

> ⚠️ **스코프 경계(이 plan에서 제거/대체):** `interact`와 `COOK_STATION`은 Plan 2가 대체한다. Plan 1의 E2E 3번째 테스트('serving a bowl scores via the core loop')는 단일-스텝 흐름을 가정하므로 **Task 5에서 4단계 흐름으로 갱신**한다.

---

### Task 1: 그릇 상태머신 + 스테이션 + 사리세팅 + 데치기 (logic)

조리 파이프라인의 앞 절반: 사리세팅대에서 면을 담고, 데치기 채반에 넣어 시간 게이지를 돌리고, 적정 타이밍에 건져 완성도를 매긴다.

**Files:**
- Modify: `public/garak-guksu/src/logic.js`
- Test: `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`logic.test.ts`의 단일 import 줄에 `STATIONS, setNoodle, putInBlancher, tickBlancher, blancherProgress, liftFromBlancher, donenessScore, BLANCH_TIME` 를 추가하고, 아래 describe들을 덧붙인다:
```ts
describe('setNoodle (사리세팅대)', () => {
  it('puts a noodle bowl in empty hands at the setting station', () => {
    const g = createGame(1);
    g.player.x = STATIONS.setting.x; g.player.z = STATIONS.setting.z;
    expect(setNoodle(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'noodle' });
  });
  it('does nothing away from the station or with full hands', () => {
    const g = createGame(1);
    expect(setNoodle(g)).toBe(false); // at origin
  });
});

describe('donenessScore', () => {
  it('perfect in [0.75,0.85], good in [0.7,0.9], else 0', () => {
    expect(donenessScore(0.80)).toBe(50);
    expect(donenessScore(0.72)).toBe(20);
    expect(donenessScore(0.88)).toBe(20);
    expect(donenessScore(0.5)).toBe(0);  // 덜익음
    expect(donenessScore(1.0)).toBe(0);  // 불음
  });
});

describe('데치기 채반 (putIn / tick / lift)', () => {
  function atBlancherWithNoodle() {
    const g = createGame(1);
    g.player.x = STATIONS.blancher.x; g.player.z = STATIONS.blancher.z;
    g.player.holding = { stage: 'noodle' };
    return g;
  }
  it('putInBlancher moves the noodle bowl into the basket, freeing hands', () => {
    const g = atBlancherWithNoodle();
    expect(putInBlancher(g)).toBe(true);
    expect(g.player.holding).toBe(null);
    expect(g.blancher.bowl).toEqual({ t: 0 });
  });
  it('tickBlancher advances time and progress = t / BLANCH_TIME', () => {
    const g = atBlancherWithNoodle();
    putInBlancher(g);
    tickBlancher(g, BLANCH_TIME * 0.8);
    expect(blancherProgress(g)).toBeCloseTo(0.8, 5);
  });
  it('liftFromBlancher gives a blanched bowl scored by doneness', () => {
    const g = atBlancherWithNoodle();
    putInBlancher(g);
    tickBlancher(g, BLANCH_TIME * 0.8); // perfect window
    expect(liftFromBlancher(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'blanched', doneness: 50 });
    expect(g.blancher.bowl).toBe(null);
  });
  it('liftFromBlancher does nothing with an empty basket', () => {
    const g = createGame(1);
    g.player.x = STATIONS.blancher.x; g.player.z = STATIONS.blancher.z;
    expect(liftFromBlancher(g)).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: FAIL (STATIONS / setNoodle 등 미정의).

- [ ] **Step 3: logic.js 수정 — createGame 확장 + 데치기 추가**

`createGame`을 아래로 교체하고(시드 RNG + 상태 확장), 파일 끝에 데치기 코드를 추가한다. **Plan 1의 `COOK_STATION` 상수와 `interact` 함수는 삭제한다**(Task 3·5에서 호출처가 사라진다):
```js
// (파일 상단) COOK_STATION 줄을 삭제하고 STATIONS로 교체:
// The four cook stations, left→right across the back of the kitchen.
export const STATIONS = {
  setting:  { x: -3, z: -1.5 }, // 빈 그릇 + 면사리
  blancher: { x: -1, z: -1.5 }, // 데치기 채반
  broth:    { x:  1, z: -1.5 }, // 육수솥
  garnish:  { x:  3, z: -1.5 }, // 고명·고춧가루대
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
    // holding: null
    //   | { stage:'noodle' }
    //   | { stage:'blanched', doneness }
    //   | { stage:'brothed', doneness }
    //   | { stage:'done', doneness, spice }
    blancher: { bowl: null }, // bowl: null | { t }  (t = seconds in the basket)
    customer: { present: true, served: false, order: { spice: SPICES[Math.floor(rng() * 3)] } },
    score: 0,
    _rng: rng,
  };
}
```
```js
// (파일 끝에 추가) ----- 데치기 파이프라인 앞 절반 -----
export const BLANCH_TIME = 2.5; // seconds to reach progress 1.0

// progress (t / BLANCH_TIME) -> doneness points. Sweet spot is the [0.7,0.9] band,
// perfect at the [0.75,0.85] core. Under = 덜익음, over = 불음(떡) -> 0.
export function donenessScore(progress) {
  if (progress >= 0.75 && progress <= 0.85) return 50;
  if (progress >= 0.7 && progress <= 0.9) return 20;
  return 0;
}

// At the setting station, empty-handed -> a noodle bowl.
export function setNoodle(state) {
  const p = state.player;
  if (p.holding === null && near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) {
    p.holding = { stage: 'noodle' };
    return true;
  }
  return false;
}

// At the blancher with a noodle bowl + empty basket -> drop it in (hands free).
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

// Advance the basket timer (called each frame from the loop).
export function tickBlancher(state, dt) {
  if (state.blancher.bowl) state.blancher.bowl.t += dt;
}

export function blancherProgress(state) {
  return state.blancher.bowl ? state.blancher.bowl.t / BLANCH_TIME : 0;
}

// At the blancher with a basket + empty hands -> lift, scoring doneness by progress.
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
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: FAIL — 기존 interact/serve 테스트가 createGame 변경/ interact 삭제로 깨진다. **이는 Task 3에서 정리한다.** 이 태스크에서 새로 추가한 setNoodle/doneness/데치기 테스트는 PASS여야 한다. 새 테스트만 돌려 확인: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts -t "사리세팅\|donenessScore\|데치기"` → 이 그룹은 PASS.

> NOTE: createGame이 바뀌고 interact가 삭제되므로 Plan 1의 `interact` describe와 `serve` describe가 빨개진다. Task 3에서 serve를 새 점수 모델로 갱신하고 interact 테스트를 제거한다. 그때 전체 스위트가 다시 green이 된다. 지금은 새 테스트 그룹이 green인 것만 확인하고 다음 단계로.

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): cooking pipeline front half (setting + blancher timing)"
```

---

### Task 2: 육수 + 마감 변형 (logic)

파이프라인 뒷 절반: 육수를 붓고, 마감대에서 주문 변형(고춧가루)을 적용해 그릇을 완성한다.

**Files:**
- Modify: `public/garak-guksu/src/logic.js`
- Test: `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

import에 `pourBroth, garnish` 추가, describe 덧붙임:
```ts
describe('육수 + 마감 (pourBroth / garnish)', () => {
  function holdingBlanched(g, doneness = 50) {
    g.player.holding = { stage: 'blanched', doneness };
  }
  it('pourBroth turns a blanched bowl into a brothed one, keeping doneness', () => {
    const g = createGame(1);
    g.player.x = STATIONS.broth.x; g.player.z = STATIONS.broth.z;
    holdingBlanched(g, 50);
    expect(pourBroth(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'brothed', doneness: 50 });
  });
  it('pourBroth does nothing on a non-blanched bowl', () => {
    const g = createGame(1);
    g.player.x = STATIONS.broth.x; g.player.z = STATIONS.broth.z;
    g.player.holding = { stage: 'noodle' };
    expect(pourBroth(g)).toBe(false);
  });
  it('garnish finishes a brothed bowl with the chosen spice', () => {
    const g = createGame(1);
    g.player.x = STATIONS.garnish.x; g.player.z = STATIONS.garnish.z;
    g.player.holding = { stage: 'brothed', doneness: 20 };
    expect(garnish(g, 'extra')).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'done', doneness: 20, spice: 'extra' });
  });
  it('garnish rejects an invalid spice or non-brothed bowl', () => {
    const g = createGame(1);
    g.player.x = STATIONS.garnish.x; g.player.z = STATIONS.garnish.z;
    g.player.holding = { stage: 'brothed', doneness: 20 };
    expect(garnish(g, 'ketchup')).toBe(false);
    g.player.holding = { stage: 'noodle' };
    expect(garnish(g, 'normal')).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts -t "육수"`
Expected: FAIL (pourBroth/garnish 미정의).

- [ ] **Step 3: logic.js에 추가**

```js
// At the broth station with a blanched bowl -> add broth (doneness carries over).
export function pourBroth(state) {
  const p = state.player;
  if (p.holding && p.holding.stage === 'blanched' &&
      near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) {
    p.holding = { stage: 'brothed', doneness: p.holding.doneness };
    return true;
  }
  return false;
}

// At the garnish station with a brothed bowl -> finish it with a valid spice.
export function garnish(state, spice) {
  const p = state.player;
  if (p.holding && p.holding.stage === 'brothed' && SPICES.includes(spice) &&
      near(p.x, p.z, STATIONS.garnish.x, STATIONS.garnish.z)) {
    p.holding = { stage: 'done', doneness: p.holding.doneness, spice };
    return true;
  }
  return false;
}
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts -t "육수"`
Expected: PASS (4 tests in that group).

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): broth + garnish finish the bowl with spice"
```

---

### Task 3: 배식 정확도 + 점수 (serve 교체) + Plan 1 잔재 정리 (logic)

`serve`를 완성도 + 정확 점수 모델로 교체하고, Plan 1의 `interact` 테스트를 제거해 전체 스위트를 다시 green으로 만든다.

**Files:**
- Modify: `public/garak-guksu/src/logic.js`
- Test: `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 테스트 갱신 (interact 제거 + serve 재작성)**

`logic.test.ts`에서:
1. import 줄에서 `interact`를 제거하고 `SERVE_BASE` 를 추가 (serve/SERVE_POINTS는 아래 참고).
2. Plan 1의 `describe('interact (cook station)', ...)` 블록을 **통째로 삭제**.
3. Plan 1의 `describe('serve (customer)', ...)` 블록을 아래로 **교체**:
```ts
describe('serve (완성도 + 정확)', () => {
  function doneBowl(spice, doneness = 50) {
    return { stage: 'done', doneness, spice };
  }
  it('scores base + doneness + accuracy when the spice matches the order', () => {
    const g = createGame(1);
    g.customer.order.spice = 'extra';
    g.player.x = CUSTOMER_SLOT.x; g.player.z = CUSTOMER_SLOT.z;
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(SERVE_BASE + 50 + 30); // 100 + 완성도 + 정확
    expect(g.player.holding).toBe(null);
    expect(g.customer).toMatchObject({ present: false, served: true });
  });
  it('omits the accuracy bonus when the spice is wrong', () => {
    const g = createGame(1);
    g.customer.order.spice = 'none';
    g.player.x = CUSTOMER_SLOT.x; g.player.z = CUSTOMER_SLOT.z;
    g.player.holding = doneBowl('extra', 20);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(SERVE_BASE + 20); // 정확 0
  });
  it('refuses a bowl that is not done', () => {
    const g = createGame(1);
    g.player.x = CUSTOMER_SLOT.x; g.player.z = CUSTOMER_SLOT.z;
    g.player.holding = { stage: 'brothed', doneness: 50 };
    expect(serve(g)).toBe(false);
    expect(g.score).toBe(0);
  });
  it('refuses when far from the customer', () => {
    const g = createGame(1);
    g.player.holding = doneBowl('normal', 50);
    expect(serve(g)).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: FAIL (SERVE_BASE 미정의 + serve가 옛 'bowl' 모델 + interact 삭제로 import 에러 없으면 serve 로직 불일치).

- [ ] **Step 3: logic.js — interact 삭제, serve 교체, 상수 정리**

`logic.js`에서:
1. `export function interact(state){...}` 와 그 주석을 **삭제**.
2. `export const SERVE_POINTS = 100;` 를 `export const SERVE_BASE = 100;` 로 바꾸고, `serve`를 아래로 교체:
```js
export const SERVE_BASE = 100;
export const ACCURACY_BONUS = 30;

// At the customer with a DONE bowl -> serve. Score = base + doneness(완성도) +
// accuracy(주문 일치). Clears hands, customer leaves satisfied.
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
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: PASS — 전체 스위트 green (createGame/movePlayer/clamp/near/setNoodle/doneness/데치기/육수/serve). interact 테스트는 사라졌다.

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): serve scores completeness + order accuracy (drop Plan 1 single-step)"
```

---

### Task 4: 4스테이션 메시 + 데치기 게이지 시각 (models + scene)

**Files:**
- Modify: `public/garak-guksu/src/models.js`
- Modify: `public/garak-guksu/src/scene.js`

- [ ] **Step 1: models.js — 스테이션을 종류별 색으로 구분 + 게이지 바**

`createStation()` 을 `createStation(kind)` 로 바꿔 종류별 색을 입히고, 데치기 게이지용 작은 바 팩토리를 추가한다:
```js
const STATION_COLORS = {
  setting:  0xb08d57, // 나무 도마색
  blancher: 0x9aa3ad, // 스테인리스 채반
  broth:    0x7a5a3a, // 육수솥(놋)
  garnish:  0xc23b3b, // 고춧가루대(붉은)
};

export function createStation(kind = 'blancher') {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.7, 18),
    new THREE.MeshStandardMaterial({ color: STATION_COLORS[kind] ?? 0x9aa3ad, metalness: 0.4, roughness: 0.5 })
  );
  pot.position.y = 0.55; pot.castShadow = true; pot.receiveShadow = true;
  g.add(pot);
  return g;
}

// A thin progress bar that floats over the blancher; scaleX 0..1 by progress,
// color amber→green in the sweet spot→red when overcooked. Returned group has
// the fill mesh named 'fill'.
export function createGauge() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.12, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x222831 })
  );
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.12, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffcf6a })
  );
  fill.name = 'fill';
  fill.position.z = 0.01;
  g.add(bg, fill);
  g.visible = false;
  return g;
}
```

- [ ] **Step 2: scene.js — 4스테이션 배치 + 게이지 + sync 확장**

`scene.js`를 아래로 갱신한다. import에 `createGauge` 추가, `COOK_STATION` 대신 `STATIONS`/`blancherProgress` import:
```js
import * as THREE from 'three';
import { createFloor, createChef, createStation, createCustomer, createGauge } from './models.js';
import { STATIONS, CUSTOMER_SLOT, blancherProgress } from './logic.js';
```
스테이션 생성 부분(기존 단일 station)을 4개 루프로 교체하고, 데치기 위에 게이지를 둔다:
```js
  scene.add(createFloor());
  for (const [kind, pos] of Object.entries(STATIONS)) {
    const s = createStation(kind);
    s.position.set(pos.x, 0, pos.z);
    scene.add(s);
  }
  const gauge = createGauge();
  gauge.position.set(STATIONS.blancher.x, 1.6, STATIONS.blancher.z);
  gauge.rotation.x = -0.35;
  scene.add(gauge);

  const customer = createCustomer();
  customer.position.set(CUSTOMER_SLOT.x, 0, CUSTOMER_SLOT.z);
  scene.add(customer);
  const chef = createChef();
  scene.add(chef);
  const heldBowl = chef.getObjectByName('heldBowl');
  const gaugeFill = gauge.getObjectByName('fill');
```
`sync(state)`를 교체 — 그릇 표시(들고 있으면 visible), 데치기 게이지 갱신:
```js
  function sync(state) {
    chef.position.set(state.player.x, 0, state.player.z);
    heldBowl.visible = state.player.holding !== null;
    customer.visible = state.customer.present;
    const p = blancherProgress(state);
    gauge.visible = state.blancher.bowl !== null;
    if (gauge.visible) {
      gaugeFill.scale.x = Math.min(1, p);
      gaugeFill.position.x = -(1 - Math.min(1, p)) * 0.5; // left-anchored fill
      const inBand = p >= 0.7 && p <= 0.9;
      gaugeFill.material.color.setHex(p > 0.9 ? 0xff5a5a : inBand ? 0x6dff8f : 0xffcf6a);
    }
  }
```

- [ ] **Step 3: 커밋** (E2E는 Task 5에서)

```bash
git add public/garak-guksu/src/models.js public/garak-guksu/src/scene.js
git commit -m "feat(garak-guksu): four station meshes + blancher doneness gauge"
```

---

### Task 5: main 라우팅 + tick + 변형 입력 + HUD + E2E

스테이션별 액션 라우팅, 데치기 tick, 마감 변형 입력(1/2/3), HUD(게이지·주문), 그리고 4단계 풀 사이클 E2E.

**Files:**
- Modify: `public/garak-guksu/src/main.js`
- Modify: `public/garak-guksu/index.html`
- Modify: `e2e/garak-guksu.spec.ts`

- [ ] **Step 1: index.html — HUD에 주문/단계 표시 추가**

`#hud` 안 `점수` span 뒤에 추가:
```html
    <span>주문 <span id="order">-</span></span>
    <span>들고 <span id="held">빈손</span></span>
```

- [ ] **Step 2: main.js — 전면 갱신 (라우팅 + tick + 변형 입력 + HUD)**

`main.js`를 아래로 교체:
```js
import {
  createGame, movePlayer, near, STATIONS, CUSTOMER_SLOT,
  setNoodle, putInBlancher, liftFromBlancher, tickBlancher, blancherProgress,
  pourBroth, garnish, serve,
} from './logic.js';
import { createScene } from './scene.js';
import { createInput } from './input.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const scene = createScene(canvas);

const SPICE_KO = { none: '안 맵게', normal: '기본', extra: '고춧가루 많이' };
const STAGE_KO = { noodle: '면사리', blanched: '데친 면', brothed: '육수', done: '완성' };

let state = createGame(seedNow());
let running = false;
let last = 0;
let rafId = 0;

function seedNow() { return ((performance.now() | 0) ^ 0x9e3779b9) >>> 0; }

// E/Space: do the action for whichever station the chef is nearest.
function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) setNoodle(state);
  else if (near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    if (state.blancher.bowl) liftFromBlancher(state); else putInBlancher(state);
  } else if (near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) pourBroth(state);
  else if (near(p.x, p.z, CUSTOMER_SLOT.x, CUSTOMER_SLOT.z)) serve(state);
  renderHud();
}
const input = createInput(action);
canvas.addEventListener('pointerdown', action);

// 1/2/3 at the garnish station -> finish with 안맵게 / 기본 / 많이.
const SPICE_KEYS = { Digit1: 'none', Digit2: 'normal', Digit3: 'extra' };
addEventListener('keydown', (e) => {
  const spice = SPICE_KEYS[e.code];
  if (!spice || !running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.garnish.x, STATIONS.garnish.z)) { garnish(state, spice); renderHud(); }
});

function renderHud() {
  $('score').textContent = state.score;
  $('order').textContent = state.customer.present ? SPICE_KO[state.customer.order.spice] : '-';
  $('held').textContent = state.player.holding ? STAGE_KO[state.player.holding.stage] : '빈손';
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  movePlayer(state, input.getMoveDir(), dt);
  tickBlancher(state, dt);
  scene.sync(state);
  scene.render();
  rafId = requestAnimationFrame(loop);
}

function start() {
  if (rafId) cancelAnimationFrame(rafId);
  state = createGame(seedNow());
  running = true;
  $('start').classList.add('off');
  $('result').classList.add('off');
  renderHud();
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}

$('startbtn').addEventListener('click', start);
$('replaybtn').addEventListener('click', start);

window.__garak = {
  STATIONS, CUSTOMER_SLOT,
  get score() { return state.score; },
  get holding() { return state.player.holding; },
  get order() { return state.customer.order; },
  get progress() { return blancherProgress(state); },
  teleport(x, z) { state.player.x = x; state.player.z = z; },
  setNoodle() { setNoodle(state); renderHud(); },
  putInBlancher() { putInBlancher(state); renderHud(); },
  tick(dt) { tickBlancher(state, dt); },
  liftFromBlancher() { liftFromBlancher(state); renderHud(); },
  pourBroth() { pourBroth(state); renderHud(); },
  garnish(spice) { garnish(state, spice); renderHud(); },
  serve() { serve(state); renderHud(); },
};

scene.sync(state);
scene.render();
```

- [ ] **Step 3: e2e — Plan 1 score 테스트를 4단계 풀 사이클로 교체**

`e2e/garak-guksu.spec.ts`의 3번째 테스트('serving a bowl scores via the core loop')를 아래로 교체(mount/hub 테스트는 그대로):
```ts
test('full cooking pipeline scores completeness + accuracy', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();

  const result = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    const S = g.STATIONS;
    g.teleport(S.setting.x, S.setting.z); g.setNoodle();
    g.teleport(S.blancher.x, S.blancher.z); g.putInBlancher();
    g.tick(2.5 * 0.8);              // perfect doneness window
    g.liftFromBlancher();
    g.teleport(S.broth.x, S.broth.z); g.pourBroth();
    g.teleport(S.garnish.x, S.garnish.z); g.garnish(g.order.spice); // match the order
    g.teleport(g.CUSTOMER_SLOT.x, g.CUSTOMER_SLOT.z); g.serve();
    return g.score;
  });
  expect(result).toBe(180); // 100 base + 50 perfect doneness + 30 accuracy
});
```

- [ ] **Step 4: 게이트 실행**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium`
Expected: PASS (3 tests).
Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: PASS (전체 유닛).

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/main.js public/garak-guksu/index.html e2e/garak-guksu.spec.ts
git commit -m "feat(garak-guksu): wire 4-station pipeline + garnish input + HUD + e2e"
```

---

## Plan 2 완료 기준

- 사리세팅 → 데치기(게이지, 적정 타이밍에 건짐) → 육수 → 마감(1/2/3로 고춧가루 변형) → 배식.
- 배식 점수 = 100 + 완성도(데치기 0/20/50) + 정확(주문 일치 시 +30).
- 데치기 게이지가 화면에 보이고(amber→green→red), HUD에 주문/들고 있는 단계 표시.
- 유닛 + E2E(풀 파이프라인 score 180) green.

**다음:** Plan 3(손님 5아키타입 + 스폰 + 초조 게이지 + 이중압박 타이머 + 5웨이브 + 이탈 라이프). 멀티 채반 저글링은 다수 주문이 생기는 Plan 3에서 자연히 의미를 갖는다.
