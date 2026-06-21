# 가락국수 Plan 1: 코어 루프 골격 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WASD로 주방을 누비며 조리대에서 국수 한 그릇을 집어 손님에게 배식하면 점수가 오르는 — 플레이 가능한 최소 수직 슬라이스를 만든다.

**Architecture:** 순수 시뮬레이션(`logic.js`, Vitest)을 렌더(`scene.js`/`models.js`)·입력(`input.js`)과 어댑터로 분리한다(추후 co-op 확장의 이음매). `main.js`가 셋을 배선하고 `requestAnimationFrame` 루프를 돈다. 게임은 `public/garak-guksu/`의 자체완결 정적 ESM이고 Next 라우트는 iframe 래퍼다.

**Tech Stack:** Three.js 0.184.0 (importmap CDN, no cannon-es) · 순수 ESM `.js` · Vitest(jsdom, `__tests__/unit/garak-guksu/*.test.ts`) · Playwright(`e2e/garak-guksu.spec.ts`, baseURL :3099) · Next 16 / React 19 iframe 래퍼.

**작업 트리:** 이 플랜은 worktree `Mini-Games-garak`(브랜치 `feat/garak-guksu`)에서 실행한다. 모든 경로는 그 트리 기준 상대경로.

---

### Task 1: 스캐폴딩 — 라우트가 뜨는 빈 게임

게임이 `/garak-guksu`에 마운트되고 캔버스가 존재하는 것부터 확인한다(걷는 골격).

**Files:**
- Create: `public/garak-guksu/index.html`
- Create: `public/garak-guksu/src/main.js`
- Create: `app/garak-guksu/page.tsx`
- Modify: `app/page.tsx` (허브 카드 1개 추가)
- Test: `e2e/garak-guksu.spec.ts`

- [ ] **Step 1: E2E 실패 테스트 작성**

`e2e/garak-guksu.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('garak-guksu route mounts with a canvas', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await expect(frame.locator('canvas#game')).toBeVisible();
});

test('hub links to garak-guksu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/garak-guksu"]')).toBeVisible();
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium`
Expected: FAIL (route 404 / iframe 없음).

- [ ] **Step 3: index.html 작성 (importmap + canvas + 빈 오버레이)**

`public/garak-guksu/index.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>역전국수</title>
  <style>
    :root { --bg:#0c0f1a; --amber:#ffcf6a; }
    html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);color:#fff;
      font-family:system-ui,sans-serif;-webkit-user-select:none;user-select:none;}
    #game{display:block;width:100vw;height:100vh;touch-action:none;}
    #home{position:fixed;top:10px;left:12px;z-index:6;background:rgba(0,0,0,.5);color:#fff;
      text-decoration:none;font-size:13px;font-weight:700;padding:10px 12px;border-radius:12px;}
    #hud{position:fixed;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:14px;
      background:rgba(0,0,0,.5);padding:8px 16px;border-radius:14px;font-weight:800;font-size:15px;z-index:5;}
    .overlay{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:18px;background:rgba(8,10,20,.92);z-index:10;text-align:center;padding:24px;}
    .overlay.off{display:none;}
    .overlay h1{font-size:40px;margin:0;}
    .overlay button{font-size:20px;font-weight:900;padding:14px 32px;border:0;border-radius:16px;cursor:pointer;
      background:linear-gradient(135deg,var(--amber),#ff8a5c);color:#1a0f10;}
  </style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <canvas id="game"></canvas>
  <a id="home" href="/">← 홈</a>
  <div id="hud" role="status" aria-live="off">
    <span>점수 <span id="score">0</span></span>
  </div>
  <div class="overlay" id="start">
    <h1>🏮 역전국수</h1>
    <p>WASD로 주방을 움직이고 <b>E</b>로 조리대·손님과 상호작용.<br>국수를 집어 손님에게 가져다주세요.</p>
    <button id="startbtn">▶ 영업 시작</button>
  </div>
  <div class="overlay off" id="result">
    <h1>오늘의 장사 마감</h1>
    <p id="result-sub"></p>
    <button id="replaybtn">▶ 다시 한 그릇</button>
  </div>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: main.js 최소 부트 (씬 없이도 캔버스 존재 보장)**

`public/garak-guksu/src/main.js` (Task 9에서 확장; 지금은 오버레이 배선만):
```js
const $ = (id) => document.getElementById(id);

