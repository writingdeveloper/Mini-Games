# 가락국수 Plan 4: 웨이브 · 시대 곡선 · 정차 타이머 · 완주 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Plan 3의 무한 스폰을 **5웨이브(열차 1대=1웨이브) 구조**로 감싸고, **시대 곡선**(증기→디젤→막차)과 **정차 타이머**(웨이브 전체 데드라인)를 얹어, 5웨이브를 완주하면 승리·라이프 0이면 영업종료로 끝나게 한다.

**Architecture:** `logic.js`에 `WAVES` 데이터와 게임 `phase`('serving'|'intermission'|'won'|'over')를 도입한다. `tickSpawns`는 웨이브 정원(`count`)까지만 스폰하도록 gate되고, `tickWave`가 정차 타이머(`dwellLeft`)를 줄여 0이 되면 웨이브를 종료(`endWave`)한다. 종료 시 남은 손님은 기차와 함께 떠나고(점수 손실만, 라이프 무관 — 라이프는 개인 초조 이탈만), 다음 웨이브로 인터미션 후 전환하거나 5웨이브를 다 돌면 승리한다. `over`(boolean)는 `phase`로 통합된다.

**Tech Stack:** 기존과 동일. **콤보/결과 화면 디테일은 Plan 5, 폴리시는 Plan 6, 음성은 Plan 7.**

**작업 트리:** worktree `Mini-Games-garak`(브랜치 `feat/garak-guksu`).

**현재 상태(Plan 3 완료):** `createGame(seed)`={player, blancher:{slots:[null,null]}, customers:[], spawnTimer, lives:5, over:false, score:0, _rng, _nextId}. `tickSpawns`(슬롯 빈 곳에 SPAWN_INTERVAL마다, full이어도 타이머 리셋), `tickCustomers`(개인 초조 초과 시 이탈+loseLife), `loseLife`(private, lives 0→over=true), `serve`(가장 가까운 손님). 32 유닛 + 4 E2E green.

> ⚠️ **마이그레이션:** `over`(boolean) → `phase`(string). `tickSpawns`/`tickCustomers`는 `state.over` 대신 `state.phase !== 'serving'`로 가드. 기존 createGame/스폰/초조 테스트가 영향을 받으므로 함께 갱신한다. **logic Task 1-2는 한 묶음**(중간에 옛 테스트가 깨지고 Task 2 끝에 전체 green).

---

### Task 1: WAVES + phase + 스폰/초조 gate (createGame 마이그레이션) (logic)

