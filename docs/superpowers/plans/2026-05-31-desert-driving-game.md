# Dust Drifter (사막 자유 주행) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th mini-game — a low-poly 3D free-roam desert driving game ("Dust Drifter") built with Three.js, where the player cruises golden dunes, kicks up dust, discovers horizon landmarks, grabs glowing collectibles, and watches a day↔night cycle.

**Architecture:** Self-contained vanilla ES-module game under `public/desert-game/`, loaded by an `<iframe>` from `app/desert-game/page.tsx`. Three.js comes from a jsdelivr importmap (no build step). Pure, THREE-free logic (`src/logic/`) is unit-tested with Vitest; rendering modules are verified via Playwright e2e (canvas present, no console errors) + manual visual checks.

**Tech Stack:** Three.js (CDN importmap), vanilla ES modules, Web Audio API, Next.js 16 route wrapper, Vitest (logic), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-05-31-desert-driving-game-design.md`

---

## File Structure

| File | Responsibility | Tested by |
|---|---|---|
| `app/desert-game/page.tsx` | Next route: fullscreen iframe + Home button | e2e |
| `public/desert-game/index.html` | importmap, `<canvas>`, HUD/menu DOM, WebGL fallback | e2e |
| `public/desert-game/style.css` | HUD/menu styling | — |
| `public/desert-game/src/main.js` | Bootstrap: build Game, wire menu, start | manual |
| `public/desert-game/src/core/Game.js` | Scene/renderer/camera/loop/state orchestration, resize, pause | e2e + manual |
| `public/desert-game/src/core/Input.js` | keyboard → `InputState` (multiplayer seam) | manual |
| `public/desert-game/src/world/Terrain.js` | dune mesh from height fn + `getHeightAt(x,z)` | manual |
| `public/desert-game/src/world/Sky.js` | sun/light/sky color/stars/headlights per time | manual |
| `public/desert-game/src/world/Landmarks.js` | 7 landmarks + beams + discovery reveal | manual |
| `public/desert-game/src/world/Collectibles.js` | 20 crystals + pickup | manual |
| `public/desert-game/src/vehicle/Car.js` | car mesh + wheels/suspension, drives via carPhysics | manual |
| `public/desert-game/src/vehicle/DustEmitter.js` | GPU particle dust (THREE.Points pool) | manual |
| `public/desert-game/src/camera/ChaseCamera.js` | 3rd-person follow + aerial toggle | manual |
| `public/desert-game/src/ui/HUD.js` | speed/discovery/collectible/time/pointer DOM | manual |
| `public/desert-game/src/ui/Menu.js` | start/controls/pause overlays | manual |
| `public/desert-game/src/audio/AudioManager.js` | engine/wind/chime/fanfare (Web Audio) | manual |
| `public/desert-game/src/logic/config.js` | tunable constants | — |
| `public/desert-game/src/logic/noise.js` | deterministic value noise + terrain height | **unit** |
| `public/desert-game/src/logic/carPhysics.js` | arcade kinematic step (pure) | **unit** |
| `public/desert-game/src/logic/dayNight.js` | time → sun dir + sky colors | **unit** |
| `public/desert-game/src/logic/discovery.js` | nearest/within-radius landmark & collectible logic | **unit** |
| `__tests__/unit/desert-game/*.test.ts` | unit tests for logic modules | — |
| `e2e/desert-game.spec.ts` | hub→game nav, canvas, no console errors | — |

**Config changes:** add `public/desert-game/**` to `eslint.config.mjs` `globalIgnores`; add `public/desert-game/src/**` to `vitest.config.ts` `coverage.include`; add hub card to `app/page.tsx`; add game-list entry to `README.md`.

---

## Phase 0 — Scaffold & Integration (black canvas renders)

### Task 1: Game shell — directory, index.html (importmap), style.css, smoke main.js

**Files:**
- Create: `public/desert-game/index.html`
- Create: `public/desert-game/style.css`
- Create: `public/desert-game/src/main.js`

- [ ] **Step 1: Verify the Three.js version to pin.** Open `https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js` in a browser (or `curl -I`). Expected: HTTP 200. If 404, pick the latest stable from https://www.npmjs.com/package/three and use that version everywhere in this plan.

- [ ] **Step 2: Write `index.html`** with importmap, canvas, menu/HUD DOM placeholders, and a WebGL fallback.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dust Drifter — 사막 자유 주행</title>
  <link rel="stylesheet" href="./style.css" />
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <canvas id="game"></canvas>

  <div id="webgl-error" class="overlay hidden">
    <div class="panel"><h1>WebGL을 사용할 수 없습니다</h1><p>WebGL을 지원하는 최신 브라우저에서 실행해 주세요.</p></div>
  </div>

  <div id="menu" class="overlay">
    <div class="panel">
      <h1 class="title">DUST DRIFTER</h1>
      <p class="subtitle">황혼의 사막을 자유롭게 누비세요</p>
      <button id="start-btn" class="btn-primary">주행 시작</button>
      <div class="controls">
        <span>↑ / W</span><span>가속</span>
        <span>↓ / S</span><span>감속·후진</span>
        <span>← → / A D</span><span>조향</span>
        <span>Space</span><span>드리프트(핸드브레이크)</span>
        <span>C</span><span>카메라 전환</span>
        <span>R</span><span>차량 리셋</span>
      </div>
    </div>
  </div>

  <div id="hud" class="hidden">
    <div id="hud-speed"><span id="speed-val">0</span><small>km/h</small></div>
    <div id="hud-discovery">🗺️ <span id="disc-val">0</span> / <span id="disc-total">7</span></div>
    <div id="hud-time">🌅 <span id="time-label">낮</span></div>
    <div id="hud-collect">💎 <span id="collect-val">0</span> / <span id="collect-total">20</span></div>
    <div id="hud-pointer">➤ <span id="pointer-dist">--</span></div>
    <div id="hud-hint">↑↓←→ / WASD · Space 드리프트 · C 카메라 · R 리셋</div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `style.css`** (dark fallback, centered overlays, HUD corners).

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1410; font-family: system-ui, sans-serif; }
#game { display: block; width: 100%; height: 100%; }
.hidden { display: none !important; }
.overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, #2a1d12, #4a2f1a); z-index: 10; }
.panel { background: rgba(0,0,0,.45); border: 1px solid rgba(255,210,150,.25); border-radius: 18px;
  padding: 40px 48px; text-align: center; backdrop-filter: blur(8px); color: #fff; max-width: 520px; }
.title { font-size: 52px; letter-spacing: 4px; color: #ffd98a; text-shadow: 0 0 24px rgba(255,180,90,.6); }
.subtitle { margin: 10px 0 28px; color: #ffcf9e; }
.btn-primary { font-size: 20px; font-weight: 700; color: #3a230f; background: linear-gradient(135deg,#ffd98a,#ff9d57);
  border: none; border-radius: 14px; padding: 14px 40px; cursor: pointer; transition: transform .15s; }
.btn-primary:hover { transform: scale(1.05); }
.controls { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin-top: 26px; font-size: 13px; color: #e8d3b8; text-align: left; }
.controls span:nth-child(odd) { font-weight: 700; color: #ffd98a; }
#hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.6); }
#hud-speed { position: absolute; left: 18px; bottom: 16px; font-size: 30px; font-weight: 800; }
#hud-speed small { font-size: 12px; font-weight: 600; margin-left: 4px; }
#hud-discovery { position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,.4); padding: 6px 14px; border-radius: 20px; font-weight: 700; }
#hud-time { position: absolute; top: 14px; right: 16px; background: rgba(0,0,0,.4); padding: 6px 14px; border-radius: 20px; color: #ffe2a8; font-weight: 700; }
#hud-collect { position: absolute; top: 50px; right: 16px; background: rgba(0,0,0,.4); padding: 6px 14px; border-radius: 20px; color: #7fe9ff; font-weight: 700; }
#hud-pointer { position: absolute; top: 50px; left: 50%; transform: translateX(-50%); font-weight: 700; font-size: 13px; }
#hud-hint { position: absolute; left: 18px; top: 14px; font-size: 11px; opacity: .8; }
.toast { position: fixed; top: 90px; left: 50%; transform: translateX(-50%); z-index: 8;
  background: rgba(0,0,0,.6); color: #ffe2a8; padding: 12px 22px; border-radius: 12px; font-weight: 700;
  transition: opacity .4s; pointer-events: none; }
```

- [ ] **Step 4: Write smoke `src/main.js`** — confirm Three.js loads and renders a clear color.

```js
import * as THREE from 'three';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xf0a45a, 1); // sandy clear color — proves Three.js works
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 5, 10);
renderer.render(scene, camera);
console.log('[desert-game] boot ok');
```

- [ ] **Step 5: Verify locally.** Run `npm run dev`, open `http://localhost:3000/desert-game/index.html`. Expected: sandy-orange screen, console logs `[desert-game] boot ok`, no errors.

- [ ] **Step 6: Commit.**

```bash
git add public/desert-game/index.html public/desert-game/style.css public/desert-game/src/main.js
git commit -m "feat(desert-game): scaffold game shell with Three.js importmap"
```

### Task 2: Next route + hub card + config wiring

**Files:**
- Create: `app/desert-game/page.tsx`
- Modify: `app/page.tsx` (add card)
- Modify: `eslint.config.mjs` (ignore `public/desert-game/**`)
- Modify: `vitest.config.ts` (coverage include)

- [ ] **Step 1: Write `app/desert-game/page.tsx`** (mirror the simplest hub pattern — fullscreen iframe + Home button).

```tsx
"use client";

import Link from "next/link";

export default function DesertGame() {
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
      <iframe src="/desert-game/index.html" className="h-full w-full border-0" title="Dust Drifter - 사막 자유 주행" allow="fullscreen" />
    </div>
  );
}
```

- [ ] **Step 2: Add the hub card to `app/page.tsx`.** Insert a new `<Link href="/desert-game">` card after the flight-game card (before the closing `</div>` of the grid). Match the existing card markup; use a desert palette.

```tsx
          {/* 사막 드라이빙 카드 */}
          <Link href="/desert-game">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-orange-500/50 cursor-pointer">
              <div className="absolute -right-8 -top-8 text-9xl opacity-20">🏜️</div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">Dust Drifter</h2>
                <p className="mb-4 text-white/90">황혼의 사막을 자유롭게 누비세요!</p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ 3D 로우폴리 사막 오픈 월드</li>
                  <li>✓ 먼지 휘날리는 드리프트 · 빅에어</li>
                  <li>✓ 신기루 탐험 · 낮↔밤 순환</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>