function start() {
  $('start').classList.add('off');
  $('result').classList.add('off');
}
$('startbtn').addEventListener('click', start);
$('replaybtn').addEventListener('click', start);
```

- [ ] **Step 5: page.tsx 래퍼 작성**

`app/garak-guksu/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export default function GarakGuksuGame() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {loading && <LoadingOverlay />}
      <iframe
        src="/garak-guksu/index.html"
        className="h-full w-full border-0"
        title="역전국수"
        allow="autoplay; fullscreen"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
```

- [ ] **Step 6: 허브 카드 추가**

`app/page.tsx` — 마키마 says 카드(`</Link>` 닫힘, 약 163번째 줄) 바로 뒤, `</div>`(카드 그리드 닫힘) 앞에 삽입:
```tsx
          {/* 역전국수 카드 */}
          <Link href="/garak-guksu" aria-label="역전국수 가락국수 서빙 게임 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-yellow-700 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-amber-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                🍜
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">역전국수</h2>
                <p className="mb-4 text-white/90">
                  대전역 심야 플랫폼, 기차 놓칠라 후루룩! 가락국수를 말아내세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ WASD 주방 서빙</li>
                  <li>✓ 데치기 타이밍 · 손님 5인</li>
                  <li>✓ 증기→디젤→막차 러시</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>
```

- [ ] **Step 7: E2E 통과 확인**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium`
Expected: PASS (2 tests).

- [ ] **Step 8: 커밋**

```bash
git add public/garak-guksu/index.html public/garak-guksu/src/main.js app/garak-guksu/page.tsx app/page.tsx e2e/garak-guksu.spec.ts
git commit -m "feat(garak-guksu): scaffold route, hub card, empty canvas"
```

---

### Task 2: logic.js — 게임 초기 상태

순수 시뮬레이션의 토대. DOM/three 의존 없음.

**Files:**
- Create: `public/garak-guksu/src/logic.js`
- Test: `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/unit/garak-guksu/logic.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createGame, KITCHEN } from '../../../public/garak-guksu/src/logic.js';

describe('createGame', () => {
  it('starts with an empty-handed chef at origin, a waiting customer, zero score', () => {
    const g = createGame();
    expect(g.player).toEqual({ x: 0, z: 0, holding: null });
    expect(g.customer).toEqual({ present: true, served: false });
    expect(g.score).toBe(0);
  });
  it('exposes kitchen bounds', () => {
    expect(KITCHEN.minX).toBeLessThan(KITCHEN.maxX);
    expect(KITCHEN.minZ).toBeLessThan(KITCHEN.maxZ);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: FAIL ("Failed to resolve import" / createGame not defined).

- [ ] **Step 3: logic.js 작성 (상태 + 상수)**

`public/garak-guksu/src/logic.js`:
```js
// Pure, dependency-free simulation for /garak-guksu (unit-testable; no DOM/three).
// Plan 1 = vertical slice: one cook station, one customer, single-step "make a bowl".

// The chef walks this floor plane (x = left/right, z = depth toward counter).
export const KITCHEN = { minX: -4, maxX: 4, minZ: -2.5, maxZ: 2.5 };

// Fixed Plan-1 positions.
export const COOK_STATION = { x: 2, z: -1.5 };       // back-right of the kitchen
export const CUSTOMER_SLOT = { x: 0, z: 3.2 };       // across the counter (beyond the kitchen)
export const REACH = 1.2;                            // how close counts as "at" a thing

export function createGame() {
  return {
    player: { x: 0, z: 0, holding: null }, // holding: null | 'bowl'
    customer: { present: true, served: false },
    score: 0,
  };
}
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): pure game state (createGame + kitchen bounds)"
```

---

### Task 3: 주인장 이동 (movePlayer, 경계 clamp)

**Files:**
- Modify: `public/garak-guksu/src/logic.js`
- Test: `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`__tests__/unit/garak-guksu/logic.test.ts`에 추가:
```ts
import { createGame, KITCHEN, movePlayer, clamp } from '../../../public/garak-guksu/src/logic.js';

describe('movePlayer', () => {
  it('moves the chef in the given direction scaled by dt', () => {
    const g = createGame();
    movePlayer(g, { x: 1, z: 0 }, 0.1); // 4.5 * 0.1 = 0.45
    expect(g.player.x).toBeCloseTo(0.45, 5);
    expect(g.player.z).toBe(0);
  });
  it('clamps to kitchen bounds', () => {
    const g = createGame();
    movePlayer(g, { x: 1, z: 0 }, 100); // way past maxX
    expect(g.player.x).toBe(KITCHEN.maxX);
  });
});

describe('clamp', () => {
  it('bounds a value', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: FAIL (movePlayer not defined).

- [ ] **Step 3: logic.js에 이동·헬퍼 추가**

`public/garak-guksu/src/logic.js` 끝에 추가:
```js
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
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: PASS (movePlayer + clamp tests green).

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): chef movement clamped to kitchen plane"
```

---

### Task 4: 조리대 상호작용 (interact → 그릇 집기)

**Files:**
- Modify: `public/garak-guksu/src/logic.js`
- Test: `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
import { COOK_STATION, interact } from '../../../public/garak-guksu/src/logic.js';

