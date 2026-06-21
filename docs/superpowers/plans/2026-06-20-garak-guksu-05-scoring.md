# 가락국수 Plan 5: 콤보 · 속도 보너스 · 결과 등급 · 최고기록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 배식 점수를 **(기본+완성도+속도+정확) × 콤보배수** 로 확장한다. 연속 정확 배식이 콤보를 올려 배수를 키우고(오배식·이탈은 리셋), 손님이 덜 초조할 때 빨리 주면 속도 보너스가 붙는다. 결과 화면에 등급/칭호·최고 콤보·만족/놓침·최고기록(localStorage)을 보여준다.

**Architecture:** `logic.js`에 `combo`/`bestCombo`/`served`/`missed`와 `comboMult`·`grade`를 더하고, `serve`를 콤보·속도·오배식 분기로 재구성한다(순수 유지 — localStorage는 main이 담당). `tickCustomers`의 이탈에 `missed++`/`combo=0`을 더한다. `main.js`는 콤보 HUD와 결과 화면(등급/통계/최고기록 localStorage)을 더한다.

**Tech Stack:** 기존과 동일. **폴리시(무드·애니·모바일 HUD)는 Plan 6, 음성은 Plan 7. 특수 보너스(연인 페어·군인 러시)는 손님 시스템 확장이 필요해 Plan 6+로 미룸 — 이 plan은 콤보·속도·막차완주 등급까지.**

**작업 트리:** worktree `Mini-Games-garak`(브랜치 `feat/garak-guksu`).

**현재 상태(Plan 4 완료):** `serve`(가장 가까운 손님, score += base+doneness+accuracy), `tickCustomers`(이탈+loseLife), `createGame`(…lives, phase, wave…). `patienceProgress(c)` 존재. 40 유닛 + 5 E2E green.

> ⚠️ **마이그레이션:** `serve`가 콤보 배수·속도·오배식 분기로 재구성되므로 Plan 3의 `serve` 테스트(고정 점수 단언)가 새 점수식에 맞게 갱신된다. `createGame`에 필드가 추가된다. logic Task 1을 끝내면 전체 green.

---

### Task 1: 콤보 · 속도 · 오배식 · 통계 · 등급 (logic)

**Files:** Modify `logic.js`, `logic.test.ts`

- [ ] **Step 1: 테스트 추가 + 기존 serve 갱신**