```

- [ ] **Step 3: Add eslint ignore.** In `eslint.config.mjs`, inside the `globalIgnores([...])` array, add `"public/desert-game/**",` next to the other game ignores.

- [ ] **Step 4: Add coverage include.** In `vitest.config.ts`, add `'public/desert-game/src/**',` to `coverage.include`.

- [ ] **Step 5: Verify CI checks pass.**

Run: `npm run lint && npm run type-check`
Expected: lint 0 errors; type-check clean.

- [ ] **Step 6: Verify navigation.** `npm run dev`, open `http://localhost:3000`, click the "Dust Drifter" card. Expected: route loads, iframe shows the sandy screen, "홈으로" returns to hub.

- [ ] **Step 7: Commit.**

```bash
git add app/desert-game/page.tsx app/page.tsx eslint.config.mjs vitest.config.ts
git commit -m "feat(desert-game): add route, hub card, and lint/coverage wiring"
```

### Task 3: Smoke e2e test

**Files:**
- Create: `e2e/desert-game.spec.ts`

- [ ] **Step 1: Write the e2e test.** (Reference `e2e/hub.spec.ts` for the project's Playwright patterns — base URL, selectors.)

```ts
import { test, expect } from "@playwright/test";

test.describe("Dust Drifter desert game", () => {
  test("hub card navigates to the game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Dust Drifter/ }).click();
    await expect(page).toHaveURL(/\/desert-game/);
    await expect(page.locator('iframe[title*="Dust Drifter"]')).toBeVisible();
  });

  test("game canvas mounts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/desert-game/index.html");
    await expect(page.locator("canvas#game")).toBeVisible();
    await page.waitForTimeout(1500); // allow boot
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it.**

Run: `npx playwright test e2e/desert-game.spec.ts`
Expected: 2 passed. (If chromium is missing: `npx playwright install chromium`.)

- [ ] **Step 3: Commit.**

```bash
git add e2e/desert-game.spec.ts
git commit -m "test(desert-game): smoke e2e for navigation and canvas boot"
```

---

## Phase 1 — Pure Logic (TDD, THREE-free)

> All modules in `src/logic/` use only plain JS (no `import 'three'`, no DOM) so Vitest imports them directly. Test files are TypeScript under `__tests__/unit/desert-game/`.

### Task 4: `noise.js` — deterministic value noise + terrain height

**Files:**
- Create: `public/desert-game/src/logic/noise.js`
- Test: `__tests__/unit/desert-game/noise.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
// @ts-expect-error - vanilla JS module
import { makeValueNoise, terrainHeight } from "@/public/desert-game/src/logic/noise.js";

describe("noise", () => {
  it("is deterministic for a given seed", () => {
    const a = makeValueNoise(42);
    const b = makeValueNoise(42);
    expect(a(1.5, 2.5)).toBeCloseTo(b(1.5, 2.5), 10);
  });
  it("returns values within [-1, 1]", () => {
    const n = makeValueNoise(7);
    for (let i = 0; i < 200; i++) {
      const v = n(i * 0.37, i * 0.91);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("different seeds usually differ", () => {
    expect(makeValueNoise(1)(3, 3)).not.toBeCloseTo(makeValueNoise(2)(3, 3), 5);
  });
  it("terrainHeight is deterministic and finite", () => {
    expect(terrainHeight(10, 20, 99)).toBeCloseTo(terrainHeight(10, 20, 99), 10);
    expect(Number.isFinite(terrainHeight(0, 0, 1))).toBe(true);
  });
  it("terrainHeight near origin is flattened (spawn pad)", () => {
    expect(Math.abs(terrainHeight(0, 0, 1))).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: Run, verify it fails.** Run: `npx vitest run __tests__/unit/desert-game/noise.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `noise.js`.**

```js
// Deterministic 2D value noise (no deps). Returns a sampler in [-1, 1].
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967295; // [0,1]
}
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function makeValueNoise(seed = 0) {
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const v00 = hash2(x0, y0, seed), v10 = hash2(x0 + 1, y0, seed);
    const v01 = hash2(x0, y0 + 1, seed), v11 = hash2(x0 + 1, y0 + 1, seed);
    const top = lerp(v00, v10, fx), bot = lerp(v01, v11, fx);
    return lerp(top, bot, fy) * 2 - 1; // [-1,1]
  };
}

// Multi-octave dune height. Origin is flattened into a spawn pad.
export function terrainHeight(x, z, seed = 1) {
  const n = makeValueNoise(seed);
  let h = 0, amp = 1, freq = 0.012, sum = 0;
  for (let o = 0; o < 4; o++) {
    h += n(x * freq, z * freq) * amp;
    sum += amp; amp *= 0.5; freq *= 2.1;
  }
  h = (h / sum) * 26; // peak dune height ~26 units
  const d = Math.hypot(x, z);
  const flatten = Math.min(1, d / 60); // flat within ~60 units of origin
  return h * flatten;
}
```

- [ ] **Step 4: Run, verify pass.** Run: `npx vitest run __tests__/unit/desert-game/noise.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add public/desert-game/src/logic/noise.js __tests__/unit/desert-game/noise.test.ts
git commit -m "feat(desert-game): deterministic value noise + terrain height (TDD)"
```

### Task 5: `carPhysics.js` — arcade kinematic step

Model: state carries facing `heading` and motion direction `velHeading`; their difference is the visible **drift**. Grip rotates `velHeading` toward `heading` (slower while handbraking). The car sticks to the ground unless it crests a falling slope fast enough to launch (airborne + gravity).

**Files:**
- Create: `public/desert-game/src/logic/carPhysics.js`
- Test: `__tests__/unit/desert-game/carPhysics.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
// @ts-expect-error - vanilla JS module
import { createCarState, stepCar, CAR } from "@/public/desert-game/src/logic/carPhysics.js";

const flat = () => 0;
const noInput = { throttle: 0, steer: 0, handbrake: false };

describe("carPhysics", () => {
  it("accelerates forward under throttle, capped at maxSpeed", () => {
    let s = createCarState();
    for (let i = 0; i < 600; i++) s = stepCar(s, { ...noInput, throttle: 1 }, 1 / 60, flat);
    expect(s.speed).toBeGreaterThan(0);
    expect(s.speed).toBeLessThanOrEqual(CAR.maxSpeed + 1e-6);
  });
  it("rolls to a stop with no throttle (friction)", () => {
    let s = createCarState(); s.speed = 20; s.velHeading = 0;
    for (let i = 0; i < 600; i++) s = stepCar(s, noInput, 1 / 60, flat);
    expect(s.speed).toBeLessThan(1);
  });
  it("steering changes heading more at speed than at rest", () => {
    let moving = createCarState(); moving.speed = 20; moving.velHeading = 0;
    moving = stepCar(moving, { ...noInput, steer: 1 }, 0.2, flat);
    let still = createCarState(); still.speed = 0;
    still = stepCar(still, { ...noInput, steer: 1 }, 0.2, flat);
    expect(Math.abs(moving.heading)).toBeGreaterThan(Math.abs(still.heading));
  });
  it("handbrake produces a larger drift angle than normal driving", () => {
    const run = (hb: boolean) => {
      let s = createCarState(); s.speed = 25; s.velHeading = 0; s.heading = 0;
      for (let i = 0; i < 30; i++) s = stepCar(s, { throttle: 0.4, steer: 1, handbrake: hb }, 1 / 60, flat);
      return Math.abs(s.heading - s.velHeading);
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });
  it("launches airborne when cresting a fast-falling slope, then lands", () => {
    // ground drops from 12 -> 0 across the step → launch
    let calls = 0;
    const crest = () => (calls++ === 0 ? 12 : 0);
    let s = createCarState(); s.y = 12; s.speed = 30; s.velHeading = 0;
    s = stepCar(s, noInput, 1 / 60, crest);
    expect(s.airborne).toBe(true);
    expect(s.vy).toBeGreaterThan(0);
    let landed = s;
    for (let i = 0; i < 600 && landed.airborne; i++) landed = stepCar(landed, noInput, 1 / 60, flat);
    expect(landed.airborne).toBe(false);
    expect(landed.y).toBeCloseTo(0, 1);
  });
  it("stays glued to flat ground when grounded", () => {
    let s = createCarState(); s.speed = 15; s.velHeading = 0;
    s = stepCar(s, noInput, 1 / 60, flat);
    expect(s.airborne).toBe(false);
    expect(s.y).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run, verify it fails.** Run: `npx vitest run __tests__/unit/desert-game/carPhysics.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `carPhysics.js`.**

```js
export const CAR = {
  maxSpeed: 40, maxReverse: 12, accel: 26, rollFriction: 7, brakeFriction: 26,
  steerRate: 2.2, gripNormal: 7, gripHandbrake: 1.6, gravity: 32, launchMin: 10,
};

export function createCarState(x = 0, z = 0) {
  return { x, z, y: 0, heading: 0, velHeading: 0, speed: 0, vy: 0, airborne: false };
}

const approach = (val, target, rate, dt) => {
  if (val < target) return Math.min(target, val + rate * dt);
  return Math.max(target, val - rate * dt);
};
function rotateToward(a, target, maxStep) {
  let d = target - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}

export function stepCar(state, input, dt, getGroundHeight) {
  const s = { ...state };
  const throttle = Math.max(-1, Math.min(1, input.throttle || 0));
  const steer = Math.max(-1, Math.min(1, input.steer || 0));

  if (s.airborne) {
    s.vy -= CAR.gravity * dt;
    s.y += s.vy * dt;
    s.x += Math.cos(s.velHeading) * s.speed * dt;
    s.z += Math.sin(s.velHeading) * s.speed * dt;
    const g = getGroundHeight(s.x, s.z);
    if (s.y <= g) { s.y = g; s.vy = 0; s.airborne = false; }
    return s;
  }

  // longitudinal
  if (throttle !== 0) s.speed += throttle * CAR.accel * dt;
  else s.speed = approach(s.speed, 0, CAR.rollFriction, dt);
  if (input.handbrake) s.speed = approach(s.speed, 0, CAR.brakeFriction, dt);
  s.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, s.speed));

  // steering scales with speed (sign-aware)
  const speedFactor = Math.min(1, Math.abs(s.speed) / 12);
  s.heading += steer * CAR.steerRate * speedFactor * dt * Math.sign(s.speed || 1);

  // grip: velocity direction chases facing; handbrake loosens it → drift
  const grip = input.handbrake ? CAR.gripHandbrake : CAR.gripNormal;
  s.velHeading = rotateToward(s.velHeading, s.heading, grip * dt);

  // integrate position along motion direction
  s.x += Math.cos(s.velHeading) * s.speed * dt;
  s.z += Math.sin(s.velHeading) * s.speed * dt;

  // ground follow / launch
  const prevGround = state.y;
  const g = getGroundHeight(s.x, s.z);
  const dropRate = (prevGround - g) / dt; // how fast ground falls away
  if (Math.abs(s.speed) > CAR.launchMin && dropRate > CAR.launchMin) {
    s.airborne = true;
    s.vy = Math.min(dropRate, 22);
    s.y = prevGround;
  } else {
    s.y = g;
    s.vy = 0;
  }
  return s;
}
```

- [ ] **Step 4: Run, verify pass.** Run: `npx vitest run __tests__/unit/desert-game/carPhysics.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit.**

```bash
git add public/desert-game/src/logic/carPhysics.js __tests__/unit/desert-game/carPhysics.test.ts
git commit -m "feat(desert-game): arcade car physics with drift and big-air (TDD)"
```

### Task 6: `dayNight.js` — time → sun direction + sky colors

**Files:**
- Create: `public/desert-game/src/logic/dayNight.js`
- Test: `__tests__/unit/desert-game/dayNight.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
// @ts-expect-error - vanilla JS module
import { sunDirection, skyPalette, timeLabel, isNight } from "@/public/desert-game/src/logic/dayNight.js";

describe("dayNight", () => {
  it("sun is highest at noon (t=0.25) and below horizon at midnight (t=0.75)", () => {
    expect(sunDirection(0.25).y).toBeGreaterThan(0.8);
    expect(sunDirection(0.75).y).toBeLessThan(0);
  });
  it("sun direction is a unit vector", () => {
    const d = sunDirection(0.4);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 5);
  });
  it("is periodic in t", () => {
    expect(sunDirection(0.1).y).toBeCloseTo(sunDirection(1.1).y, 6);
  });
  it("skyPalette returns finite rgb in [0,1] for top/bottom/fog", () => {
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const p = skyPalette(t);
      for (const c of [p.top, p.bottom, p.fog]) {
        for (const ch of [c.r, c.g, c.b]) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it("flags night correctly", () => {
    expect(isNight(0.75)).toBe(true);
    expect(isNight(0.25)).toBe(false);
    expect(typeof timeLabel(0.5)).toBe("string");
  });
});
```

- [ ] **Step 2: Run, verify fail.** Run: `npx vitest run __tests__/unit/desert-game/dayNight.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `dayNight.js`.**

```js
// t in [0,1): 0 dawn, 0.25 noon, 0.5 dusk, 0.75 midnight.
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => ({ r: lerp(c1.r, c2.r, t), g: lerp(c1.g, c2.g, t), b: lerp(c1.b, c2.b, t) });
const C = (r, g, b) => ({ r, g, b });

export function sunDirection(t) {
  const a = (t % 1) * TAU - Math.PI / 2; // angle around east-up-west
  const x = Math.cos(a), y = Math.sin(a), z = 0.2; // small constant tilt
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
}

// Four key palettes blended by phase.
const KEY = {
  dawn:  { top: C(0.55, 0.62, 0.80), bottom: C(0.98, 0.78, 0.55), fog: C(0.92, 0.80, 0.66) },
  noon:  { top: C(0.45, 0.68, 0.95), bottom: C(0.95, 0.86, 0.66), fog: C(0.86, 0.82, 0.70) },
  dusk:  { top: C(0.62, 0.40, 0.55), bottom: C(0.98, 0.62, 0.34), fog: C(0.85, 0.55, 0.40) },
  night: { top: C(0.05, 0.07, 0.16), bottom: C(0.12, 0.13, 0.26), fog: C(0.08, 0.10, 0.20) },
};

export function skyPalette(t) {
  const x = ((t % 1) + 1) % 1;
  let a, b, f;
  if (x < 0.25) { a = KEY.dawn; b = KEY.noon; f = x / 0.25; }
  else if (x < 0.5) { a = KEY.noon; b = KEY.dusk; f = (x - 0.25) / 0.25; }
  else if (x < 0.75) { a = KEY.dusk; b = KEY.night; f = (x - 0.5) / 0.25; }
  else { a = KEY.night; b = KEY.dawn; f = (x - 0.75) / 0.25; }
  return { top: mix(a.top, b.top, f), bottom: mix(a.bottom, b.bottom, f), fog: mix(a.fog, b.fog, f) };
}

export function isNight(t) { const d = sunDirection(t); return d.y < 0; }
export function timeLabel(t) {
  const x = ((t % 1) + 1) % 1;
  if (x < 0.15 || x >= 0.9) return "여명";
  if (x < 0.4) return "낮";
  if (x < 0.6) return "노을";
  return "밤";
}
```

- [ ] **Step 4: Run, verify pass.** Run: `npx vitest run __tests__/unit/desert-game/dayNight.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add public/desert-game/src/logic/dayNight.js __tests__/unit/desert-game/dayNight.test.ts
git commit -m "feat(desert-game): day/night sun direction and sky palette (TDD)"
```

### Task 7: `discovery.js` — landmark & collectible proximity logic

**Files:**
- Create: `public/desert-game/src/logic/discovery.js`
- Test: `__tests__/unit/desert-game/discovery.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from "vitest";
// @ts-expect-error - vanilla JS module
import { nearestUndiscovered, withinRadius } from "@/public/desert-game/src/logic/discovery.js";

const lm = (x: number, z: number, discovered = false) => ({ x, z, discovered });

describe("discovery", () => {
  it("returns the nearest UNdiscovered item with distance", () => {
    const items = [lm(0, 0, true), lm(10, 0), lm(3, 4)];
    const r = nearestUndiscovered({ x: 0, z: 0 }, items);
    expect(r.index).toBe(2);
    expect(r.distance).toBeCloseTo(5, 5);
  });
  it("returns null when all discovered", () => {
    expect(nearestUndiscovered({ x: 0, z: 0 }, [lm(1, 1, true)])).toBeNull();
  });
  it("withinRadius lists indices inside the radius and not yet flagged", () => {
    const items = [lm(0, 0), lm(100, 0), lm(2, 0, true)];
    expect(withinRadius({ x: 0, z: 0 }, items, 5)).toEqual([0]);
  });
  it("withinRadius is exclusive of already-flagged items", () => {
    const items = [lm(1, 0, true)];
    expect(withinRadius({ x: 0, z: 0 }, items, 5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify fail.** Run: `npx vitest run __tests__/unit/desert-game/discovery.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `discovery.js`.**

```js
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export function nearestUndiscovered(pos, items) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < items.length; i++) {
    if (items[i].discovered) continue;
    const d = dist2(pos, items[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best === null ? null : { index: best, distance: Math.sqrt(bestD) };
}

// Indices of items within `radius` that are not yet discovered/collected.
export function withinRadius(pos, items, radius) {
  const r2 = radius * radius, out = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].discovered) continue;
    if (dist2(pos, items[i]) <= r2) out.push(i);
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass.** Run: `npx vitest run __tests__/unit/desert-game/discovery.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Run the full logic suite + lint/type-check.**

Run: `npm run test && npm run lint && npm run type-check`
Expected: all desert-game logic tests pass alongside existing suites; lint/type-check clean.

- [ ] **Step 6: Commit.**

```bash
git add public/desert-game/src/logic/discovery.js __tests__/unit/desert-game/discovery.test.ts
git commit -m "feat(desert-game): landmark/collectible proximity logic (TDD)"
```

### Task 8: `config.js` — tunable constants

**Files:**
- Create: `public/desert-game/src/logic/config.js`

- [ ] **Step 1: Write `config.js`.**

```js
export const CONFIG = {
  seed: 1337,
  map: { size: 1000, segments: 192 },
  landmarks: { count: 7, discoverRadius: 45 },
  collectibles: { count: 20, pickupRadius: 4 },
  dust: { maxParticles: 1500 },
  dayLengthSeconds: 240,
  palette: { sand: 0xe0935a, sandDark: 0xb5673a },
};
```

- [ ] **Step 2: Commit.**

```bash
git add public/desert-game/src/logic/config.js
git commit -m "feat(desert-game): tunable config constants"
```

---

## Phase 2 — World Rendering

> Rendering modules import `three` and are verified by **manual visual check** + the smoke e2e. Each task ends by running the game in `npm run dev` at `http://localhost:3000/desert-game/index.html`.

### Task 9: `Game.js` core — scene, renderer, camera, loop, resize

**Files:**
- Create: `public/desert-game/src/core/Game.js`
- Modify: `public/desert-game/src/main.js`

- [ ] **Step 1: Write `core/Game.js`.** Orchestrates everything; modules are attached in later tasks. Exposes `start()`, `update(dt)`, `dispose()`.

```js
import * as THREE from 'three';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 4000);
    this.camera.position.set(0, 12, 18);
    this.clock = new THREE.Clock();
    this.running = false;
    this.systems = []; // { update(dt, game) } objects added by later tasks

    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  add(system) { this.systems.push(system); if (system.object3d) this.scene.add(system.object3d); return system; }

  start() {
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      const dt = Math.min(0.05, this.clock.getDelta());
      for (const s of this.systems) s.update && s.update(dt, this);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
  dispose() { this.stop(); window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}
```

- [ ] **Step 2: Replace `main.js`** to build the Game (WebGL failure → fallback via try/catch) and start on button click. Later tasks insert system attachments inside the `if (game) { ... }` block, before the start handler.

```js
import { Game } from './core/Game.js';
import { CONFIG } from './logic/config.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');

let game = null;
try {
  game = new Game(canvas); // creating the WebGLRenderer throws if WebGL is unavailable
} catch (err) {
  console.error('[desert-game] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  // --- world / vehicle / camera / ui systems are attached here in later tasks ---

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hud.classList.remove('hidden');
    game.start();
  });
  console.log('[desert-game] ready');
}
```

(`CONFIG` is imported now because later tasks reference it in `main.js`; remove the import only if no task ends up using it.)

- [ ] **Step 3: Verify.** `npm run dev` → open the game → click "주행 시작". Expected: menu hides, HUD shows, empty scene renders (default black), console `[desert-game] ready`, no errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/core/Game.js public/desert-game/src/main.js
git commit -m "feat(desert-game): Game core loop, renderer, camera, resize"
```

### Task 10: `Terrain.js` + `Sky.js` — dunes, lighting, day/night

**Files:**
- Create: `public/desert-game/src/world/Terrain.js`
- Create: `public/desert-game/src/world/Sky.js`
- Modify: `public/desert-game/src/main.js` (attach terrain + sky)

- [ ] **Step 1: Write `world/Terrain.js`** — displaced flat-shaded plane; reuses `terrainHeight` so visuals and physics agree.

```js
import * as THREE from 'three';
import { terrainHeight } from '../logic/noise.js';
import { CONFIG } from '../logic/config.js';

export class Terrain {
  constructor() {
    const { size, segments } = CONFIG.map;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2); // XZ ground plane
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z, CONFIG.seed));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: CONFIG.palette.sand, flatShading: true, roughness: 1, metalness: 0 });
    this.object3d = new THREE.Mesh(geo, mat);
    this.object3d.receiveShadow = true;
    this.material = mat;
    this.half = size / 2;
  }
  getHeightAt(x, z) { return terrainHeight(x, z, CONFIG.seed); }
  // soft boundary: clamp a position back inside the map
  clamp(p) {
    const m = this.half - 20;
    p.x = Math.max(-m, Math.min(m, p.x));
    p.z = Math.max(-m, Math.min(m, p.z));
  }
  update() {}
}
```

- [ ] **Step 2: Write `world/Sky.js`** — sun light + sky/fog color + stars; advances time, drives day/night via `dayNight.js`.

```js
import * as THREE from 'three';
import { sunDirection, skyPalette, isNight } from '../logic/dayNight.js';
import { CONFIG } from '../logic/config.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.t = 0.18; // start in golden morning
    scene.fog = new THREE.Fog(0xd9a86a, 250, 900);
    this.bg = new THREE.Color();
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.far = 1500;
    scene.add(this.sun, this.sun.target);
    this.ambient = new THREE.HemisphereLight(0xffe6c0, 0x4a3520, 0.6);
    scene.add(this.ambient);
    // stars (shown at night via opacity)
    const sg = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 600; i++) pts.push((Math.random()-0.5)*3000, Math.random()*800+200, (Math.random()-0.5)*3000);
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0 }));
    scene.add(this.stars);
  }
  update(dt) {
    this.t = (this.t + dt / CONFIG.dayLengthSeconds) % 1;
    const d = sunDirection(this.t);
    this.sun.position.set(d.x * 400, d.y * 400, d.z * 400);
    this.sun.intensity = Math.max(0.05, d.y) * 2.4;
    const p = skyPalette(this.t);
    this.bg.setRGB(p.top.r, p.top.g, p.top.b);
    this.scene.background = this.bg;
    this.scene.fog.color.setRGB(p.fog.r, p.fog.g, p.fog.b);
    this.stars.material.opacity = isNight(this.t) ? 0.9 : 0;
  }
}
```

- [ ] **Step 3: Attach in `main.js`.** After creating `game`, before `start()` wiring:

```js
import { Terrain } from './world/Terrain.js';
import { Sky } from './world/Sky.js';
// ...
const terrain = game.add(new Terrain());
const sky = new Sky(game.scene);
game.systems.push(sky);
game.terrain = terrain;
```

- [ ] **Step 4: Verify.** Run the game. Expected: golden dune field with flat-shaded facets, colored sky + fog, soft shadows; sky slowly shifts over ~minutes (speed up by temporarily setting `CONFIG.dayLengthSeconds = 20` to confirm, then revert). No console errors.

- [ ] **Step 5: Commit.**

```bash
git add public/desert-game/src/world/Terrain.js public/desert-game/src/world/Sky.js public/desert-game/src/main.js
git commit -m "feat(desert-game): low-poly dune terrain + day/night sky"
```

---

## Phase 3 — Vehicle, Input, Camera (drivable)

### Task 11: `Input.js` — keyboard → InputState

**Files:**
- Create: `public/desert-game/src/core/Input.js`

- [ ] **Step 1: Write `core/Input.js`.** Produces a reusable `InputState` (the multiplayer seam — the same shape can be fed from the network later).

```js
export class Input {
  constructor() {
    this.state = { throttle: 0, steer: 0, handbrake: false, cameraToggle: false, reset: false, pause: false };
    this.keys = new Set();
    this._down = (e) => { this.keys.add(e.code); if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); };
    this._up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    this._prevC = false;
  }
  sample() {
    const k = this.keys, has = (c) => k.has(c);
    const s = this.state;
    s.throttle = (has('ArrowUp') || has('KeyW') ? 1 : 0) - (has('ArrowDown') || has('KeyS') ? 1 : 0);
    s.steer = (has('ArrowRight') || has('KeyD') ? 1 : 0) - (has('ArrowLeft') || has('KeyA') ? 1 : 0);
    s.handbrake = has('Space');
    const c = has('KeyC');
    s.cameraToggle = c && !this._prevC; this._prevC = c;
    s.reset = has('KeyR');
    return s;
  }
  dispose() { window.removeEventListener('keydown', this._down); window.removeEventListener('keyup', this._up); }
}
```

- [ ] **Step 2: Commit.**

```bash
git add public/desert-game/src/core/Input.js
git commit -m "feat(desert-game): keyboard input → reusable InputState"
```

### Task 12: `Car.js` — low-poly car mesh driven by carPhysics

**Files:**
- Create: `public/desert-game/src/vehicle/Car.js`
- Modify: `public/desert-game/src/main.js`

- [ ] **Step 1: Write `vehicle/Car.js`.** Builds a boxy low-poly car + 4 wheels; each frame steps `carPhysics` against the terrain and applies the transform (with slope tilt, wheel spin, body roll on drift).

```js
import * as THREE from 'three';
import { createCarState, stepCar } from '../logic/carPhysics.js';

export class Car {
  constructor(terrain, input) {
    this.terrain = terrain;
    this.input = input;
    this.state = createCarState(0, 0);

    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff6b3d, flatShading: true, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4), bodyMat);
    body.position.y = 1; body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x33241a, flatShading: true }));
    cabin.position.set(0, 1.7, -0.2); cabin.castShadow = true;
    g.add(body, cabin);

    this.wheels = [];
    const wMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true });
    const wGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10); wGeo.rotateZ(Math.PI / 2);
    for (const [dx, dz] of [[-1.1,1.3],[1.1,1.3],[-1.1,-1.3],[1.1,-1.3]]) {
      const w = new THREE.Mesh(wGeo, wMat); w.position.set(dx, 0.6, dz); w.castShadow = true;
      g.add(w); this.wheels.push(w);
    }
    // headlights (lit at night by Sky via emissive toggle if desired)
    this.object3d = g;
    this.group = g;
  }

  resetTo(x = 0, z = 0) { this.state = createCarState(x, z); }

  update(dt) {
    const inp = this.input.sample();
    if (inp.reset) this.resetTo(this.state.x, this.state.z);
    this.state = stepCar(this.state, inp, dt, (x, z) => this.terrain.getHeightAt(x, z));
    this.terrain.clamp(this.state); // soft boundary

    const s = this.state;
    this.group.position.set(s.x, s.y, s.z);
    this.group.rotation.y = -s.heading + Math.PI / 2;
    // slope tilt: sample neighbors
    const hF = this.terrain.getHeightAt(s.x + Math.cos(s.heading), s.z + Math.sin(s.heading));
    const hB = this.terrain.getHeightAt(s.x - Math.cos(s.heading), s.z - Math.sin(s.heading));
    this.group.rotation.x = Math.atan2(hB - hF, 2) * (s.airborne ? 0.2 : 1);
    // drift body roll
    const drift = s.heading - s.velHeading;
    this.group.rotation.z = THREE.MathUtils.clamp(-drift * 0.4, -0.3, 0.3);
    // wheel spin
    const spin = s.speed * dt * 1.6;
    for (const w of this.wheels) w.rotation.x += spin;
  }
}
```

- [ ] **Step 2: Attach in `main.js`.**

```js
import { Input } from './core/Input.js';
import { Car } from './vehicle/Car.js';
// ...
const input = new Input();
const car = game.add(new Car(terrain, input));
game.car = car;
```

- [ ] **Step 3: Verify.** Drive with WASD/arrows. Expected: car accelerates, steers, climbs dunes, tilts to slope; Space drifts (body rolls); R resets. Camera is still fixed (next task). No errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/vehicle/Car.js public/desert-game/src/main.js
git commit -m "feat(desert-game): drivable low-poly car via carPhysics"
```

