# Fryffel Tower — Phase 1 (Solo Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fun, fully-playable **single-player** french-fry physics stacking game as the 5th card in the Mini-Games hub.

**Architecture:** Build-free Three.js (importmap CDN, no bundler) like `desert-game`, plus `cannon-es` for rigid-body physics. Pure, THREE/physics-free logic in `src/logic/` is unit-tested (Vitest); the engine integration is verified via Playwright. The page is an iframe-embedded static game, identical to the other four games.

**Tech Stack:** Three.js 0.184.0, cannon-es 0.20.0 (both via importmap CDN), Next.js hub shell, Vitest (jsdom) unit tests, Playwright e2e.

**Scope note:** This plan covers **Phase 1 only** (solo). Phase 2 (real-time multiplayer) and Phase 3 (sabotage/bots/audio/polish) get their own plans after Phase 1 ships. See `docs/superpowers/specs/2026-06-13-fry-tower-game-design.md`.

---

## File Structure (Phase 1)

**Create (client, static game):**
- `public/fry-tower-game/index.html` — importmap (three + cannon-es), canvas, menu/HUD/result overlays
- `public/fry-tower-game/style.css` — cartoon-styled overlays/HUD
- `public/fry-tower-game/src/main.js` — boot + wiring
- `public/fry-tower-game/src/core/Game.js` — renderer/scene/camera/loop
- `public/fry-tower-game/src/core/Input.js` — keyboard/pointer input state
- `public/fry-tower-game/src/logic/config.js` — tunables (pure)
- `public/fry-tower-game/src/logic/scoring.js` — score math (pure)
- `public/fry-tower-game/src/logic/combo.js` — combo/streak (pure)
- `public/fry-tower-game/src/logic/round.js` — round timer state machine (pure)
- `public/fry-tower-game/src/physics/world.js` — cannon-es world + fry body factory + height/stability helpers
- `public/fry-tower-game/src/render/materials.js` — cartoon toon material + inverted-hull outline
- `public/fry-tower-game/src/render/fryMesh.js` — fry/tray meshes
- `public/fry-tower-game/src/render/Stage.js` — lights + tray + backdrop
- `public/fry-tower-game/src/render/Fx.js` — dust burst + camera shake (reduced-motion gated)
- `public/fry-tower-game/src/entities/Fry.js` — body↔mesh pair
- `public/fry-tower-game/src/play/Session.js` — solo gameplay controller (active fry, drop, height, combo, round)
- `public/fry-tower-game/src/ui/HUD.js` — HUD + result overlay updates

**Create (hub + tests):**
- `app/fry-tower-game/page.tsx` — iframe route (mirrors `app/desert-game/page.tsx`)
- `__tests__/unit/fry-tower-game/scoring.test.ts`
- `__tests__/unit/fry-tower-game/combo.test.ts`
- `__tests__/unit/fry-tower-game/round.test.ts`
- `e2e/fry-tower-game.spec.ts`

**Modify:**
- `app/page.tsx` — add the 5th game card
- `eslint.config.mjs` — ignore `public/fry-tower-game/**` (vanilla JS, like other games)
- `vitest.config.ts` — add `public/fry-tower-game/src/**` to coverage include

---

## Task 1: Walking skeleton — scaffold + hub integration + e2e

**Files:**
- Create: `public/fry-tower-game/index.html`, `public/fry-tower-game/style.css`, `public/fry-tower-game/src/core/Game.js`, `public/fry-tower-game/src/main.js`
- Create: `app/fry-tower-game/page.tsx`
- Create: `e2e/fry-tower-game.spec.ts`
- Modify: `app/page.tsx`, `eslint.config.mjs`, `vitest.config.ts`

- [ ] **Step 1: Create `public/fry-tower-game/index.html`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fryffel Tower — 감자튀김 마천루</title>
  <link rel="stylesheet" href="./style.css" />
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/",
      "cannon-es": "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js"
    }
  }
  </script>
</head>
<body>
  <canvas id="game"></canvas>

  <div id="webgl-error" class="overlay hidden">
    <div class="panel"><h1>WebGL을 사용할 수 없습니다</h1><p>최신 브라우저에서 실행해 주세요.</p></div>
  </div>

  <div id="menu" class="overlay">
    <div class="panel">
      <h1 class="title">FRYFFEL TOWER</h1>
      <p class="subtitle">감자튀김을 쌓아 가장 높은 탑을!</p>
      <button id="start-btn" class="btn-primary">쌓기 시작</button>
      <div class="controls">
        <span>← →</span><span>이동</span>
        <span>Q / E</span><span>회전</span>
        <span>Space</span><span>놓기</span>
      </div>
    </div>
  </div>

  <div id="hud" class="hidden">
    <div id="hud-height">🗼 <span id="height-val">0.0</span> m</div>
    <div id="hud-time">⏱ <span id="time-val">90</span></div>
    <div id="hud-score">⭐ <span id="score-val">0</span></div>
    <div id="hud-combo">🔥 <span id="combo-val">0</span></div>
  </div>

  <div id="result" class="overlay hidden">
    <div class="panel">
      <h1 class="title" id="result-title">시간 종료!</h1>
      <p class="subtitle" id="result-detail"></p>
      <button id="restart-btn" class="btn-primary">다시 쌓기</button>
    </div>
  </div>

  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/fry-tower-game/style.css`**

```css
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; font-family: system-ui, "Segoe UI", sans-serif; }
#game { display: block; width: 100vw; height: 100vh; background: #ffe39a; }
.hidden { display: none !important; }

.overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(40, 24, 8, 0.45); z-index: 5; }
.panel { background: #fff6df; border: 4px solid #2a1b08; border-radius: 18px; padding: 28px 36px;
  text-align: center; box-shadow: 0 10px 0 #2a1b08; max-width: 90vw; }
.title { margin: 0 0 6px; font-size: 44px; font-weight: 900; color: #e23434; -webkit-text-stroke: 2px #2a1b08; }
.subtitle { margin: 0 0 18px; color: #6b4a16; font-size: 16px; }
.btn-primary { font-size: 20px; font-weight: 800; color: #fff; background: linear-gradient(#ffb43a, #f7902f);
  border: 3px solid #2a1b08; border-radius: 12px; padding: 12px 26px; cursor: pointer; box-shadow: 0 5px 0 #2a1b08; }
.btn-primary:active { transform: translateY(3px); box-shadow: 0 2px 0 #2a1b08; }
.controls { margin-top: 18px; display: grid; grid-template-columns: auto auto; gap: 6px 16px; font-size: 14px; color: #6b4a16; }
.controls span:nth-child(odd) { font-weight: 800; color: #2a1b08; }

#hud { position: fixed; top: 14px; left: 14px; z-index: 4; display: flex; gap: 14px; flex-wrap: wrap; }
#hud > div { background: rgba(255, 246, 223, 0.92); border: 3px solid #2a1b08; border-radius: 10px;
  padding: 6px 12px; font-weight: 800; color: #2a1b08; box-shadow: 0 3px 0 #2a1b08; }
```

- [ ] **Step 3: Create `public/fry-tower-game/src/core/Game.js`**

```js
import * as THREE from 'three';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffe39a);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 6, 12);
    this.camera.lookAt(0, 4, 0);

    this.systems = [];
    this._running = false;
    this._last = 0;
    this._loop = this._loop.bind(this);
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  add(system) { this.systems.push(system); return system; }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  renderOnce() { this.renderer.render(this.scene, this.camera); }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  stop() { this._running = false; }

  _loop(t) {
    if (!this._running) return;
    const dt = Math.min(0.05, (t - this._last) / 1000);
    this._last = t;
    for (const s of this.systems) if (s.update) s.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}
```

- [ ] **Step 4: Create `public/fry-tower-game/src/main.js` (skeleton — empty stage + tray)**

```js
import * as THREE from 'three';
import { Game } from './core/Game.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');

let game = null;
try {
  game = new Game(canvas); // creating WebGLRenderer throws if WebGL is unavailable
} catch (err) {
  console.error('[fry-tower] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  game.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a3a, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 12, 8);
  game.scene.add(dir);

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xe23434, roughness: 0.8 })
  );
  game.scene.add(tray);

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hud.classList.remove('hidden');
    game.start();
  });

  game.renderOnce(); // show the stage before the player presses start
  console.log('[fry-tower] ready');
}
```

- [ ] **Step 5: Create `app/fry-tower-game/page.tsx` (mirror desert route)**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export default function FryTowerGame() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Link
        href="/"
        className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-4 py-2 text-white transition-colors hover:bg-black/90"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        홈으로
      </Link>
      {loading && <LoadingOverlay />}
      <iframe
        src="/fry-tower-game/index.html"
        className="h-full w-full border-0"
        title="Fryffel Tower - 감자튀김 마천루"
        allow="fullscreen"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
```

- [ ] **Step 6: Add the 5th card to `app/page.tsx`**

Insert this `<Link>` block immediately after the Dust Drifter card's closing `</Link>` and before the closing `</div>` of the `grid` container:

```tsx
          {/* 감자튀김 쌓기 카드 */}
          <Link href="/fry-tower-game" aria-label="Fryffel Tower 감자튀김 쌓기 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 to-red-500 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-yellow-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                🍟
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">
                  Fryffel Tower
                </h2>
                <p className="mb-4 text-white/90">
                  감자튀김을 쌓아 가장 높은 탑을 만드세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ 3D 물리 스태킹</li>
                  <li>✓ 조준·회전·놓기</li>
                  <li>✓ 시간제 높이 경쟁</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>
```

- [ ] **Step 7: Add `public/fry-tower-game/**` to `eslint.config.mjs` ignores**

In the `globalIgnores([...])` list, add a line alongside the other game ignores (e.g., after `"public/desert-game/**",`):

```js
    "public/fry-tower-game/**",
```

- [ ] **Step 8: Add coverage include to `vitest.config.ts`**

