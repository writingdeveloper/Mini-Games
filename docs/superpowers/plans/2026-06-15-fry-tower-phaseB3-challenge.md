# Fryffel Tower Phase B3 — 도전 장치(높이 비례 흔들림) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 높이가 곧 리스크가 되도록, 타워에 **높이 비례 흔들림(전단)**을 주기적으로 가하는 도전 장치를 추가한다. 점수 공식은 불변.

**Architecture:** 흔들림 세기 계산은 순수 함수 `logic/challenge.js`(`wobbleImpulse`, 유닛 TDD)로 분리하고, `Session.update`가 주기 타이머로 각 바디에 *자기 높이 비례* 수평 임펄스를 가한다(기존 `applyGust` 패턴). 솔로+MP 공통(같은 Session), B3는 솔로 검증.

**Tech Stack:** cannon-es 임펄스 · 빌드프리 ESM · Vitest 유닛 · Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-06-15-fry-tower-phaseB3-scoring-challenge-design.md`

---

## File Structure

**Create**
- `public/fry-tower-game/src/logic/challenge.js` — 순수 `wobbleImpulse(bodyHeight, towerHeight, cfg)`.
- `__tests__/unit/fry-tower-game/challenge.test.ts` — 유닛 테스트.

**Modify**
- `public/fry-tower-game/src/logic/config.js` — `challenge` 블록 추가.
- `public/fry-tower-game/src/play/Session.js` — 흔들림 타이머 + `_applyWobble`.
- `e2e/fry-tower-game.spec.ts` — 강제 흔들림 검증 + 타입.

**Untouched:** scoring/combo/round/tower/HandRig/CameraRig/Input/main/Multiplayer/fryMesh — 전부 불변.

---

## Task 1: config.challenge + 순수 wobbleImpulse + 유닛 테스트 (TDD)

**Files:**
- Modify: `public/fry-tower-game/src/logic/config.js`
- Create: `public/fry-tower-game/src/logic/challenge.js`
- Test: `__tests__/unit/fry-tower-game/challenge.test.ts`

- [ ] **Step 1: config에 challenge 블록 추가**

`config.js`의 `camera: { ... },` 줄 다음(닫는 `};` 앞)에 추가:
```js
  // ---- challenge (Phase B3): height-scaled wobble that stresses tall towers ----
  challenge: { interval: 5, startHeight: 1.5, perMeter: 0.6, maxImpulse: 2.5 },
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// __tests__/unit/fry-tower-game/challenge.test.ts
import { describe, it, expect } from "vitest";
import { wobbleImpulse } from "../../../public/fry-tower-game/src/logic/challenge.js";

const cfg = { interval: 5, startHeight: 1.5, perMeter: 0.6, maxImpulse: 2.5 };