### Task 13: `ChaseCamera.js` — 3rd-person follow + aerial toggle

**Files:**
- Create: `public/desert-game/src/camera/ChaseCamera.js`
- Modify: `public/desert-game/src/main.js`

- [ ] **Step 1: Write `camera/ChaseCamera.js`.**

```js
import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera, car, input) {
    this.camera = camera; this.car = car; this.input = input;
    this.mode = 'chase';
    this._tmp = new THREE.Vector3();
  }
  update(dt) {
    if (this.input.state.cameraToggle) this.mode = this.mode === 'chase' ? 'aerial' : 'chase';
    const s = this.car.state;
    const speedT = Math.min(1, Math.abs(s.speed) / 40);
    let offX, offY, offZ, look = 2;
    if (this.mode === 'chase') {
      const back = 11 + speedT * 4;
      offX = -Math.cos(s.heading) * back; offZ = -Math.sin(s.heading) * back; offY = 5.5;
      this.camera.fov = 62 + speedT * 8;
    } else { offX = 0; offY = 70; offZ = 0.01; look = 0; this.camera.fov = 60; }
    this.camera.updateProjectionMatrix();
    const tx = s.x + offX, ty = s.y + offY, tz = s.z + offZ;
    const k = 1 - Math.pow(0.0015, dt); // frame-rate-independent smoothing
    this.camera.position.lerp(this._tmp.set(tx, ty, tz), k);
    this.camera.lookAt(s.x, s.y + look, s.z);
  }
}
```