In `coverage.include`, add after `'public/desert-game/src/**',`:

```js
        'public/fry-tower-game/src/**',
```

- [ ] **Step 9: Create `e2e/fry-tower-game.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("Fryffel Tower fry-stacking game", () => {
  test("hub card navigates to the game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Fryffel Tower/ }).click();
    await expect(page).toHaveURL(/\/fry-tower-game/);
    await expect(page.locator('iframe[title*="Fryffel Tower"]')).toBeVisible();
  });

  test("game canvas mounts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/fry-tower-game/index.html");
    await expect(page.locator("canvas#game")).toBeVisible();
    await page.waitForTimeout(1500); // allow boot
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
```

- [ ] **Step 10: Run e2e and verify it passes**

Run: `npm run test:e2e -- fry-tower-game`
Expected: 2 passed (hub navigation + canvas mounts with 0 console errors).

- [ ] **Step 11: Run lint + type-check**

Run: `npm run lint` then `npx tsc --noEmit` (or the repo's `type-check` script)
Expected: 0 errors. (The game JS is ignored by eslint; only the new `page.tsx` and tests are checked.)

- [ ] **Step 12: Commit**

```bash
git add public/fry-tower-game app/fry-tower-game app/page.tsx eslint.config.mjs vitest.config.ts e2e/fry-tower-game.spec.ts
git commit -m "feat(fry-tower): walking skeleton + hub card (Phase 1.1)"
```

---

## Task 2: Pure logic — config + scoring (TDD)

**Files:**
- Create: `public/fry-tower-game/src/logic/config.js`, `public/fry-tower-game/src/logic/scoring.js`
- Test: `__tests__/unit/fry-tower-game/scoring.test.ts`

- [ ] **Step 1: Create `public/fry-tower-game/src/logic/config.js`**

```js
export const CONFIG = {
  round: { duration: 90 },                  // seconds per round
  fry: { length: 1.6, thickness: 0.18, mass: 0.2 },
  spawn: { y: 9, xRange: 2.4 },             // active fry hover height + max horizontal travel
  scoring: { perMeter: 100, stableBonus: 25, comboStep: 10, timeBonus: 2 },
  combo: { chargePerStable: 1, max: 10 },
  stability: { settleSpeed: 0.25, settleTime: 0.6 }, // body considered "stable" below this speed for this long
};
```

- [ ] **Step 2: Write the failing test `__tests__/unit/fry-tower-game/scoring.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { roundScore } from "../../../public/fry-tower-game/src/logic/scoring.js";

describe("roundScore", () => {
  it("is zero for an empty tower", () => {
    expect(roundScore({ height: 0, combo: 0, stableCount: 0, secondsLeft: 0 })).toBe(0);
  });
  it("increases with height", () => {
    const lo = roundScore({ height: 1, combo: 0, stableCount: 0, secondsLeft: 0 });
    const hi = roundScore({ height: 3, combo: 0, stableCount: 0, secondsLeft: 0 });
    expect(hi).toBeGreaterThan(lo);
  });
  it("adds stable, combo, and time bonuses", () => {
    const base = roundScore({ height: 2, combo: 0, stableCount: 0, secondsLeft: 0 });
    expect(roundScore({ height: 2, combo: 0, stableCount: 4, secondsLeft: 0 })).toBeGreaterThan(base);
    expect(roundScore({ height: 2, combo: 5, stableCount: 0, secondsLeft: 0 })).toBeGreaterThan(base);
    expect(roundScore({ height: 2, combo: 0, stableCount: 0, secondsLeft: 10 })).toBeGreaterThan(base);
  });
  it("clamps negative inputs to zero", () => {
    expect(roundScore({ height: -5, combo: -3, stableCount: -2, secondsLeft: -9 })).toBe(0);
  });
  it("returns an integer", () => {
    expect(Number.isInteger(roundScore({ height: 1.234, combo: 1, stableCount: 1, secondsLeft: 1 }))).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/fry-tower-game/scoring.test.ts`
Expected: FAIL (cannot find module `scoring.js`).

- [ ] **Step 4: Create `public/fry-tower-game/src/logic/scoring.js`**

```js
import { CONFIG } from './config.js';

// Pure scoring. All inputs clamped to >= 0; result is an integer.
export function roundScore({ height = 0, combo = 0, stableCount = 0, secondsLeft = 0 } = {}, cfg = CONFIG.scoring) {
  const h = Math.max(0, height) * cfg.perMeter;
  const stable = Math.max(0, stableCount) * cfg.stableBonus;
  const comboBonus = Math.max(0, combo) * cfg.comboStep;
  const time = Math.max(0, secondsLeft) * cfg.timeBonus;
  return Math.round(h + stable + comboBonus + time);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/fry-tower-game/scoring.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add public/fry-tower-game/src/logic/config.js public/fry-tower-game/src/logic/scoring.js __tests__/unit/fry-tower-game/scoring.test.ts
git commit -m "feat(fry-tower): config + pure scoring (Phase 1.2)"
```

---

## Task 3: Pure logic — combo (TDD)

**Files:**
- Create: `public/fry-tower-game/src/logic/combo.js`
- Test: `__tests__/unit/fry-tower-game/combo.test.ts`

- [ ] **Step 1: Write the failing test `__tests__/unit/fry-tower-game/combo.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createCombo, onStablePlacement, onCollapse } from "../../../public/fry-tower-game/src/logic/combo.js";

describe("combo", () => {
  it("starts at zero", () => {
    const c = createCombo();
    expect(c.count).toBe(0);
    expect(c.charge).toBe(0);
  });
  it("increments count and charge on a stable placement", () => {
    const c = onStablePlacement(createCombo());
    expect(c.count).toBe(1);
    expect(c.charge).toBe(1);
  });
  it("caps count and charge at the configured max", () => {
    let c = createCombo();
    for (let i = 0; i < 50; i++) c = onStablePlacement(c);
    expect(c.count).toBeLessThanOrEqual(10);
    expect(c.charge).toBeLessThanOrEqual(10);
  });
  it("resets the streak on collapse but keeps charge", () => {
    let c = onStablePlacement(onStablePlacement(createCombo())); // count 2, charge 2
    c = onCollapse(c);
    expect(c.count).toBe(0);
    expect(c.charge).toBe(2);
  });
  it("does not mutate the input state", () => {
    const c0 = createCombo();
    onStablePlacement(c0);
    expect(c0.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/fry-tower-game/combo.test.ts`
Expected: FAIL (cannot find module `combo.js`).

- [ ] **Step 3: Create `public/fry-tower-game/src/logic/combo.js`**

```js
import { CONFIG } from './config.js';

export function createCombo() { return { count: 0, charge: 0 }; }

// A stable placement extends the streak and charges sabotage (used in Phase 3).
export function onStablePlacement(c, cfg = CONFIG.combo) {
  return {
    count: Math.min(cfg.max, c.count + 1),
    charge: Math.min(cfg.max, c.charge + cfg.chargePerStable),
  };
}

// A collapse breaks the streak but does not drain stored charge.
export function onCollapse(c) {
  return { count: 0, charge: c.charge };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/fry-tower-game/combo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add public/fry-tower-game/src/logic/combo.js __tests__/unit/fry-tower-game/combo.test.ts
git commit -m "feat(fry-tower): pure combo/streak logic (Phase 1.3)"
```

---

## Task 4: Pure logic — round timer state machine (TDD)

**Files:**
- Create: `public/fry-tower-game/src/logic/round.js`
- Test: `__tests__/unit/fry-tower-game/round.test.ts`

- [ ] **Step 1: Write the failing test `__tests__/unit/fry-tower-game/round.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createRound, tickRound, isOver } from "../../../public/fry-tower-game/src/logic/round.js";

describe("round", () => {
  it("starts in the playing phase with the configured duration", () => {
    const r = createRound({ duration: 90 });
    expect(r.phase).toBe("playing");
    expect(r.timeLeft).toBe(90);
    expect(isOver(r)).toBe(false);
  });
  it("counts down by dt", () => {
    let r = createRound({ duration: 10 });
    r = tickRound(r, 1);
    expect(r.timeLeft).toBeCloseTo(9, 5);
    expect(r.phase).toBe("playing");
  });
  it("ends when time reaches zero", () => {
    let r = createRound({ duration: 1 });
    r = tickRound(r, 1.5);
    expect(r.phase).toBe("ended");
    expect(r.timeLeft).toBe(0);
    expect(isOver(r)).toBe(true);
  });
  it("does not change after it has ended", () => {
    let r = createRound({ duration: 1 });
    r = tickRound(r, 2);
    const ended = r;
    r = tickRound(r, 5);
    expect(r).toEqual(ended);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/unit/fry-tower-game/round.test.ts`
Expected: FAIL (cannot find module `round.js`).

- [ ] **Step 3: Create `public/fry-tower-game/src/logic/round.js`**

```js
import { CONFIG } from './config.js';

export function createRound(cfg = CONFIG.round) {
  return { phase: 'playing', timeLeft: cfg.duration };
}

export function tickRound(r, dt) {
  if (r.phase !== 'playing') return r;
  const t = r.timeLeft - dt;
  if (t <= 0) return { phase: 'ended', timeLeft: 0 };
  return { phase: 'playing', timeLeft: t };
}

export function isOver(r) { return r.phase === 'ended'; }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/unit/fry-tower-game/round.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full unit suite to confirm nothing regressed**

Run: `npm test`
Expected: all existing tests + the 3 new fry-tower files pass.

- [ ] **Step 6: Commit**

```bash
git add public/fry-tower-game/src/logic/round.js __tests__/unit/fry-tower-game/round.test.ts
git commit -m "feat(fry-tower): pure round timer state machine (Phase 1.4)"
```

---

## Task 5: Physics — cannon-es world + fry bodies + helpers

**Files:**
- Create: `public/fry-tower-game/src/physics/world.js`

> Physics integration is verified via play + e2e (Task 7), not unit tests (cannon-es is a runtime dependency). Keep this module THREE-free so it stays focused on simulation.

- [ ] **Step 1: Create `public/fry-tower-game/src/physics/world.js`**

```js
import * as CANNON from 'cannon-es';
import { CONFIG } from '../logic/config.js';

export function createPhysicsWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const fryMat = new CANNON.Material('fry');
  const trayMat = new CANNON.Material('tray');
  world.addContactMaterial(new CANNON.ContactMaterial(fryMat, fryMat, { friction: 0.5, restitution: 0.02 }));
  world.addContactMaterial(new CANNON.ContactMaterial(fryMat, trayMat, { friction: 0.7, restitution: 0.0 }));

  // Static tray (top surface at y = 0).
  const trayHalf = new CANNON.Vec3(3, 0.2, 3);
  const tray = new CANNON.Body({ mass: 0, material: trayMat, shape: new CANNON.Box(trayHalf) });
  tray.position.set(0, -0.2, 0);
  world.addBody(tray);

  return { world, fryMat, trayMat, trayTopY: 0 };
}