import에 `comboMult, SPEED_MAX, grade` 추가. 기존 `createGame` describe에 콤보/통계 초기값 단언을 더한다:
```ts
  it('starts with zero combo and clean stats', () => {
    const g = createGame(1);
    expect(g.combo).toBe(0);
    expect(g.bestCombo).toBe(0);
    expect(g.served).toBe(0);
    expect(g.missed).toBe(0);
  });
```
`comboMult` describe:
```ts
describe('comboMult', () => {
  it('1 at combo≤1, +0.4 per streak, capped at 3 (×3 at streak 6)', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(1)).toBe(1);
    expect(comboMult(2)).toBeCloseTo(1.4, 5);
    expect(comboMult(6)).toBe(3);
    expect(comboMult(10)).toBe(3); // capped
  });
});
```
기존 `serve (가장 가까운 손님)` describe를 콤보·속도 모델로 교체:
```ts
describe('serve (콤보 · 속도 · 정확)', () => {
  function customerAt(g, slot, spice, arche = 'student') {
    const c = { id: g._nextId++, slot, archetype: arche, order: { spice }, t: 0 };
    g.customers.push(c); return c;
  }
  function doneBowl(spice, doneness = 50) { return { stage: 'done', doneness, spice }; }

  it('correct serve: combo++, full-speed bonus, score = (base+doneness+speed+accuracy)×mult', () => {
    const g = createGame(1);
    customerAt(g, 1, 'extra'); // t=0 → patienceProgress 0 → speed max
    const slot = CUSTOMER_SLOTS[1]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.combo).toBe(1);
    expect(g.bestCombo).toBe(1);
    expect(g.served).toBe(1);
    // (100 + 50 + 50 + 30) × comboMult(1)=1 = 230
    expect(g.score).toBe(230);
  });
  it('second correct serve multiplies by comboMult(2)=1.4', () => {
    const g = createGame(1);
    g.combo = 1; // already one in
    customerAt(g, 0, 'none');
    const slot = CUSTOMER_SLOTS[0]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('none', 50); // t=0 → speed 50
    serve(g);
    expect(g.combo).toBe(2);
    // (100+50+50+30) × 1.4 = 322
    expect(g.score).toBe(322);
  });
  it('wrong spice: half base, no bonus, combo resets', () => {
    const g = createGame(1);
    g.combo = 4;
    customerAt(g, 0, 'none');
    const slot = CUSTOMER_SLOTS[0]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(50); // base/2
    expect(g.combo).toBe(0);
    expect(g.served).toBe(0); // mis-serve doesn't count as satisfied
  });
  it('speed bonus scales with remaining patience', () => {
    const g = createGame(1);
    const c = customerAt(g, 2, 'normal', 'granny'); // patience 25
    c.t = 12.5; // half patience → speed 25
    const slot = CUSTOMER_SLOTS[2]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('normal', 20);
    serve(g);
    // (100 + 20 + 25 + 30) × 1 = 175
    expect(g.score).toBe(175);
  });
});
```
`grade` describe:
```ts
describe('grade (등급/칭호)', () => {
  it('perfect run wins as 역전의 명인', () => {
    const g = createGame(1); g.phase = 'won'; g.missed = 0; g.served = 12;
    expect(grade(g)).toBe('역전의 명인');
  });
  it('many walkouts → 기차 도살자', () => {
    const g = createGame(1); g.missed = 6;
    expect(grade(g)).toBe('기차 도살자');
  });
});
```
`초조 + 이탈` describe에 추가:
```ts
  it('a walkout increments missed and resets combo', () => {
    const g = createGame(1); g.combo = 4;
    g.customers.push({ id: 1, slot: 0, archetype: 'soldier', order: { spice: 'normal' }, t: 0 });
    tickCustomers(g, 13);
    expect(g.missed).toBe(1);
    expect(g.combo).toBe(0);
  });
```

- [ ] **Step 2: 실행해서 실패 확인** — `npx vitest run __tests__/unit/garak-guksu/logic.test.ts` → 새 테스트 FAIL.

- [ ] **Step 3: logic.js — 콤보/속도/통계/등급 + serve 재구성**

`createGame`의 반환 객체에 추가(score 옆): `combo: 0, bestCombo: 0, served: 0, missed: 0,`.

`SERVE_BASE`/`ACCURACY_BONUS` 근처에 추가:
```js
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
```
`serve`를 교체:
```js
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
```
`tickCustomers`의 이탈 분기에 `missed`/`combo` 추가:
```js
    if (c.t >= ARCHETYPES[c.archetype].patience) { loseLife(state); state.missed += 1; state.combo = 0; }
```

- [ ] **Step 4: 전체 유닛 green 확인** — `npx vitest run __tests__/unit/garak-guksu/logic.test.ts` → 전체 PASS.

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): combo multiplier, speed bonus, mis-serve reset, grade"
```

---

### Task 2: 콤보 HUD + 결과 화면(등급·통계·최고기록) + E2E (main + index)

**Files:** Modify `main.js`, `index.html`, `e2e/garak-guksu.spec.ts`

- [ ] **Step 1: index.html — 콤보 HUD + 결과 통계 컨테이너**

`#hud`에 콤보 span 추가(점수 옆):
```html
    <span id="combo">콤보 0</span>
```
`#result` 오버레이의 `#result-sub` 아래에 통계 줄 추가:
```html
    <div id="result-stats" style="line-height:1.8;font-size:15px"></div>
```

- [ ] **Step 2: main.js — 콤보 HUD + 등급/통계/최고기록**