- [ ] **Step 2: Attach in `main.js`** (push as a system so it updates after the car):

```js
import { ChaseCamera } from './camera/ChaseCamera.js';
// ...
const chase = new ChaseCamera(game.camera, car, input);
game.systems.push(chase);
```

- [ ] **Step 3: Verify.** Camera follows behind the car, eases on turns, FOV widens with speed; `C` toggles to top-down aerial and back. No errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/camera/ChaseCamera.js public/desert-game/src/main.js
git commit -m "feat(desert-game): chase camera with aerial toggle"
```

---

## Phase 4 — Dust & Juice

### Task 14: `DustEmitter.js` — GPU particle dust

**Files:**
- Create: `public/desert-game/src/vehicle/DustEmitter.js`
- Modify: `public/desert-game/src/main.js`

- [ ] **Step 1: Write `vehicle/DustEmitter.js`.** A fixed `THREE.Points` pool; spawn rate scales with speed and drift; particles expand, rise, and fade; color tinted toward the current fog color.

```js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class DustEmitter {
  constructor(car, sky) {
    this.car = car; this.sky = sky;
    const max = CONFIG.dust.maxParticles;
    this.max = max; this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.life = new Float32Array(max);   // remaining seconds
    this.size = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const mat = new THREE.PointsMaterial({ color: 0xe8c89a, size: 3, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
    this.object3d = new THREE.Points(geo, mat);
    this.object3d.frustumCulled = false;
    this.geo = geo; this.mat = mat;
    this._acc = 0;
  }
  spawn(x, y, z) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i*3] = x + (Math.random()-0.5)*1.2;
    this.pos[i*3+1] = y + 0.3;
    this.pos[i*3+2] = z + (Math.random()-0.5)*1.2;
    this.life[i] = 1.1; this.size[i] = 2 + Math.random()*3;
  }
  update(dt) {
    const s = this.car.state;
    const drift = Math.abs(s.heading - s.velHeading);
    const intensity = (Math.abs(s.speed) / 12) + drift * 3 + (s.airborne ? 0 : 0);
    if (!s.airborne && intensity > 0.2) {
      this._acc += intensity * dt * 60;
      // rear wheel approx position
      const rx = s.x - Math.cos(s.heading) * 1.6, rz = s.z - Math.sin(s.heading) * 1.6;
      while (this._acc >= 1) { this.spawn(rx, s.y, rz); this._acc -= 1; }
    }
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      this.pos[i*3+1] += dt * 1.5;        // rise
      this.size[i] += dt * 4;             // expand
    }
    if (this.sky && this.sky.scene.fog) this.mat.color.copy(this.sky.scene.fog.color).lerp(new THREE.Color(0xffffff), 0.3);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}
