# 뽑기 (ppopgi) — Claw-Machine Game, Full Build (Design Spec)

**Date:** 2026-06-17
**Status:** Design → plan → implement → test/QA → **deploy to prod** (the pivot is now official; QA happens on the live prod env per the user's 2026-06-17 workflow change).
**Repo:** `Mini-Games`. Promotes the claw-machine prototype (built under `public/fry-tower-game/proto/`) into a standalone game, **replacing Fryffel Tower entirely**.
**Supersedes/builds on:** `2026-06-16-claw-machine-pivot-design.md` (the platform concept + grab-and-hold physics, now validated in the proto).

---

## 1. 결정 (user, 2026-06-17)

- **URL/route:** `/ppopgi` (romanized 뽑기). New `app/ppopgi/page.tsx` + `public/ppopgi/`. Game title stays **"POTATO CATCHER"** (fry V1 theme).
- **Fryffel Tower:** **완전 삭제** — remove files/route/tests/hub-card/server-session. Recoverable from git history. Done **only after** the claw game is fully self-contained (it currently reuses fry-tower `src/` modules).
- **Camera:** **drag-orbit (mouse+touch) + Front / Side / Top preset buttons.**

## 2. 동기 / 목표

The proto validated the *feel* (real spring-grip physics, arcade dressing, payment, touch joystick, player-POV). Two gaps remain and the code is a single 600-line proto file. This build (a) promotes it to a proper, self-contained, **module-structured game** at its own URL, (b) closes the two gaps the user flagged — **settable camera angle** and a **real prize chute/collection** (right now a won prize just vanishes), and (c) does the recommended engineering (pure-logic unit tests, e2e, gates, headless physics verify, docs, deploy).

## 3. 아키텍처 — 엔진 + 콘텐츠 + UI + 순수로직

Build-free Three.js r0.184 (importmap CDN) + cannon-es 0.20 (esm.sh), same runtime pattern as desert-game. `public/ppopgi/`:

- **`index.html`** — importmap, canvas, DOM overlays (payment, HUD, joystick, camera buttons, result), CSS.
- **`src/main.js`** — bootstrap + game loop + wiring (engine ↔ UI ↔ input).
- **`src/engine/ClawEngine.js`** — content-agnostic orchestrator: owns world, cabinet, camera rig, claw, prize pile, chute/collection, round/score. Consumes a `PrizeSet`. Knows nothing about fries.
- **`src/engine/Cabinet.js`** — detailed cabinet meshes (base + console + framed glass + marquee + neon + **chute/bin/prize-door**) + the arcade environment (floor, neighbor machines, hall). Visual only.
- **`src/engine/Claw.js`** — kinematic hub + 3 animated prongs + the **conditional, stress-breakable spring grip** (ported from the proto: cage-check at close, G_HELD extraction, snap on stretch>breakDist weighted by centeredness/weight/count, chute-aligned return).
- **`src/engine/CameraRig.js`** — camera with **drag-orbit** (pointer) + **preset angles** (player-POV default, Front, Side, Top) with smooth lerp; clamped pitch.
- **`src/engine/Chute.js`** — the **prize collection**: a won prize falls through the hole into a **chute → collection bin** behind the **prize door**, where delivered prizes are kept visible and accumulate; emits a `collected` event (count + value). Replaces the proto's "remove + vanish".
- **`src/content/PrizeSet.js`** — the interface + shared helpers (weighted sampling). `{ id, name, theme, spawn(count), makeMesh(rng, item), makeBody(mat, item), items:[{value, weight, mass, tint}] }`.
- **`src/content/fryPrizeSet.js`** — **V1**: fry meshes (port `fryMesh` into the game, self-contained), values 1/3/5 with mass + tint.
- **`src/logic/`** — **PURE, cannon-free, unit-tested:** `scoring.js` (value-run aggregate + combo), `grip.js` (breakDist + slip threshold as pure fns), `sampling.js` (PrizeSet weighted pick), `round.js` (timer/state). These are the testable heart.
- **`src/ui/`** — `payment.js` (coin/card → credit → start), `joystick.js` (analog pointer joystick + drop button), `camera-ui.js` (preset buttons + drag), `result.js` (game-over: collected prizes + score + replay), `hud.js` (score/held/slip/time/credit).
- **`src/audio/sfx.js`** — procedural Web Audio (coin/card/start/grab/slip/get), self-contained (no fry-tower AudioManager dep).

**Unit boundary:** the engine depends on the `PrizeSet` interface only (not fry internals) → versions are swappable + independently testable. Pure logic has zero Three/cannon imports → fast vitest.

## 4. 신규 기능 1 — 설정 가능한 카메라 (실제처럼)

- **Drag-orbit:** pointer-drag on the canvas rotates azimuth (and a little pitch, clamped) around the cabinet — like leaning around a real machine. Touch + mouse via Pointer Events. Inertia/damping for smoothness.
- **Preset buttons (corner of screen):** **정면(Front)** · **측면(Side)** · **위(Top)** · **기본(Play)** — each lerps the camera to a fixed angle to judge depth before dropping (top view = see X/Z exactly; side = see depth). Returns to the play angle to drop.
- Keyboard `[ ]` still nudges azimuth (desktop). Default = the player-POV front view from the proto.

## 5. 신규 기능 2 — 경품 배출/수거 (현재 없음)

Real machine: prize falls through a floor hole → a **chute** → a **collection bin** behind a **flap door** at the bottom-front, visible to the player.

- On delivery (prize enters the hole region while falling), it is **handed to `Chute`** instead of being removed: the prize keeps its body but is funneled (chute guide walls) down into a **bin** inside the lower cabinet, behind a **translucent prize-door window** — so you **see it drop in and pile up**.
- A **"GET!" payoff** (popup + door glow + sound), a **수거 카운트** ("획득 N개") in the HUD, and the won prizes visible through the door for the rest of the round.
- Bin has a cap (e.g., keep last ~8 visible, older ones fade/removed) to bound body count.
- Pure delivery/score logic stays in `logic/` (testable); the visible bin is engine/render.

## 6. 게임 루프

`머신(Play)` → **결제**(동전/카드 → CREDIT) → **START** → **플레이**(제한시간 가치런: 조준→집기→운반→배출→수거, 콤보) → **시간종료 → 결과**(획득 경품 목록 + 점수 + 최고기록 localStorage) → **다시 하기**(재결제 루프). Machine-select (multiple versions) is **Phase 2** (only V1 exists now → 1 machine, select is a no-op stub).

## 7. 삭제 — Fryffel Tower (careful, last)

Remove only after `/ppopgi` is self-contained + green. Targets: `public/fry-tower-game/`, `app/fry-tower-game/`, `__tests__/unit/fry-tower-game/`, `e2e/fry-tower-game.spec.ts`, `e2e/fry-tower-multiplayer.spec.ts`, the hub card in `app/page.tsx`, and **frytower-only** server code (`FryTowerGameSession` + the `frytower` GameType/TICK_RATES/SocketManager case) — **without touching** the shared `GameSessionBase`/lobby/socket infra that **escape & survival** still use. Verify after: `next build`, lint, tsc (root + server), full unit + e2e suites green, hub + other games load. Update README + memory.

## 8. 테스트 / 검증 (권장 작업 전부)

- **Unit (vitest):** `logic/scoring`, `logic/grip`, `logic/sampling`, `logic/round` — pure functions, edge cases.
- **e2e (Playwright) `e2e/ppopgi.spec.ts`:** canvas 0-error load; payment→start; aim→grab→deliver→**collect** (collected count increases); time-up→result; camera preset buttons switch view.
- **Headless physics verify** (scratch `_claw-verify.mjs`, now vs `/ppopgi`): grab/slip/deliver/collect, 0 escapes, 0 errors, accounting consistent.
- **Gates:** `npm run lint` (0 err), `npm run type-check`, `npm test`, `npm run build`. 
- **Deploy:** push `main` → Vercel prod → verify live at `games.writingdeveloper.blog/ppopgi` (200 + markers) + hub shows the new card + fry-tower URL gone.

## 9. 단계 (phasing)

- **Phase 1 (this spec — concrete):** `/ppopgi` self-contained engine-structured game + chute/collection + drag/preset camera + payment/touch + result/replay loop + V1 fry + unit + e2e + **delete fry-tower** + hub card + deploy.
- **Phase 2:** V2 procedural PrizeSet + machine-select screen (cards) + per-machine theming.
- **Phase 3:** asset-based versions (dolls, when glTF available) + MP (value relay).

## 10. 리스크 / 미해결

- Korean route: using romanized `/ppopgi` (ASCII) to avoid Unicode-path fragility (Windows/git/importmap). Title still POTATO CATCHER.
- fry-tower server deletion must not break escape/survival (shared base) — isolate frytower-only symbols; verify server tsc + the other games.
- Chute body count: cap visible bin prizes to bound physics cost.
- Camera drag vs joystick: drag is on the canvas; the joystick is a separate fixed UI element → no input conflict (different DOM targets / pointer capture).
- Migrating the proto's self-contained physics intact (it's tuned) — port verbatim into `Claw.js`/`engine`, then refactor, re-verifying after each step.
