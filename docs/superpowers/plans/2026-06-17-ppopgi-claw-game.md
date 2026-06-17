# 뽑기 (ppopgi) Claw Game — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the claw prototype into a standalone, self-contained, module-structured game at `/ppopgi` with a real prize chute/collection and a settable camera, fully tested, then remove Fryffel Tower and deploy.

**Architecture:** Build-free Three.js (importmap CDN) + cannon-es, same runtime as desert-game. The game lives in `public/ppopgi/` split into focused modules; a thin `app/ppopgi/page.tsx` embeds it via iframe (existing game pattern). Pure logic (scoring/grip/sampling/round) is cannon-free for vitest. The tuned grab-physics from the proto is ported verbatim, then verified after each step.

**Tech Stack:** Three.js r0.184, cannon-es 0.20, Next.js (page shell), vitest (unit), Playwright (e2e), Vercel (deploy).

**Source of truth to port from:** `public/fry-tower-game/proto/claw-proto.{html,js}` (current live proto). The proto's physics is tuned + headless-verified — port it intact, do not re-tune.

---

## Milestone M1 — Promote to `/ppopgi` (self-contained, clean modules)

Outcome: the proto runs identically at `/ppopgi`, split into modules, with zero fry-tower imports, a Next page, and a hub card. Proto at `/fry-tower-game/proto/` stays live (deleted in M4).