```

- [ ] **Step 2: Attach in `main.js`** (after the car so positions are current):

```js
import { DustEmitter } from './vehicle/DustEmitter.js';
// ...
const dust = game.add(new DustEmitter(car, sky));
```

- [ ] **Step 3: Verify.** Driving kicks up a dust trail from the rear; drifting (Space + turn) produces a thick plume; dust tints with the sky. Frame rate stays smooth. No errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/vehicle/DustEmitter.js public/desert-game/src/main.js
git commit -m "feat(desert-game): GPU particle dust trail and drift plumes"
```

---

## Phase 5 — Content & HUD

### Task 15: `Landmarks.js` — discovery targets + beams + reveal

**Files:**
- Create: `public/desert-game/src/world/Landmarks.js`
- Modify: `public/desert-game/src/main.js`

- [ ] **Step 1: Write `world/Landmarks.js`.** Seeded placement; undiscovered ones emit a vertical beam; `update` uses `discovery.withinRadius` to detect arrival and reveals (beam off, emissive on, toast + callback).

```js
import * as THREE from 'three';
import { makeValueNoise } from '../logic/noise.js';
import { withinRadius, nearestUndiscovered } from '../logic/discovery.js';
import { CONFIG } from '../logic/config.js';

export class Landmarks {
  constructor(terrain, onDiscover) {
    this.terrain = terrain; this.onDiscover = onDiscover;
    this.object3d = new THREE.Group();
    this.items = [];
    const rng = makeValueNoise(CONFIG.seed + 5);
    const n = CONFIG.landmarks.count, R = terrain.half - 80;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng(i, 0);
      const r = 150 + Math.abs(rng(i, 7)) * R;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = terrain.getHeightAt(x, z);
      const mesh = this._makeMonument(i);
      mesh.position.set(x, y, z);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 120, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffe28c, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.set(x, y + 60, z);
      this.object3d.add(mesh, beam);
      this.items.push({ x, z, discovered: false, mesh, beam });
    }
  }
  _makeMonument(i) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xcaa15a, flatShading: true, roughness: 0.9, emissive: 0x000000 });
    const shapes = [
      () => new THREE.ConeGeometry(8, 34, 4),
      () => new THREE.TorusGeometry(10, 2.4, 6, 12),
      () => new THREE.BoxGeometry(6, 30, 6),
      () => new THREE.DodecahedronGeometry(9),
    ];
    const m = new THREE.Mesh(shapes[i % shapes.length](), mat);
    m.position.y = 14; m.castShadow = true;
    const grp = new THREE.Group(); grp.add(m); grp.userData.mat = mat; return grp;
  }
  get discoveredCount() { return this.items.filter((i) => i.discovered).length; }
  nearestPointer(pos) { return nearestUndiscovered(pos, this.items); }
  update(_dt, game) {
    const pos = game.car.state;
    for (const idx of withinRadius(pos, this.items, CONFIG.landmarks.discoverRadius)) {
      const it = this.items[idx];
      it.discovered = true;
      it.beam.visible = false;
      it.mesh.userData.mat.emissive.setHex(0x5a3a10);
      this.onDiscover && this.onDiscover(it, this.discoveredCount);
    }
  }
}
```