**Files:** Modify `logic.js`, `logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

import에 `WAVES` 추가. 새 describe:
```ts
describe('waves & phase (setup + spawn gate)', () => {
  it('starts on wave 0, serving, with the era-1 dwell timer', () => {
    const g = createGame(1);
    expect(g.wave).toBe(0);
    expect(g.phase).toBe('serving');
    expect(g.dwellLeft).toBe(WAVES[0].dwell);
    expect(g.waveSpawned).toBe(0);
  });
  it('tickSpawns stops after the wave quota (count) is reached', () => {
    const g = createGame(1);
    // wave 0 count is small; spawn many intervals, freeing slots each time
    for (let i = 0; i < 30; i++) { tickSpawns(g, SPAWN_INTERVAL); g.customers = []; }
    expect(g.waveSpawned).toBe(WAVES[0].count);
  });
  it('tickSpawns does nothing unless phase is serving', () => {
    const g = createGame(1);
    g.phase = 'intermission';
    tickSpawns(g, SPAWN_INTERVAL);
    expect(g.customers.length).toBe(0);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인** — `... -t "waves & phase"` → FAIL.

- [ ] **Step 3: logic.js — WAVES + createGame 재구성 + 스폰/초조 gate**

`SPAWN_INTERVAL`/`BLANCH_SLOTS` 선언 아래에 추가:
```js
// 5 waves = 5 trains. Era curve: steam(여유) → diesel(압박) → 막차(클라이맥스).
export const WAVES = [
  { era: '증기', dwell: 75, count: 3 },
  { era: '증기', dwell: 70, count: 4 },
  { era: '디젤', dwell: 55, count: 5 },
  { era: '디젤', dwell: 50, count: 6 },
  { era: '막차', dwell: 40, count: 8 },
];
export const INTERMISSION = 2.5; // seconds between waves (정산·안내방송)
```
`createGame`을 교체(over → phase + wave fields):
```js
export function createGame(seed = 1) {
  const rng = mulberry32(seed);
  return {
    player: { x: 0, z: 0, holding: null },
    blancher: { slots: new Array(BLANCH_SLOTS).fill(null) },
    customers: [],
    spawnTimer: 0,
    waveSpawned: 0,
    wave: 0,
    phase: 'serving',                 // 'serving' | 'intermission' | 'won' | 'over'
    dwellLeft: WAVES[0].dwell,
    intermissionLeft: 0,
    lives: 5,
    score: 0,
    _rng: rng,
    _nextId: 1,
  };
}
```
`tickSpawns`를 교체(phase + 정원 gate):
```js
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
```
`tickCustomers`의 가드 `if (state.over) return;`를 `if (state.phase !== 'serving') return;`로 바꾸고, `loseLife`의 `state.over = true`를 `state.phase = 'over'`로 바꾼다:
```js
function loseLife(state) {
  state.lives -= 1;
  if (state.lives <= 0) { state.lives = 0; state.phase = 'over'; }
}

export function tickCustomers(state, dt) {
  if (state.phase !== 'serving') return;
  for (const c of state.customers) c.t += dt;
  const stayed = [];
  for (const c of state.customers) {
    if (c.t >= ARCHETYPES[c.archetype].patience) loseLife(state);
    else stayed.push(c);
  }
  state.customers = stayed;
}
```

- [ ] **Step 4: 새 테스트 통과 확인** — `... -t "waves & phase"` → PASS. (옛 createGame 테스트 `over:false` 단언과 옛 스폰/초조 테스트 일부가 깨질 수 있다 — Task 2에서 정리.)

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): WAVES data + phase + per-wave spawn quota"
```

---

### Task 2: tickWave (정차 타이머 → 웨이브 전환 → 완주) + 기존 테스트 정리 (logic)

**Files:** Modify `logic.js`, `logic.test.ts`

- [ ] **Step 1: 테스트 추가 + 기존 갱신**

import에 `tickWave, INTERMISSION`. 기존 `createGame` describe의 단언을 갱신(over 제거, phase/wave 추가):
```ts
  it('starts empty-handed, no customers, serving wave 0, 5 lives', () => {
    const g = createGame(1);
    expect(g.player).toEqual({ x: 0, z: 0, holding: null });
    expect(g.customers).toEqual([]);
    expect(g.blancher.slots).toEqual([null, null]);
    expect(g.lives).toBe(5);
    expect(g.phase).toBe('serving');
    expect(g.wave).toBe(0);
    expect(g.score).toBe(0);
  });
```
(기존 `초조 + 이탈` describe의 `over` 단언이 있으면 `phase`로 갱신: `expect(g.phase).toBe('over')`.) 새 describe:
```ts
describe('tickWave (정차 타이머 → 전환 → 완주)', () => {
  it('dwell timer counts down while serving', () => {
    const g = createGame(1);
    tickWave(g, 10);
    expect(g.dwellLeft).toBe(WAVES[0].dwell - 10);
    expect(g.phase).toBe('serving');
  });
  it('dwell reaching 0 clears customers and enters intermission (no life penalty)', () => {
    const g = createGame(1);
    g.customers.push({ id: 1, slot: 0, archetype: 'granny', order: { spice: 'none' }, t: 0 });
    tickWave(g, WAVES[0].dwell + 1);
    expect(g.customers).toEqual([]);     // train departed
    expect(g.lives).toBe(5);             // departure is NOT a life loss
    expect(g.phase).toBe('intermission');
    expect(g.wave).toBe(1);
  });
  it('intermission elapsing starts the next wave with its dwell', () => {
    const g = createGame(1);
    tickWave(g, WAVES[0].dwell + 1);     // → intermission, wave 1
    tickWave(g, INTERMISSION + 0.1);     // → serving wave 1
    expect(g.phase).toBe('serving');
    expect(g.dwellLeft).toBe(WAVES[1].dwell);
    expect(g.waveSpawned).toBe(0);
  });
  it('finishing the last wave wins', () => {
    const g = createGame(1);
    g.wave = WAVES.length - 1; g.dwellLeft = WAVES[g.wave].dwell;
    tickWave(g, WAVES[g.wave].dwell + 1);
    expect(g.phase).toBe('won');
  });
  it('does nothing once won/over', () => {
    const g = createGame(1);
    g.phase = 'won';
    tickWave(g, 100);
    expect(g.wave).toBe(0);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인** — `... -t "tickWave"` → FAIL.

- [ ] **Step 3: logic.js — tickWave + endWave/startWave**

파일 끝에 추가:
```js
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
```

- [ ] **Step 4: 전체 유닛 green 확인** — `npx vitest run __tests__/unit/garak-guksu/logic.test.ts` → 전체 PASS. (모든 `over` 잔재가 phase로 정리됐는지 grep로 확인: 테스트에 `\.over`가 없어야.)

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): tickWave — dwell timer, wave transition, win"
```

---

### Task 3: 정차/시대/웨이브 HUD + 완주/실패 결과 + 배선 + E2E (main + scene + index)

**Files:** Modify `main.js`, `index.html`, `scene.js`(선택), `e2e/garak-guksu.spec.ts`

- [ ] **Step 1: index.html — HUD에 시대·웨이브·정차 타이머 추가**

`#hud` 안에 (라이프 옆) 추가:
```html
    <span id="wave">증기 · 1/5</span>
    <span>🚂 <span id="dwell">1:15</span></span>
```

- [ ] **Step 2: main.js — tickWave 루프 + HUD + 완주/실패 결과**

`main.js`에서: (a) import에 `tickWave, WAVES` 추가; (b) loop에 `tickWave(state, dt)`를 `tickSpawns` 앞에 넣고, 종료 조건을 `phase`로; (c) renderHud에 시대/웨이브/정차; (d) 결과 화면 분기(won/over). 구체:

import 줄에 `tickWave, WAVES` 추가. loop 교체:
```js
function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  movePlayer(state, input.getMoveDir(), dt);
  tickBlancher(state, dt);
  tickWave(state, dt);
  tickSpawns(state, dt);
  tickCustomers(state, dt);
  scene.sync(state);
  scene.render();
  renderHud();
  if (state.phase === 'won' || state.phase === 'over') { running = false; endGame(); return; }
  rafId = requestAnimationFrame(loop);
}
```
renderHud에 추가(기존 score/lives/order/held 유지):
```js
function renderHud() {
  $('score').textContent = state.score;
  $('lives').textContent = '❤'.repeat(Math.max(0, state.lives)) || '—';
  const w = WAVES[state.wave];
  $('wave').textContent = `${w.era} · ${state.wave + 1}/${WAVES.length}`;
  const sec = Math.max(0, Math.ceil(state.dwellLeft));
  $('dwell').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const nearby = nearestCustomer();
  $('order').textContent = nearby ? SPICE_KO[nearby.order.spice] : '-';
  $('held').textContent = state.player.holding ? STAGE_KO[state.player.holding.stage] : '빈손';
}
```
`gameOver()`를 `endGame()`으로 일반화(won/over 구분):
```js
function endGame() {
  const won = state.phase === 'won';
  $('result-title').textContent = won ? '🎉 영업 대박!' : '영업 종료';
  $('result-sub').textContent = won
    ? `5웨이브 완주 · 점수 ${state.score}`
    : `${state.wave + 1}웨이브에서 마감 · 점수 ${state.score}`;
  $('result').classList.remove('off');
}
```
(`start()`에서 `state.over` 참조가 있으면 제거. `__garak`에 `get phase()`/`get wave()`/`tickWave(dt)` 추가, 옛 `get over()`는 `phase`로 대체하거나 유지.)

- [ ] **Step 3: e2e — 웨이브 진행 + 완주**

`e2e/garak-guksu.spec.ts`에 5번째 테스트 추가(기존 4개 유지):
```ts
test('clearing all waves wins', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();
  const phase = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    // blow through every wave's dwell + intermission
    for (let i = 0; i < 12; i++) { g.tickWave(80); g.tickWave(3); }
    return g.phase;
  });
  expect(phase).toBe('won');
});
```

- [ ] **Step 4: 게이트 실행**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium` → 5 tests PASS.
Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts` → 전체 PASS.

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/main.js public/garak-guksu/index.html e2e/garak-guksu.spec.ts
git commit -m "feat(garak-guksu): wave/era/dwell HUD + win-lose result + tickWave loop + e2e"
```

---

## Plan 4 완료 기준

- 게임이 5웨이브(증기 2 → 디젤 2 → 막차 1)로 진행되고, 각 웨이브는 정차 타이머가 도는 동안 정원만큼 손님을 스폰한다.
- 정차 타이머가 0이 되면 기차가 떠나고(남은 손님 퇴장, 라이프 무관) 인터미션 후 다음 웨이브로, 5웨이브를 완주하면 "영업 대박!".
- 개인 초조 이탈로 라이프가 0이 되면 "영업 종료".
- HUD에 시대·웨이브·정차 카운트다운 표시. 유닛 + E2E(완주) green.

**다음:** Plan 5(콤보 배수 · 속도 보너스 · 특수 보너스 · 결과 화면 등급/칭호 · 최고기록 localStorage).