export function makeFryBody(fryMat, fry = CONFIG.fry) {
  const half = new CANNON.Vec3(fry.length / 2, fry.thickness / 2, fry.thickness / 2);
  const body = new CANNON.Body({ mass: fry.mass, material: fryMat, shape: new CANNON.Box(half) });
  body.sleepSpeedLimit = CONFIG.stability.settleSpeed;
  body.sleepTimeLimit = CONFIG.stability.settleTime;
  return body;
}

// Tower height = highest fry top above the tray, ignoring fries that fell off.
export function towerHeight(bodies, trayTopY = 0, fry = CONFIG.fry) {
  let top = trayTopY;
  for (const b of bodies) {
    if (b.position.y < trayTopY - 1.5) continue; // fell off the tray
    const topY = b.position.y + fry.thickness / 2;
    if (topY > top) top = topY;
  }
  return Math.max(0, top - trayTopY);
}

// A body is "settled" when its speed is below the stability threshold.
export function isSettled(body, cfg = CONFIG.stability) {
  return body.velocity.length() < cfg.settleSpeed && body.angularVelocity.length() < cfg.settleSpeed;
}

// Count fries that have fallen below the tray (collapse signal).
export function fallenCount(bodies, trayTopY = 0) {
  let n = 0;
  for (const b of bodies) if (b.position.y < trayTopY - 1.5) n++;
  return n;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/fry-tower-game/src/physics/world.js
git commit -m "feat(fry-tower): cannon-es world + fry bodies + height/stability helpers (Phase 1.5)"
```

---

## Task 6: Render — cartoon materials + fry/tray meshes + stage

**Files:**
- Create: `public/fry-tower-game/src/render/materials.js`, `public/fry-tower-game/src/render/fryMesh.js`, `public/fry-tower-game/src/render/Stage.js`

- [ ] **Step 1: Create `public/fry-tower-game/src/render/materials.js`**

```js
import * as THREE from 'three';

export const COLORS = { fry: 0xf7b330, tray: 0xe23434, bg: 0xffe39a, outline: 0x2a1b08 };

// Stepped gradient → cartoon toon shading.
let _grad = null;
function gradientMap() {
  if (_grad) return _grad;
  const data = new Uint8Array([80, 150, 220, 255]);
  _grad = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  _grad.needsUpdate = true;
  return _grad;
}

export function toonMaterial(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
}

// Inverted-hull outline: a slightly larger back-faced black shell.
export function outlineMesh(geometry, scale = 1.08) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide }));
  mesh.scale.multiplyScalar(scale);
  return mesh;
}
```

- [ ] **Step 2: Create `public/fry-tower-game/src/render/fryMesh.js`**

```js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { toonMaterial, outlineMesh, COLORS } from './materials.js';