import에 `grade` 추가. 콤보 HUD를 renderHud에:
```js
  $('combo').textContent = state.combo >= 2 ? `콤보 ×${comboMult(state.combo).toFixed(1)}` : `콤보 ${state.combo}`;
```
(import에 `comboMult`도 추가.)

최고기록 helpers (파일 상단, $ 아래):
```js
const BEST_KEY = 'garak-guksu-best';
const loadBest = () => Number(localStorage.getItem(BEST_KEY) || 0);
function saveBest(s) { if (s > loadBest()) localStorage.setItem(BEST_KEY, String(s)); }
```
`endGame()`을 확장(등급·통계·최고기록):
```js
function endGame() {
  const won = state.phase === 'won';
  saveBest(state.score);
  $('result-title').textContent = `${won ? '🎉 ' : ''}${grade(state)}`;
  $('result-sub').textContent = won ? '5웨이브 완주!' : `${state.wave + 1}웨이브에서 마감`;
  $('result-stats').innerHTML =
    `점수 <b>${state.score}</b> · 최고 콤보 <b>${state.bestCombo}</b><br>` +
    `😋 만족 ${state.served} · 🚂 놓침 ${state.missed}<br>` +
    `🏆 최고기록 ${loadBest()}`;
  $('result').classList.remove('off');
}
```

- [ ] **Step 3: e2e — 콤보 누적 + 오배식 리셋**

`e2e/garak-guksu.spec.ts`에 6번째 테스트 추가:
```ts
test('combo builds on correct serves and resets on a mis-serve', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();
  const r = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak; const S = g.STATIONS;
    const SLOTS = [{x:-3,z:3.2},{x:-1,z:3.2},{x:1,z:3.2},{x:3,z:3.2}];
    function cook(spice) {
      g.teleport(S.setting.x, S.setting.z); g.setNoodle();
      g.teleport(S.blancher.x, S.blancher.z); g.putInBlancher(); g.tick(2.0); g.liftFromBlancher();
      g.teleport(S.broth.x, S.broth.z); g.pourBroth();
      g.teleport(S.garnish.x, S.garnish.z); g.garnish(spice);
    }
    // two correct serves
    g.tickSpawns(2.5); let c = g.customers[g.customers.length - 1];
    cook(c.order.spice); g.teleport(SLOTS[c.slot].x, SLOTS[c.slot].z); g.serve();
    g.tickSpawns(2.5); c = g.customers[g.customers.length - 1];
    cook(c.order.spice); g.teleport(SLOTS[c.slot].x, SLOTS[c.slot].z); g.serve();
    const afterTwo = g.combo;
    // a wrong serve
    g.tickSpawns(2.5); c = g.customers[g.customers.length - 1];
    const wrong = ['none','normal','extra'].find((s) => s !== c.order.spice);
    cook(wrong); g.teleport(SLOTS[c.slot].x, SLOTS[c.slot].z); g.serve();
    return { afterTwo, afterWrong: g.combo, bestCombo: g.bestCombo };
  });
  expect(r.afterTwo).toBe(2);
  expect(r.afterWrong).toBe(0);
  expect(r.bestCombo).toBe(2);
});
```

- [ ] **Step 4: 게이트 실행**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium` → 6 tests PASS.
Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts` → 전체 PASS.

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/main.js public/garak-guksu/index.html e2e/garak-guksu.spec.ts
git commit -m "feat(garak-guksu): combo HUD + result grade/stats + best score"
```

---

## Plan 5 완료 기준

- 연속 정확 배식이 콤보를 올려 점수 배수가 ×3까지 커지고, 오배식·이탈은 콤보를 리셋한다.
- 손님이 덜 초조할 때 빨리 주면 속도 보너스(최대 +50)가 붙는다.
- 결과 화면에 등급/칭호·최고 콤보·만족/놓침·최고기록(localStorage)이 표시된다.
- 유닛 + E2E(콤보 누적/리셋) green.

**다음:** Plan 6(폴리시 — 시대별 무드·조명 강화·절차적 애니·코미디 레이어·모바일 조이스틱+HUD 정리·a11y). 그 다음 Plan 7(음성).