- [ ] **Step 2: Attach in `main.js`** with a toast on discovery:

```js
import { Landmarks } from './world/Landmarks.js';
const toast = document.getElementById('toast');
const showToast = (msg) => { toast.textContent = msg; toast.classList.remove('hidden'); clearTimeout(showToast._t); showToast._t = setTimeout(()=>toast.classList.add('hidden'), 2200); };
const landmarks = game.add(new Landmarks(terrain, (_it, count) => showToast(`✨ 신기루 발견! ${count} / ${CONFIG.landmarks.count}`)));
game.landmarks = landmarks;
```

(Add `import { CONFIG } from './logic/config.js';` at the top of `main.js` if not present.)

- [ ] **Step 3: Verify.** Light beams stand on the horizon; driving into one hides its beam, lights the monument, and shows a toast. No errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/world/Landmarks.js public/desert-game/src/main.js
git commit -m "feat(desert-game): discovery landmarks with beams and reveal"
```

### Task 16: `Collectibles.js` — glowing crystals

**Files:**
- Create: `public/desert-game/src/world/Collectibles.js`
- Modify: `public/desert-game/src/main.js`

- [ ] **Step 1: Write `world/Collectibles.js`.** Octahedron crystals that bob/spin; `withinRadius` collects them; calls back for sound + HUD.

```js
import * as THREE from 'three';
import { makeValueNoise } from '../logic/noise.js';
import { withinRadius } from '../logic/discovery.js';
import { CONFIG } from '../logic/config.js';