// A fry = bold-outlined toon box. Returns a Group whose transform we sync to the physics body.
export function makeFryMesh(fry = CONFIG.fry) {
  const geo = new THREE.BoxGeometry(fry.length, fry.thickness, fry.thickness);
  const group = new THREE.Group();
  group.add(outlineMesh(geo));
  group.add(new THREE.Mesh(geo, toonMaterial(COLORS.fry)));
  return group;
}

export function makeTrayMesh() {
  const geo = new THREE.BoxGeometry(6, 0.4, 6);
  const group = new THREE.Group();
  group.add(outlineMesh(geo, 1.04));
  group.add(new THREE.Mesh(geo, toonMaterial(COLORS.tray)));
  group.position.y = -0.2; // top surface at y = 0, matching the physics tray
  return group;
}
```

- [ ] **Step 3: Create `public/fry-tower-game/src/render/Stage.js`**

```js
import * as THREE from 'three';
import { makeTrayMesh } from './fryMesh.js';
import { COLORS } from './materials.js';

// Lights + tray + a simple fast-food backdrop. A "system" with no update.
export class Stage {
  constructor(scene) {
    scene.background = new THREE.Color(COLORS.bg);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb98a4a, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.25);
    dir.position.set(5, 14, 8);
    scene.add(dir);