describe('interact (cook station)', () => {
  it('picks up a bowl when empty-handed AND at the station', () => {
    const g = createGame();
    g.player.x = COOK_STATION.x; g.player.z = COOK_STATION.z;
    expect(interact(g)).toBe(true);
    expect(g.player.holding).toBe('bowl');
  });
  it('does nothing when far from the station', () => {
    const g = createGame(); // chef at origin, station at (2,-1.5)
    expect(interact(g)).toBe(false);
    expect(g.player.holding).toBe(null);
  });
  it('does nothing when already holding', () => {
    const g = createGame();
    g.player.x = COOK_STATION.x; g.player.z = COOK_STATION.z;
    g.player.holding = 'bowl';
    expect(interact(g)).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: FAIL (interact not defined).

- [ ] **Step 3: interact 구현**

`public/garak-guksu/src/logic.js` 끝에 추가:
```js
// At the cook station with empty hands -> a finished bowl appears in hand.
// (Plan 2 replaces this single step with the 4-stage pipeline.)
export function interact(state) {
  const p = state.player;
  if (p.holding === null && near(p.x, p.z, COOK_STATION.x, COOK_STATION.z)) {
    p.holding = 'bowl';
    return true;
  }
  return false;
}
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): cook-station interact picks up a bowl"
```

---

### Task 5: 손님 배식 + 점수 (serve)

**Files:**
- Modify: `public/garak-guksu/src/logic.js`
- Test: `__tests__/unit/garak-guksu/logic.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
import { CUSTOMER_SLOT, serve, SERVE_POINTS } from '../../../public/garak-guksu/src/logic.js';

describe('serve (customer)', () => {
  function chefAtCustomerWithBowl() {
    const g = createGame();
    g.player.x = CUSTOMER_SLOT.x; g.player.z = CUSTOMER_SLOT.z;
    g.player.holding = 'bowl';
    return g;
  }
  it('serves: clears hands, scores, customer leaves satisfied', () => {
    const g = chefAtCustomerWithBowl();
    expect(serve(g)).toBe(true);
    expect(g.player.holding).toBe(null);
    expect(g.customer).toEqual({ present: false, served: true });
    expect(g.score).toBe(SERVE_POINTS);
  });
  it('does nothing without a bowl', () => {
    const g = chefAtCustomerWithBowl();
    g.player.holding = null;
    expect(serve(g)).toBe(false);
    expect(g.score).toBe(0);
  });
  it('does nothing when far from the customer', () => {
    const g = createGame();
    g.player.holding = 'bowl'; // at origin, customer at (0,3.2)
    expect(serve(g)).toBe(false);
  });
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: FAIL (serve not defined).

- [ ] **Step 3: serve 구현**

`public/garak-guksu/src/logic.js` 끝에 추가:
```js
export const SERVE_POINTS = 100;

// At the customer, holding a bowl -> serve: clear hands, score, customer leaves.
export function serve(state) {
  const p = state.player, c = state.customer;
  if (p.holding === 'bowl' && c.present && !c.served &&
      near(p.x, p.z, CUSTOMER_SLOT.x, CUSTOMER_SLOT.z)) {
    p.holding = null;
    c.served = true;
    c.present = false;
    state.score += SERVE_POINTS;
    return true;
  }
  return false;
}
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts`
Expected: PASS (전체 logic 스위트 green).

- [ ] **Step 5: 커밋**

```bash
git add public/garak-guksu/src/logic.js __tests__/unit/garak-guksu/logic.test.ts
git commit -m "feat(garak-guksu): serve customer scores and clears the order"
```

---

### Task 6: models.js — 절차적 메시 팩토리

교체 가능한 에셋 팩토리(추후 glTF로 스왑). Plan 1은 단순 박스/구.

**Files:**
- Create: `public/garak-guksu/src/models.js`

> 렌더 코드는 순수 함수가 아니므로 단위테스트 대신 Task 9의 E2E로 검증한다. 각 팩토리는 `THREE.Group`을 반환한다.

- [ ] **Step 1: models.js 작성**

`public/garak-guksu/src/models.js`:
```js
import * as THREE from 'three';

// All factories return a THREE.Group so the mesh can later be swapped for a glTF
// load without touching scene.js / logic.js.

export function createFloor() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.9 })
  );
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  g.add(floor);
  // counter strip along the customer side (z = +2.7)
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.0, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 })
  );
  counter.position.set(0, 0.5, 2.7);
  counter.castShadow = true; counter.receiveShadow = true;
  g.add(counter);
  return g;
}