export class Collectibles {
  constructor(terrain, onCollect) {
    this.terrain = terrain; this.onCollect = onCollect;
    this.object3d = new THREE.Group();
    this.items = [];
    const rng = makeValueNoise(CONFIG.seed + 11);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x1577aa, flatShading: true, roughness: 0.3 });
    const geo = new THREE.OctahedronGeometry(1.4);
    for (let i = 0; i < CONFIG.collectibles.count; i++) {
      const x = (rng(i, 1) ) * (terrain.half - 60);
      const z = (rng(i, 2) ) * (terrain.half - 60);
      const baseY = terrain.getHeightAt(x, z) + 2.2;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, baseY, z);
      this.object3d.add(m);
      this.items.push({ x, z, discovered: false, mesh: m, baseY, phase: rng(i, 3) * 6 });
    }
    this.t = 0;
  }
  get count() { return this.items.filter((i) => i.discovered).length; }
  update(dt, game) {
    this.t += dt;
    for (const it of this.items) {
      if (it.discovered) continue;
      it.mesh.rotation.y += dt * 1.5;
      it.mesh.position.y = it.baseY + Math.sin(this.t + it.phase) * 0.4;
    }
    for (const idx of withinRadius(game.car.state, this.items, CONFIG.collectibles.pickupRadius)) {
      const it = this.items[idx];
      it.discovered = true; it.mesh.visible = false;
      this.onCollect && this.onCollect(this.count);
    }
  }
}
```

- [ ] **Step 2: Attach in `main.js`.**

```js
import { Collectibles } from './world/Collectibles.js';
const collectibles = game.add(new Collectibles(terrain, () => {/* HUD + sound wired in later tasks */}));
game.collectibles = collectibles;
```

- [ ] **Step 3: Verify.** ~20 glowing crystals bob across the dunes; driving through one makes it vanish. No errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/world/Collectibles.js public/desert-game/src/main.js
git commit -m "feat(desert-game): glowing collectible crystals"
```

### Task 17: `HUD.js` — live readouts

**Files:**
- Create: `public/desert-game/src/ui/HUD.js`
- Modify: `public/desert-game/src/main.js`

- [ ] **Step 1: Write `ui/HUD.js`.** Reads game state each frame and writes DOM (speed in km/h, discovery/collectible counts, time label, nearest-landmark distance).

```js
import { timeLabel } from '../logic/dayNight.js';
import { CONFIG } from '../logic/config.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.speed = document.getElementById('speed-val');
    this.disc = document.getElementById('disc-val');
    this.discTotal = document.getElementById('disc-total');
    this.collect = document.getElementById('collect-val');
    this.collectTotal = document.getElementById('collect-total');
    this.timeLabel = document.getElementById('time-label');
    this.pointer = document.getElementById('pointer-dist');
    this.discTotal.textContent = CONFIG.landmarks.count;
    this.collectTotal.textContent = CONFIG.collectibles.count;
    this._acc = 0;
  }
  update(dt) {
    this._acc += dt; if (this._acc < 0.1) return; this._acc = 0; // 10 Hz
    const g = this.game;
    this.speed.textContent = Math.round(Math.abs(g.car.state.speed) * 3.6);
    this.disc.textContent = g.landmarks.discoveredCount;
    this.collect.textContent = g.collectibles.count;
    this.timeLabel.textContent = timeLabel(g.sky.t);
    const near = g.landmarks.nearestPointer(g.car.state);
    this.pointer.textContent = near ? `${(near.distance / 100).toFixed(1)}km` : "전부 발견!";
  }
}
```

- [ ] **Step 2: Attach in `main.js`** (push last so it reads post-update state). Also expose `sky` on `game` (`game.sky = sky;`).

```js
import { HUD } from './ui/HUD.js';
game.systems.push(new HUD(game));
```