    scene.add(makeTrayMesh());

    // Backdrop counter plane.
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 24),
      new THREE.MeshToonMaterial({ color: 0xffcf6b })
    );
    back.position.set(0, 8, -8);
    scene.add(back);
  }
  update() {}
}
```

- [ ] **Step 4: Smoke-check render in the skeleton (manual/optional)**

Temporarily import `Stage` in `main.js` to confirm the tray renders with outline (this wiring is finalized in Task 7). No commit yet if only experimenting; otherwise:

- [ ] **Step 5: Commit**

```bash
git add public/fry-tower-game/src/render/materials.js public/fry-tower-game/src/render/fryMesh.js public/fry-tower-game/src/render/Stage.js
git commit -m "feat(fry-tower): cartoon materials + fry/tray meshes + stage (Phase 1.6)"
```

---

## Task 7: Gameplay — input, aim & drop, entity sync, wire logic + HUD; e2e solo round

**Files:**
- Create: `public/fry-tower-game/src/core/Input.js`, `public/fry-tower-game/src/entities/Fry.js`, `public/fry-tower-game/src/play/Session.js`, `public/fry-tower-game/src/ui/HUD.js`
- Modify: `public/fry-tower-game/src/main.js` (wire everything)
- Modify: `e2e/fry-tower-game.spec.ts` (add a solo-round e2e)

- [ ] **Step 1: Create `public/fry-tower-game/src/core/Input.js`**

```js
// Tracks the keys the game cares about. Exposes a snapshot each frame.
export class Input {
  constructor(target = window) {
    this.state = { left: false, right: false, rotL: false, rotR: false };
    this.dropQueued = false;
    this._onKey = (e, down) => {
      switch (e.code) {
        case 'ArrowLeft': this.state.left = down; break;
        case 'ArrowRight': this.state.right = down; break;
        case 'KeyQ': this.state.rotL = down; break;
        case 'KeyE': this.state.rotR = down; break;
        case 'Space': if (down) this.dropQueued = true; e.preventDefault(); break;
        default: return;
      }
    };
    target.addEventListener('keydown', (e) => this._onKey(e, true));
    target.addEventListener('keyup', (e) => this._onKey(e, false));
  }
  // Consume a queued drop (true at most once per press).
  takeDrop() { const d = this.dropQueued; this.dropQueued = false; return d; }
}
```

- [ ] **Step 2: Create `public/fry-tower-game/src/entities/Fry.js`**

```js
// Pairs a cannon body with a three group; sync() copies the transform.
export class Fry {
  constructor(body, mesh) {
    this.body = body;
    this.mesh = mesh;
  }
  sync() {
    const p = this.body.position, q = this.body.quaternion;
    this.mesh.position.set(p.x, p.y, p.z);
    this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }
}
```

- [ ] **Step 3: Create `public/fry-tower-game/src/play/Session.js` (solo controller)**

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from '../logic/config.js';
import { createPhysicsWorld, makeFryBody, towerHeight, isSettled, fallenCount } from '../physics/world.js';
import { makeFryMesh } from '../render/fryMesh.js';
import { Fry } from '../entities/Fry.js';
import { createRound, tickRound, isOver } from '../logic/round.js';
import { createCombo, onStablePlacement, onCollapse } from '../logic/combo.js';
import { roundScore } from '../logic/scoring.js';

// Owns the cannon world, the active (aiming) fry, placed fries, and pure-logic state.
export class Session {
  constructor(scene, { onEnd } = {}) {
    this.scene = scene;
    this.onEnd = onEnd || (() => {});
    const phys = createPhysicsWorld();
    this.world = phys.world;
    this.fryMat = phys.fryMat;
    this.trayTopY = phys.trayTopY;

    this.placed = [];          // Fry[] dropped
    this.bodies = [];          // CANNON.Body[] dropped (for height)
    this.active = null;        // { mesh, x, angle }
    this.round = createRound();
    this.combo = createCombo();
    this.score = 0;
    this.stableCount = 0;
    this._pendingSettle = [];  // bodies awaiting settle check
    this._spawnActive();
  }

  _spawnActive() {
    const mesh = makeFryMesh();
    mesh.position.set(0, CONFIG.spawn.y, 0);
    this.scene.add(mesh);
    this.active = { mesh, x: 0, angle: 0 };
  }

  // Move/rotate the aiming fry (called from update with input + dt).
  steer(input, dt) {
    if (!this.active) return;
    const a = this.active;
    const speed = 3.2, rot = 2.6;
    if (input.state.left) a.x -= speed * dt;
    if (input.state.right) a.x += speed * dt;
    a.x = THREE.MathUtils.clamp(a.x, -CONFIG.spawn.xRange, CONFIG.spawn.xRange);
    if (input.state.rotL) a.angle += rot * dt;
    if (input.state.rotR) a.angle -= rot * dt;
    a.mesh.position.x = a.x;
    a.mesh.rotation.z = a.angle;
  }

  // Convert the aiming fry into a dynamic body (drop it).
  drop() {
    if (!this.active) return;
    const a = this.active;
    const body = makeFryBody(this.fryMat);
    body.position.set(a.x, CONFIG.spawn.y, 0);
    const e = new THREE.Euler(0, 0, a.angle);
    const q = new THREE.Quaternion().setFromEuler(e);
    body.quaternion.set(q.x, q.y, q.z, q.w);
    this.world.addBody(body);

    const fry = new Fry(body, a.mesh);
    this.placed.push(fry);
    this.bodies.push(body);
    this._pendingSettle.push({ body, t: 0 });
    this.active = null;
    this._spawnActive();
  }

  _resolveSettles(dt) {
    for (let i = this._pendingSettle.length - 1; i >= 0; i--) {
      const s = this._pendingSettle[i];
      s.t += dt;
      const fell = s.body.position.y < this.trayTopY - 1.5;
      if (fell) { this.combo = onCollapse(this.combo); this._pendingSettle.splice(i, 1); continue; }
      if (s.t > CONFIG.stability.settleTime && isSettled(s.body)) {
        this.combo = onStablePlacement(this.combo);
        this.stableCount += 1;
        this._pendingSettle.splice(i, 1);
      }
    }
  }

  update(dt, input) {
    if (isOver(this.round)) return;
    if (input && input.takeDrop()) this.drop();
    if (input) this.steer(input, dt);

    this.world.step(1 / 60, dt, 3);
    for (const f of this.placed) f.sync();
    this._resolveSettles(dt);

    const height = towerHeight(this.bodies, this.trayTopY);
    this.score = roundScore({
      height, combo: this.combo.count, stableCount: this.stableCount,
      secondsLeft: this.round.timeLeft,
    });

    const prev = this.round.phase;
    this.round = tickRound(this.round, dt);
    if (prev === 'playing' && isOver(this.round)) {
      this.onEnd({ height, score: this.score, fallen: fallenCount(this.bodies, this.trayTopY) });
    }
  }

  get height() { return towerHeight(this.bodies, this.trayTopY); }
}
```