export function createChef() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })
  );
  body.position.y = 0.5; body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.7 })
  );
  head.position.y = 1.2; head.castShadow = true;
  g.add(body, head);
  // a small bowl that toggles on while holding (Task 9 sets .visible)
  const bowl = createBowl();
  bowl.position.set(0, 1.0, 0.35);
  bowl.name = 'heldBowl';
  bowl.visible = false;
  g.add(bowl);
  return g;
}

export function createBowl() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.14, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0xeae0d0, roughness: 0.5 })
  );
  bowl.castShadow = true;
  g.add(bowl);
  return g;
}

export function createStation() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.7, 18),
    new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.6, roughness: 0.4 })
  );
  pot.position.y = 0.55; pot.castShadow = true; pot.receiveShadow = true;
  g.add(pot);
  return g;
}

export function createCustomer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.7, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.7 })
  );
  body.position.y = 0.75; body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd9b0, roughness: 0.7 })
  );
  head.position.y = 1.45;
  g.add(body, head);
  return g;
}
```

- [ ] **Step 2: 커밋** (E2E는 Task 9에서)

```bash
git add public/garak-guksu/src/models.js
git commit -m "feat(garak-guksu): procedural mesh factories (chef/station/customer/floor)"
```

---

### Task 7: scene.js — Three.js 씬 + 상태 동기화

**Files:**
- Create: `public/garak-guksu/src/scene.js`

> `createScene(canvas)` 는 `{ sync(state), render(), dispose() }` 를 반환한다. `sync`는 상태→메시 위치를 반영하고, `render`는 한 프레임 그린다.

- [ ] **Step 1: scene.js 작성**

`public/garak-guksu/src/scene.js`:
```js
import * as THREE from 'three';
import { createFloor, createChef, createStation, createCustomer } from './models.js';
import { COOK_STATION, CUSTOMER_SLOT } from './logic.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const LOW = typeof matchMedia === 'function' &&
    (matchMedia('(max-width: 560px)').matches || matchMedia('(pointer: coarse)').matches);
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0f1a);     // night platform
  scene.fog = new THREE.Fog(0x0c0f1a, 14, 30);

  // fixed ¾ back-counter view
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.5, 100);
  camera.position.set(0, 7.5, -7);
  camera.lookAt(0, 0.5, 1.5);

  scene.add(new THREE.HemisphereLight(0x404a6a, 0x101018, 0.5));
  const lamp = new THREE.PointLight(0xffcf6a, 1.4, 24, 1.5); // warm incandescent
  lamp.position.set(0, 6, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(LOW ? 512 : 1024, LOW ? 512 : 1024);
  scene.add(lamp);

  scene.add(createFloor());
  const station = createStation();
  station.position.set(COOK_STATION.x, 0, COOK_STATION.z);
  scene.add(station);
  const customer = createCustomer();
  customer.position.set(CUSTOMER_SLOT.x, 0, CUSTOMER_SLOT.z);
  scene.add(customer);
  const chef = createChef();
  scene.add(chef);
  const heldBowl = chef.getObjectByName('heldBowl');

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function sync(state) {
    chef.position.set(state.player.x, 0, state.player.z);
    heldBowl.visible = state.player.holding === 'bowl';
    customer.visible = state.customer.present;
  }
  function render() { renderer.render(scene, camera); }
  function dispose() { renderer.dispose(); }

  return { sync, render, dispose };
}
```

- [ ] **Step 2: 커밋**

```bash
git add public/garak-guksu/src/scene.js
git commit -m "feat(garak-guksu): three scene with ¾ camera + state sync"
```

---

### Task 8: input.js — 입력 어댑터

co-op 확장을 위해 입력을 격리. WASD → 이동 벡터, E/클릭 → 액션 콜백.

**Files:**
- Create: `public/garak-guksu/src/input.js`

- [ ] **Step 1: input.js 작성**

`public/garak-guksu/src/input.js`:
```js
// Input adapter: keeps WASD state, fires onAction for E/click.
// Isolated so a network input source can replace it for co-op later.
export function createInput(onAction) {
  const keys = new Set();
  const MOVE = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
                 ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); onAction(); return; }
    if (MOVE[e.code]) { e.preventDefault(); keys.add(e.code); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // dir, normalized so diagonal isn't faster.
  function getMoveDir() {
    let x = 0, z = 0;
    for (const k of keys) { const m = MOVE[k]; if (m) { x += m[0]; z += m[1]; } }
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }
  return { getMoveDir };
}
```

- [ ] **Step 2: 커밋**

```bash
git add public/garak-guksu/src/input.js
git commit -m "feat(garak-guksu): WASD input adapter (E/Space = action)"
```

---

### Task 9: main.js 배선 + 게임 루프 + E2E 플레이

logic·scene·input을 묶고 루프를 돈다. `window.__garak` 디버그 훅(기존 게임 패턴)으로 E2E가 상태를 검증한다.

**Files:**
- Modify: `public/garak-guksu/src/main.js`
- Modify: `e2e/garak-guksu.spec.ts`

- [ ] **Step 1: E2E 플레이 실패 테스트 추가**

`e2e/garak-guksu.spec.ts`에 추가:
```ts
test('serving a bowl scores via the core loop', async ({ page }) => {
  await page.goto('/garak-guksu');
  const frame = page.frameLocator('iframe[title="역전국수"]');
  await frame.locator('#startbtn').click();

  // drive the loop through the debug hook: teleport to station, interact, to customer, serve.
  const score = await frame.locator('canvas#game').evaluate(() => {
    const g = window.__garak;
    g.teleport(g.COOK_STATION.x, g.COOK_STATION.z); g.interact();
    g.teleport(g.CUSTOMER_SLOT.x, g.CUSTOMER_SLOT.z); g.serve();
    return g.score;
  });
  expect(score).toBe(100);
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium`
Expected: FAIL (`window.__garak` undefined).

- [ ] **Step 3: main.js 전면 작성 (배선 + 루프 + 훅)**

`public/garak-guksu/src/main.js` 전체 교체:
```js
import { createGame, movePlayer, interact, serve, near, COOK_STATION, CUSTOMER_SLOT } from './logic.js';
import { createScene } from './scene.js';
import { createInput } from './input.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const scene = createScene(canvas);

let state = createGame();
let running = false;
let last = 0;

// E/click: try the nearer action — interact at station, serve at customer.
function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, COOK_STATION.x, COOK_STATION.z)) interact(state);
  else if (near(p.x, p.z, CUSTOMER_SLOT.x, CUSTOMER_SLOT.z)) serve(state);
  renderHud();
}
const input = createInput(action);
canvas.addEventListener('pointerdown', action);