describe("wobbleImpulse", () => {
  it("is zero while the tower is below the start height", () => {
    expect(wobbleImpulse(3, 1.0, cfg)).toBe(0);
  });
  it("scales with the body's height above the tray once the tower is tall enough", () => {
    expect(wobbleImpulse(2, 4, cfg)).toBeCloseTo(1.2, 6); // 2 * 0.6
  });
  it("floors negative body heights at zero", () => {
    expect(wobbleImpulse(-1, 4, cfg)).toBe(0);
  });
  it("caps the impulse at maxImpulse", () => {
    expect(wobbleImpulse(100, 4, cfg)).toBe(2.5);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- challenge`
Expected: FAIL ("Cannot find module .../challenge.js").

- [ ] **Step 4: challenge.js 구현**

```js
// public/fry-tower-game/src/logic/challenge.js
// Pure challenge math — no THREE / no physics. Unit tested.

// Per-body horizontal impulse magnitude for the height-scaled wobble (shear).
// Returns 0 while the tower is below the start height (calm early game);
// otherwise scales with the body's own height above the tray, capped.
export function wobbleImpulse(bodyHeight, towerHeight, cfg) {
  if (towerHeight < cfg.startHeight) return 0;
  const mag = Math.max(0, bodyHeight) * cfg.perMeter;
  return Math.min(mag, cfg.maxImpulse);
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test -- challenge`
Expected: PASS (4/4).

- [ ] **Step 6: 커밋**

```bash
git add public/fry-tower-game/src/logic/config.js public/fry-tower-game/src/logic/challenge.js __tests__/unit/fry-tower-game/challenge.test.ts
git commit -m "feat(fry-tower): pure wobbleImpulse (height-scaled challenge) + config + tests"
```

---

## Task 2: Session — 흔들림 타이머 + `_applyWobble`

**Files:**
- Modify: `public/fry-tower-game/src/play/Session.js`

- [ ] **Step 1: import 추가**

`import { releaseVelocity } from '../logic/placement.js';` 다음 줄에 추가:
```js
import { wobbleImpulse } from '../logic/challenge.js';
```

- [ ] **Step 2: 생성자에 흔들림 상태 추가**

`this._pendingSettle = [];  // bodies awaiting settle check` 다음에 추가:
```js
    this._wobbleT = 0;         // challenge wobble timer
    this._wobbleSign = 1;      // alternating sway direction
```

- [ ] **Step 3: update에서 물리 step 직전에 흔들림 타이머**

`    // ---- Physics + scoring (preserved) ----` / `    this.world.step(1 / 60, dt, 3);` 앞에 추가(즉 그 두 줄 바로 위):
```js
    // Challenge: a periodic height-scaled wobble stresses tall towers.
    this._wobbleT += dt;
    if (this._wobbleT >= CONFIG.challenge.interval) {
      this._wobbleT = 0;
      this._applyWobble();
    }

```
(앵커: 아래 old/new로 정확히 교체)
old:
```js
    // ---- Physics + scoring (preserved) ----
    this.world.step(1 / 60, dt, 3);
```
new:
```js
    // Challenge: a periodic height-scaled wobble stresses tall towers.
    this._wobbleT += dt;
    if (this._wobbleT >= CONFIG.challenge.interval) {
      this._wobbleT = 0;
      this._applyWobble();
    }

    // ---- Physics + scoring (preserved) ----
    this.world.step(1 / 60, dt, 3);
```

- [ ] **Step 4: `_applyWobble()` 메서드 추가 (dispose 앞)**

`  dispose() {` 앞에 추가:
```js
  // Challenge: a periodic height-scaled sideways wobble (shear). Each fry is
  // pushed in proportion to its own height above the tray, so tall towers lean
  // and risk toppling while short ones stay calm. Alternating direction = sway.
  _applyWobble() {
    const top = towerHeight(this.bodies, this.trayTopY);
    if (top < CONFIG.challenge.startHeight) return;
    this._wobbleSign *= -1;
    const dir = this._wobbleSign;
    for (const b of this.bodies) {
      const mag = wobbleImpulse(b.position.y - this.trayTopY, top, CONFIG.challenge);
      if (mag <= 0) continue;
      b.wakeUp();
      const jz = (Math.random() - 0.5) * mag * 0.3;
      b.applyImpulse(new CANNON.Vec3(dir * mag, 0, jz), new CANNON.Vec3(0, 0, 0));
    }
    if (this.cameraRig) this.cameraRig.shake(0.12);
  }

```

- [ ] **Step 5: 정적 검증**

Run: `npm test` → 161 통과(기존 157 + challenge 4). `npm run type-check` → 클린.
Run (구문): `node --input-type=module -e "import('./public/fry-tower-game/src/play/Session.js').then(()=>console.log('OK')).catch(e=>process.exit(/Cannot find package/.test(e.message)?0:1))"` → "Cannot find package" = OK.

- [ ] **Step 6: 커밋**

```bash
git add public/fry-tower-game/src/play/Session.js
git commit -m "feat(fry-tower): Session height-scaled wobble challenge (Phase B3)"
```

---

## Task 3: e2e (강제 흔들림 검증) + 전체 게이트

**Files:**
- Modify: `e2e/fry-tower-game.spec.ts`

- [ ] **Step 1: Window 타입 확장**

`declare global { ... }` 의 session 타입을 교체:
```ts
declare global {
  interface Window {
    __fry?: {
      session?: {
        height: number;
        placed?: unknown[];
        azimuth?: number;
        bodies?: { position: { y: number }; velocity: { x: number } }[];
        _applyWobble?: () => void;
      };
    };
  }
}
```

- [ ] **Step 2: 강제 흔들림 테스트 추가** (`multi-mode bootstrap ...` 앞)

```ts
  test("challenge: wobble applies a height-scaled sideways impulse to the tower", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();

    // Drop a few fries so the tower has bodies.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(800);

    // Lift the tower above the wobble threshold and force a wobble; assert it
    // imparts horizontal velocity (the impulse path runs) with no error.
    const wobbled = await page.evaluate(() => {
      const s = window.__fry?.session;
      if (!s || !s.bodies || !s.bodies.length) return false;
      for (const b of s.bodies) b.position.y += 2.5;
      const before = s.bodies.map((b) => b.velocity.x);
      s._applyWobble?.();
      const after = s.bodies.map((b) => b.velocity.x);
      return after.some((v, i) => v !== before[i]);
    });

    expect(wobbled, "forced wobble should change body velocities").toBe(true);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
```

- [ ] **Step 3: 전체 게이트**

Run: `npm run lint && npm run type-check && npm test && npm run test:e2e -- fry-tower-game`
Expected: lint 0 errors · tsc 클린 · unit 161 · e2e 8/8 통과.

- [ ] **Step 4: 커밋**

```bash
git add e2e/fry-tower-game.spec.ts
git commit -m "test(fry-tower): forced-wobble e2e (height-scaled impulse)"
```

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** §2 흔들림(주기/전단/임계/캡/방향/피드백)→T1(순수)·T2(적용) · §3 점수 불변→무수정 · §4 순수+TDD→T1 · §5 config→T1 · §6 Session 통합→T2 · §8 테스트→T1(유닛)·T3(e2e).
- **플레이스홀더:** 없음 — 모든 코드/앵커 명시.
- **타입/이름 일관성:** `wobbleImpulse(bodyHeight, towerHeight, cfg)`(challenge.js↔Session↔test) · `_applyWobble`/`_wobbleT`/`_wobbleSign`(Session) · `CONFIG.challenge`(config) · e2e Window 타입 `bodies`/`_applyWobble`.
- **검증 한계:** 라이브 흔들림은 임계(1.5m) 때문에 짧은 e2e 타워에선 자연 발화 안 함 → T3은 바디를 +2.5 올려 **강제 발화**로 임펄스 경로를 결정적으로 검증. 실제 플레이 감(주기/세기)은 수동 튜닝.

## 미해결(후속)
- 흔들림 수치 튜닝(플레이), 사전 경고/오디오, MP 밸런스(Phase C), B2 고급 UI.