- [ ] **Step 4: Create `public/fry-tower-game/src/ui/HUD.js`**

```js
// Reads the session and writes the HUD DOM each frame.
export class HUD {
  constructor(session) {
    this.session = session;
    this.height = document.getElementById('height-val');
    this.time = document.getElementById('time-val');
    this.score = document.getElementById('score-val');
    this.combo = document.getElementById('combo-val');
  }
  update() {
    const s = this.session;
    this.height.textContent = s.height.toFixed(1);
    this.time.textContent = Math.ceil(s.round.timeLeft);
    this.score.textContent = s.score;
    this.combo.textContent = s.combo.count;
  }
}
```

- [ ] **Step 5: Rewrite `public/fry-tower-game/src/main.js` to wire gameplay**

```js
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { Stage } from './render/Stage.js';
import { Session } from './play/Session.js';
import { HUD } from './ui/HUD.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const result = document.getElementById('result');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const resultDetail = document.getElementById('result-detail');

let game = null;
try {
  game = new Game(canvas);
} catch (err) {
  console.error('[fry-tower] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  game.add(new Stage(game.scene));
  const input = new Input();
  let session = null;

  function startGame() {
    menu.classList.add('hidden');
    result.classList.add('hidden');
    hud.classList.remove('hidden');
    session = new Session(game.scene, {
      onEnd: ({ height, score }) => {
        resultDetail.textContent = `높이 ${height.toFixed(1)}m · 점수 ${score}`;
        result.classList.remove('hidden');
      },
    });
    // Drive the session + HUD from the game loop.
    const hudView = new HUD(session);
    game.add({ update: (dt) => session.update(dt, input) });
    game.add(hudView);
    game.start();
    // expose for e2e
    window.__fry = { get session() { return session; } };
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => location.reload());

  game.renderOnce();
  console.log('[fry-tower] ready');
}
```

> Restart via `location.reload()` keeps Phase 1 simple and leak-free (a clean session/world rebuild is a Phase 3 polish item). The `window.__fry` hook is used only by e2e and is harmless in production.

- [ ] **Step 6: Add a solo-round e2e to `e2e/fry-tower-game.spec.ts`**

Append this test inside the `describe` block:

```ts
  test("a solo round starts, places fries, and tracks height with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();

    // Drop a few fries.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1200); // let them settle

    const height = await page.evaluate(() => window.__fry?.session?.height ?? -1);
    expect(height).toBeGreaterThan(0);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
```

Add this type declaration at the top of the file (after the imports) so `window.__fry` type-checks:

```ts
declare global {
  interface Window { __fry?: { session?: { height: number } }; }
}
```

- [ ] **Step 7: Run the e2e suite**

Run: `npm run test:e2e -- fry-tower-game`
Expected: 3 passed (hub nav, canvas mounts, solo round). If height is 0, increase the settle wait or lower `spawn.y` in `config.js` and re-run (play-verify tuning).