**File structure (`public/ppopgi/`):**
- `index.html` — importmap, canvas, DOM overlays (payment/HUD/joystick/camera-buttons/result) + CSS.
- `src/main.js` — bootstrap, game loop, wiring.
- `src/cabinet.js` — cabinet meshes + arcade dressing + chute/bin meshes; exports `{ scene addition, neonMats, joyStick, heroMarquee, applyTheme, BIN }`.
- `src/claw.js` — world, materials, claw rig, grip springs, prize pile; exports the physics API.
- `src/prizes.js` — self-contained fry mesh builder (port `fryMesh.js`) + values/mass/tint.
- `src/camera.js` — CameraRig (drag-orbit + presets) [filled in M2; M1 = port the fixed player-POV].
- `src/chute.js` — collection [filled in M2; M1 = the proto's deliver-removes behavior].
- `src/ui.js` — payment + joystick + drop + result + hud DOM wiring.
- `src/sfx.js` — procedural Web Audio (coin/card/start/grab/slip/get); self-contained.
- `src/logic/` — `scoring.js`, `grip.js`, `sampling.js`, `round.js` (pure; tests in M3).

- [ ] **Step 1:** Create `public/ppopgi/` and copy `proto/claw-proto.html` → `public/ppopgi/index.html`; copy `proto/claw-proto.js` → `public/ppopgi/src/main.js` (single file first; split in later steps). Fix the `<script src>` to `./src/main.js`.
- [ ] **Step 2:** Remove fry-tower deps in `main.js`: replace `import {makeFryMesh} from '../src/render/fryMesh.js'` etc. by inlining/porting `makeFryMesh` into `public/ppopgi/src/prizes.js` and the needed `CONFIG.fry` constants locally; drop `AudioManager` import in favor of `src/sfx.js`; drop `Fry` import (inline the 8-line class). The game must import ONLY from within `public/ppopgi/`.
- [ ] **Step 3:** Verify the moved game runs: dev server, load `/ppopgi/index.html`, headless verify (`_claw-verify.mjs` pointed at `/ppopgi/`) → grab/slip/deliver, 0 escapes, 0 errors. Screenshot.
- [ ] **Step 4:** Create `app/ppopgi/page.tsx` (copy the desert/flight page pattern: home button + iframe `src="/ppopgi/index.html"`, title "POTATO CATCHER 뽑기"). No mode-select (single experience).
- [ ] **Step 5:** Add a hub card in `app/page.tsx` for 🕹️ 뽑기 → `/ppopgi` (match existing card markup).
- [ ] **Step 6:** Gates: `npm run lint`, `npm run type-check`, `npm test`, `npm run build`. All green.
- [ ] **Step 7:** Commit `feat(ppopgi): promote claw game to /ppopgi (self-contained modules + page + hub card)`.

*(Module split of `main.js` into cabinet/claw/prizes/ui/sfx happens incrementally in M2 as those areas are touched — avoid a risky big-bang split; keep it running + verified at each commit.)*

---

## Milestone M2 — New features (chute/collection, camera, result loop)

### Task M2.1 — Prize chute + visible collection bin

**Files:** `public/ppopgi/src/chute.js` (create), `src/main.js` (wire), `src/logic/scoring.js` (pure count/score).

- [ ] **Step 1:** Build a **collection bin** in `cabinet.js`/`chute.js`: a small open box (static body + visual) inside the lower cabinet under the hole, behind a **translucent prize-door window** on the front face (replace the opaque body where the door is so the bin is visible). Chute guide walls funnel from the hole down into the bin.
- [ ] **Step 2:** On delivery (prize crosses the hole region falling), instead of `world.removeBody + mesh.visible=false`, **hand the prize to the bin**: keep its body, set collision to bin-only, let it fall/rest in the bin (visible). Track `collected` (count + value). Cap visible bin prizes (~8): when exceeded, fade+remove the oldest.
- [ ] **Step 3:** Payoff: "GET! +value" popup + prize-door glow pulse + `sfx.get()`; HUD shows `획득 N`.
- [ ] **Step 4:** Headless verify: collected count increments on delivery; bin never exceeds cap; 0 errors. Screenshot showing prizes piled in the bin behind the door.
- [ ] **Step 5:** Commit `feat(ppopgi): real prize chute + visible collection bin + GET payoff`.

### Task M2.2 — Settable camera (drag-orbit + presets)

**Files:** `public/ppopgi/src/camera.js` (create — extract from main), `index.html` (preset buttons), `src/ui.js` (wiring).

- [ ] **Step 1:** Extract camera into `CameraRig`: state `{ azimuth, pitch, radius, target }`, `update(dt)` positions + lerps toward a goal pose; `setPreset(name)` (play/front/side/top) sets goal pose; `applyDrag(dx,dy)` adjusts azimuth/pitch (pitch clamped); shake.
- [ ] **Step 2:** Pointer drag on the **canvas** rotates the camera (pointerdown/move/up on `#game`, separate from the joystick DOM → no conflict); momentum/damping.
- [ ] **Step 3:** Add preset buttons (`정면/측면/위/기본`) in `index.html` (top-right, touch-friendly) → `cameraRig.setPreset(...)`. Smooth lerp between poses.
- [ ] **Step 4:** Verify: drag rotates; each preset frames as intended (top shows X/Z, side shows depth); returns to play. Screenshots of each preset.
- [ ] **Step 5:** Commit `feat(ppopgi): settable camera — drag-orbit + front/side/top presets`.

### Task M2.3 — Result / replay loop

**Files:** `index.html` (result overlay), `src/ui.js`, `src/logic/round.js`.

- [ ] **Step 1:** On time-up, show a **result overlay**: 획득 경품 목록(아이콘/값) + 총점 + 최고기록(`localStorage`); buttons 다시 하기(→ re-payment) / 그만.
- [ ] **Step 2:** Wire to the existing payment re-insert loop (replace the bare GAME OVER). Best score persists.
- [ ] **Step 3:** Verify + screenshot. Commit `feat(ppopgi): result screen with collected prizes + best score + replay`.

---

## Milestone M3 — Tests (pure logic unit + e2e)

### Task M3.1 — Pure-logic unit tests (vitest)

**Files:** `__tests__/unit/ppopgi/{scoring,grip,sampling,round}.test.ts` (create), `public/ppopgi/src/logic/*.js` (ensure pure + exported).

- [ ] **Step 1:** `scoring.test.ts` — value-run aggregate + combo step + collected-count; edge: empty, single, golden weighting. Write failing → implement/confirm `scoring.js` pure fns → pass.
- [ ] **Step 2:** `grip.test.ts` — `breakDist(centeredness, weight, n)` monotonic (off-center/heavier/multi → smaller) + slip predicate at threshold.
- [ ] **Step 3:** `sampling.test.ts` — weighted pick distribution (seeded rng) hits each item; weights respected over N draws.
- [ ] **Step 4:** `round.test.ts` — timer counts only when started; ends at 0; reset.
- [ ] **Step 5:** Run `npm test` (all green, count up). Commit `test(ppopgi): pure-logic unit tests (scoring/grip/sampling/round)`.

### Task M3.2 — e2e (Playwright)

**Files:** `e2e/ppopgi.spec.ts` (create).

- [ ] **Step 1:** Tests: (a) `/ppopgi` loads, canvas present, 0 console errors; (b) payment(coin)→START hides overlay; (c) drive `window.__claw` start→setHand→drop→ poll collected>0; (d) camera preset button changes the view (assert a `cameraRig` state via `window.__claw`); (e) time-up shows result overlay.
- [ ] **Step 2:** Run `npm run test:e2e` (green). Commit `test(ppopgi): e2e — load/payment/collect/camera/result`.

---

## Milestone M4 — Remove Fryffel Tower (careful, isolated)

**Files:** delete `public/fry-tower-game/`, `app/fry-tower-game/`, `__tests__/unit/fry-tower-game/`, `e2e/fry-tower-game.spec.ts`, `e2e/fry-tower-multiplayer.spec.ts`; edit `app/page.tsx` (remove the Fryffel card), server frytower-only symbols, README.

- [ ] **Step 1:** Confirm `/ppopgi` imports nothing from `public/fry-tower-game/` (grep). The proto under `public/fry-tower-game/proto/` is removed with the dir.
- [ ] **Step 2:** Remove the server `frytower` GameType: find its enum/`TICK_RATES`/`SocketManager` case + `FryTowerGameSession`; delete ONLY those, leaving `GameSessionBase`/lobby/escape/survival untouched. `npm --prefix server run build` + tsc green.
- [ ] **Step 3:** Delete the fry-tower files/dirs + hub card + the two e2e specs + unit dir; update README references.
- [ ] **Step 4:** Full gates: lint, tsc (root + server), `npm test`, `npm run test:e2e`, `npm run build` — all green; hub + escape/survival/desert/flight still load (smoke).
- [ ] **Step 5:** Commit `chore: remove Fryffel Tower (replaced by /ppopgi claw machine)`.

---

## Milestone M5 — Deploy + verify live

- [ ] **Step 1:** Push `main` → Vercel prod. Poll `games.writingdeveloper.blog/ppopgi/index.html` for 200 + markers (`POTATO CATCHER`, `cameraRig`); confirm `/fry-tower-game/` is gone (404); hub shows the 뽑기 card.
- [ ] **Step 2:** Live browser screenshot (desktop + mobile viewport). Report.
- [ ] **Step 3:** Update memory ([[mini-games-claw-machine-pivot]], [[mini-games-fry-tower-game]] → mark removed, [[mini-games-portfolio]] hub list).

---

## Self-review notes
- **Spec coverage:** URL/page/hub (M1, M5), engine/modules (M1), camera (M2.2), chute/collection (M2.1), loop (M2.3), tests (M3), deletion (M4), deploy (M5). PrizeSet/engine abstraction intentionally deferred to Phase 2 (YAGNI — only V1 now); M1 keeps a clean module split without the formal interface.
- **No fry-tower dep** is the precondition for M4 (M1 Step 2 enforces it; M4 Step 1 verifies).
- **Physics:** ported verbatim from the verified proto; re-verified after M1 Step 3 and each M2 task — never re-tuned blindly.
- **Risk:** server frytower removal — isolate symbols, verify server tsc + other games (M4 Step 2/4).