function renderHud() { $('score').textContent = state.score; }

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  movePlayer(state, input.getMoveDir(), dt);
  scene.sync(state);
  scene.render();
  requestAnimationFrame(loop);
}

function start() {
  state = createGame();
  running = true;
  $('start').classList.add('off');
  $('result').classList.add('off');
  renderHud();
  last = performance.now();
  requestAnimationFrame(loop);
}

$('startbtn').addEventListener('click', start);
$('replaybtn').addEventListener('click', start);

// Debug/test hook (mirrors __ppopgi/__makima pattern).
window.__garak = {
  COOK_STATION, CUSTOMER_SLOT,
  get score() { return state.score; },
  get holding() { return state.player.holding; },
  teleport(x, z) { state.player.x = x; state.player.z = z; },
  interact() { interact(state); renderHud(); },
  serve() { serve(state); renderHud(); },
};

// render one idle frame so the canvas isn't black behind the start overlay.
scene.sync(state);
scene.render();
```

- [ ] **Step 4: 실행해서 통과 확인**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium`
Expected: PASS (3 tests: mount, hub link, serve scores).

- [ ] **Step 5: 전체 게이트 확인**

Run: `npx vitest run __tests__/unit/garak-guksu/logic.test.ts && npx playwright test e2e/garak-guksu.spec.ts --project=chromium`
Expected: 모든 유닛 + E2E PASS.

- [ ] **Step 6: 커밋**

```bash
git add public/garak-guksu/src/main.js e2e/garak-guksu.spec.ts
git commit -m "feat(garak-guksu): wire core loop (move/interact/serve) + __garak hook"
```

---

## Plan 1 완료 기준

- `/garak-guksu` 라우트가 뜨고 허브에 카드가 있다.
- WASD로 주인장이 주방 평면을 움직인다(경계 clamp).
- 조리대에서 `E` → 그릇을 들고, 손님 앞에서 `E` → 배식·+100점.
- 유닛(`logic.test.ts`) + E2E(`garak-guksu.spec.ts`) 전부 green.

**다음:** Plan 2(조리 4단계: 사리→데치기 타이밍→육수→마감)에서 `interact`의 단일 스텝을 파이프라인으로 교체한다.