- [ ] **Step 8: Play-verify manually**

Run the dev server, open the game, press start, and confirm: an aiming fry hovers and moves with `←/→` and rotates with `Q/E`; `Space` drops it with physics; the tower height/score/combo update; the timer ends the round and shows the result; "다시 쌓기" restarts. Note any physics-feel tuning in `config.js` / `world.js`.

- [ ] **Step 9: Commit**

```bash
git add public/fry-tower-game/src/core/Input.js public/fry-tower-game/src/entities/Fry.js public/fry-tower-game/src/play/Session.js public/fry-tower-game/src/ui/HUD.js public/fry-tower-game/src/main.js e2e/fry-tower-game.spec.ts
git commit -m "feat(fry-tower): aim & drop physics gameplay + HUD + solo e2e (Phase 1.7)"
```

---

## Task 8: Juice + result polish + final Phase 1 gates

**Files:**
- Create: `public/fry-tower-game/src/render/Fx.js`
- Modify: `public/fry-tower-game/src/play/Session.js` (squash on drop, dust on fall), `public/fry-tower-game/src/core/Game.js` (camera shake hook)

- [ ] **Step 1: Create `public/fry-tower-game/src/render/Fx.js`**

```js
import * as THREE from 'three';

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Small pooled dust burst + a decaying camera-shake offset.
export class Fx {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this._shake = 0;
    this._base = camera.position.clone();
    this.sprites = [];
    const tex = makeDotTexture();
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xdcb86a, transparent: true, opacity: 0 }));
      s.visible = false; scene.add(s); this.sprites.push({ s, life: 0, vel: new THREE.Vector3() });
    }
  }
  burst(x, y, z) {
    if (reduced) return;
    for (const p of this.sprites) {
      if (p.life > 0) continue;
      p.s.position.set(x, y, z); p.s.visible = true; p.life = 0.6;
      p.vel.set((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3);
      p.s.material.opacity = 1;
      if (--this._spawnBudget <= 0) break;
    }
  }
  shake(amp) { if (!reduced) this._shake = Math.max(this._shake, amp); }
  update(dt) {
    this._spawnBudget = 8;
    for (const p of this.sprites) {
      if (p.life <= 0) continue;
      p.life -= dt; p.vel.y -= 6 * dt;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.material.opacity = Math.max(0, p.life / 0.6);
      if (p.life <= 0) p.s.visible = false;
    }
    if (this._shake > 0.001) {
      this.camera.position.set(
        this._base.x + (Math.random() - 0.5) * this._shake,
        this._base.y + (Math.random() - 0.5) * this._shake,
        this._base.z
      );
      this._shake *= Math.pow(0.001, dt);
    } else {
      this.camera.position.copy(this._base);
    }
  }
}

function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(8, 8, 7, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
```

- [ ] **Step 2: Hook Fx into the session/loop**

In `main.js`, create the Fx after the stage and pass it to the session; add it as a system:

```js
import { Fx } from './render/Fx.js';
// ...inside the `if (game)` block, before startGame:
const fx = new Fx(game.scene, game.camera);
game.add(fx);
```

Pass `fx` into `Session` (extend its options) and call `fx.burst(...)` when a fry falls (in `_resolveSettles`) and `fx.shake(0.25)` on a fall; call a small squash tween on `drop()`. Update the `Session` constructor signature to accept `{ onEnd, fx }` and guard all `fx` calls with `if (this.fx)`.

- [ ] **Step 3: Run e2e to confirm no regressions / no console errors**

Run: `npm run test:e2e -- fry-tower-game`
Expected: 3 passed, 0 console errors (Fx must not throw when `matchMedia` reduces motion).

- [ ] **Step 4: Run ALL gates**

Run, expecting green:
- `npm test` (unit — existing + 14 new fry-tower assertions)
- `npm run lint`
- `npx tsc --noEmit`
- `npm run test:e2e -- fry-tower-game`

- [ ] **Step 5: Play-verify the full Phase 1 loop**

Confirm the complete solo experience feels good: aim, drop, teeter, collapse dust + shake, height/score/combo, timed end + result + restart. Tune `config.js` constants as needed and re-run gates.

- [ ] **Step 6: Commit**

```bash
git add public/fry-tower-game/src/render/Fx.js public/fry-tower-game/src/play/Session.js public/fry-tower-game/src/core/Game.js public/fry-tower-game/src/main.js
git commit -m "feat(fry-tower): juice (dust burst + camera shake) + Phase 1 polish (Phase 1.8)"
```

---

## Done criteria (Phase 1)

- The hub shows a 5th "Fryffel Tower" card linking to a working solo game.
- Aim & place physics stacking with cartoon visuals, timed height race, score + combo, juice, and restart.
- Gates green: unit (incl. scoring/combo/round), lint, type-check, e2e (canvas + solo round, 0 console errors).
- Play-verified. Ready to merge via superpowers:finishing-a-development-branch → Vercel auto-deploy.

After Phase 1 merges and deploys, write the **Phase 2 (real-time multiplayer)** plan.