- [ ] **Step 3: Verify.** HUD shows live speed, 🗺️ count rising on discovery, 💎 count rising on pickup, time label changing, and nearest-landmark distance shrinking as you approach. No errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/ui/HUD.js public/desert-game/src/main.js
git commit -m "feat(desert-game): live HUD readouts"
```

---

## Phase 6 — Menu polish & Audio

### Task 18: `AudioManager.js` — engine, wind, chime, fanfare

**Files:**
- Create: `public/desert-game/src/audio/AudioManager.js`
- Modify: `public/desert-game/src/main.js` (resume context on start; wire pickup/discovery sounds)

- [ ] **Step 1: Write `audio/AudioManager.js`.** Pure Web Audio synthesis (no asset files): engine = sawtooth whose frequency tracks speed; wind = filtered noise; chime/fanfare = short oscillator envelopes.

```js
export class AudioManager {
  constructor() {
    this.ctx = null; this.master = null; this.engine = null; this.enabled = false;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    // engine
    this.engine = this.ctx.createOscillator(); this.engine.type = 'sawtooth';
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    this.engine.connect(lp).connect(this.engineGain).connect(this.master);
    this.engine.frequency.value = 60; this.engine.start();
    this.enabled = true;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setSpeed(speed) {
    if (!this.enabled) return;
    const s = Math.min(1, Math.abs(speed) / 40);
    this.engine.frequency.setTargetAtTime(60 + s * 180, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(0.04 + s * 0.10, this.ctx.currentTime, 0.1);
  }
  blip(freq, dur = 0.12, type = 'triangle', gain = 0.25) {
    if (!this.enabled) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  collect() { this.blip(1320, 0.12, 'triangle'); }
  discover() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'sine', 0.3), i * 90)); }
  update(dt, game) { this.setSpeed(game.car.state.speed); }
}
```

- [ ] **Step 2: Wire in `main.js`.** Create the manager, init+resume on the start button (user gesture), pass `collect`/`discover` callbacks into Collectibles/Landmarks, and push as a system.

```js
import { AudioManager } from './audio/AudioManager.js';
const audio = new AudioManager();
// in startBtn click handler, after start():
//   audio.init(); audio.resume();
// update the Landmarks/Collectibles callbacks:
//   new Landmarks(terrain, (_it, count) => { showToast(...); audio.discover(); })
//   new Collectibles(terrain, () => audio.collect())
game.systems.push(audio);
```

- [ ] **Step 3: Verify.** Engine pitch rises with speed; a chime plays on pickup; a 4-note fanfare on discovery. (Audio starts only after clicking "주행 시작".) No errors.

- [ ] **Step 4: Commit.**

```bash
git add public/desert-game/src/audio/AudioManager.js public/desert-game/src/main.js
git commit -m "feat(desert-game): Web Audio engine, chime, and discovery fanfare"
```

### Task 19: `Menu.js` — pause overlay + restart

**Files:**
- Create: `public/desert-game/src/ui/Menu.js`
- Modify: `public/desert-game/index.html` (add pause overlay), `public/desert-game/src/main.js`

- [ ] **Step 1: Add a pause overlay to `index.html`** (after `#hud`):

```html
<div id="pause" class="overlay hidden">
  <div class="panel">
    <h1 class="title" style="font-size:34px">일시정지</h1>
    <button id="resume-btn" class="btn-primary">계속하기</button>
    <button id="restart-btn" class="btn-primary" style="margin-top:12px;background:linear-gradient(135deg,#bbb,#888)">처음으로</button>
  </div>
</div>
```

- [ ] **Step 2: Write `ui/Menu.js`.** Handles `Esc` to toggle pause (stops/starts the loop) and restart (reset car + day time).

```js
export class Menu {
  constructor(game, car, sky) {
    this.game = game; this.car = car; this.sky = sky;
    this.pause = document.getElementById('pause');
    this.paused = false;
    document.getElementById('resume-btn').addEventListener('click', () => this.toggle(false));
    document.getElementById('restart-btn').addEventListener('click', () => { this.car.resetTo(0,0); this.sky.t = 0.18; this.toggle(false); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape') this.toggle(!this.paused); });
  }
  toggle(on) {
    this.paused = on;
    this.pause.classList.toggle('hidden', !on);
    if (on) this.game.stop(); else this.game.start();
  }
}
```

- [ ] **Step 3: Wire in `main.js`** (after start systems exist):

```js
import { Menu } from './ui/Menu.js';
new Menu(game, car, sky);
```

- [ ] **Step 4: Verify.** `Esc` pauses (loop halts, overlay shows); 계속하기 resumes; 처음으로 resets car to spawn and restarts the day. No errors.

- [ ] **Step 5: Commit.**

```bash
git add public/desert-game/index.html public/desert-game/src/ui/Menu.js public/desert-game/src/main.js
git commit -m "feat(desert-game): pause/restart menu"
```

---

## Phase 7 — Final Integration & Verification

### Task 20: README game-list entry + full CI green

**Files:**
- Modify: `README.md` (add Dust Drifter to the game list)

- [ ] **Step 1: Add a game entry to `README.md`.** Under the "🕹️ 게임 목록" / "🕹️ Games" section, after Sky Explorer, add:

```markdown
### 🏜️ Dust Drifter (사막 자유 주행)

- Three.js 기반 3D 로우폴리 사막 오픈 월드 (싱글플레이어)
- 자유 주행 + 신기루 탐험(7) + 빛나는 수집물(20) + 낮↔밤 순환
- 먼지 파티클 드리프트 · 듄 빅에어 · 3인칭/하늘뷰 카메라
- 조작: `↑↓←→`/`WASD` 주행 · `Space` 드리프트 · `C` 카메라 · `R` 리셋
```

(If the README has a "Game Engines" / tech-stack table, add `Three.js` there too.)

- [ ] **Step 2: Run the full CI suite locally.**

Run: `npm run lint && npm run type-check && npm run test`
Expected: lint 0 errors; type-check clean; all unit tests pass (existing + 4 new desert-game logic suites).

- [ ] **Step 3: Run e2e.**

Run: `npx playwright test e2e/desert-game.spec.ts e2e/hub.spec.ts`
Expected: all pass (hub still navigates to all 4 games; desert canvas boots clean).

- [ ] **Step 4: Commit.**

```bash
git add README.md
git commit -m "docs(desert-game): add Dust Drifter to README game list"
```

### Task 21: Manual playtest checklist + final polish pass

**Files:** (tweak only as needed) `public/desert-game/src/logic/config.js`, modules touched during tuning.

- [ ] **Step 1: Manual playtest** at `http://localhost:3000/desert-game/index.html`. Verify each:
  - [ ] Menu → 주행 시작 starts the game; HUD visible.
  - [ ] Car drives, steers, climbs/descends dunes, drifts on Space, big-air off steep crests, R resets.
  - [ ] Dust trail appears behind the car and thickens on drift; tints with sky.
  - [ ] 7 landmark beams visible; arriving reveals (beam off, monument lights, fanfare, toast, count++).
  - [ ] 20 crystals bob/spin; driving through collects (chime, count++).
  - [ ] HUD speed/counts/time/pointer update correctly.
  - [ ] `C` toggles chase ↔ aerial; camera eases and FOV widens with speed.
  - [ ] Day→sunset→night→dawn cycle visibly changes sky/light/stars over a few minutes.
  - [ ] `Esc` pauses/resumes; restart works.
  - [ ] Holds ~60fps on a mid-range laptop; no console errors over a 2-minute session.

- [ ] **Step 2: Tune** any values that feel off (in `config.js` / `CAR` / camera offsets / dust intensity). Keep the calm free-roam feel — conservative camera shake, generous discovery radius.

- [ ] **Step 3: Final commit (if tuning changed anything).**

```bash
git add -A public/desert-game
git commit -m "polish(desert-game): playtest tuning pass"
```

- [ ] **Step 4: Finish the branch.** Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR. The branch `feat/desert-driving-game` builds on `main` (which already has the README/cleanup work).

---

## Notes for the implementer

- **Module update order matters.** Systems run in `game.systems` order: Sky → Terrain → Car → ChaseCamera → Dust → Landmarks → Collectibles → HUD → Audio → (Menu is event-driven). `game.add()` pushes in call order; ensure `main.js` attaches them in that sequence so the camera/HUD read fresh car state.
- **THREE-free logic.** Never `import 'three'` inside `src/logic/**` — it must stay unit-testable in jsdom.
- **No build step.** Everything under `public/desert-game/` runs as-is in the browser via the importmap. Do not add bundler config.
- **Coordinate with the user's working tree.** `app/page.tsx`, `README.md`, and `eslint.config.mjs` were recently edited by the user; pull latest before modifying and keep changes additive.
