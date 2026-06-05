# Tantrum Tower — QA-Fix Batch (A–E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement the prioritized fixes from the 2026-06-04 QA review (gamer-persona playtest + 5-expert panel) on the live Tantrum Tower construction game, improving event fairness, feedback, balance, testability, and accessibility — without regressing the 50/50 unit · 3/3 e2e green state.

**Architecture:** Build-free Three.js game at `public/construction-game/`. Pure THREE-free logic in `src/logic/` (Vitest), engine/UI wired in `src/main.js` + `src/ui/` + `index.html`/`style.css` (Playwright e2e + manual). Tests in `__tests__/unit/construction-game/*.test.ts` import logic via `../../../public/construction-game/src/logic/<m>.js`.

**Tech Stack:** ES modules, Three.js 0.184 (importmap CDN), Vitest (jsdom), Playwright. mulberry32 PRNG in `logic/spawn.js`.

**Source of truth for the fixes:** the QA review (this session). Each task below restates the concrete change. Determinism note: events NEVER fire during e2e (firstDelaySec 18s ≫ e2e runtime ~4s), so re-seeding the event RNG cannot break e2e.

---

## Task ordering & dependencies
C (pure-fn seam) → A (fairness) → D (balance) → B1 (toast channels) → B2 (effect chips/tint) → E1 (legend+colorblind) → E2 (roster+hire modal) → E3 (reduced-motion+mute). C must land first (A and D build on the extracted functions).

---

## Task C: Extract pure event-effect functions + tests

**Files:**
- Modify: `public/construction-game/src/logic/events.js`
- Modify: `public/construction-game/src/main.js` (`applyEvent`, the event-tick multiplier block, `startGame` init)
- Modify: `__tests__/unit/construction-game/events.test.ts`

Extract the THREE-free portions of `applyEvent` and the multiplier decay into pure, testable functions in `events.js`, matching the `economy.js` "mutate a plain state object" style. The engine keeps only the side effects (toast/audio).

- [ ] **Step 1: Write failing tests** in `events.test.ts` for the new pure functions. Add (in the existing Vitest style, importing `mulberry32` from spawn.js, `CONFIG` from config.js):
  - `initEventState()` returns `{ prodMult:1, prodTimer:0, boostMult:1, boostTimer:0 }`.
  - `applyEventEffects(state, ev, E, rng)` where `state = { workers:[{logic:{rage,escaped,activity},archetype:{rageSensitivity}}], economy, prodMult, prodTimer, boostMult, boostTimer }`:
    - snack: every non-escaped worker rage drops by `E.snackRageDrop`, clamps at 0, escaped untouched; `boostMult===E.snackBoost`, `boostTimer===E.snackSec`.
    - supply: `economy.funds += E.supplyBonus`; null-economy no-throw; `boostMult===E.supplyBoost`.
    - inspection: `economy.funds += E.inspectionBonus`; multipliers untouched (stay 1).
    - breakdown: `prodMult===E.breakdownProdMult`, `prodTimer===E.breakdownSec`.
    - accident: deterministic victim under stub rng (`()=>0.5` → middle of 3), rage `+E.accidentRageSpike * sensitivity`, clamps at 100; all-escaped ⇒ no mutation/no throw.
    - returns `{ id, kind }`.
  - `tickEventMultipliers(state, dt)`: partial decay leaves mult unchanged; on expiry restores mult to **exactly 1** and timer to 0; prod & boost channels independent; expired stays 1 across further ticks; no negative timers.

- [ ] **Step 2: Run tests red** — `npx vitest run __tests__/unit/construction-game/events.test.ts` → fail (functions undefined).

- [ ] **Step 3: Implement in `events.js`.** Add:
```js
export function initEventState() {
  return { prodMult: 1, prodTimer: 0, boostMult: 1, boostTimer: 0 };
}

// Pure. Mutates state (workers' .logic, economy, the 4 mult/timer fields). rng injected. Returns {id,kind}.
export function applyEventEffects(state, ev, E, rng, helpers) {
  const { addRage } = helpers; // inject rage.js addRage to keep events.js dependency-light & THREE-free
  switch (ev.id) {
    case 'snack':
      for (const w of state.workers) { if (w.logic.escaped) continue; addRage(w.logic, -E.snackRageDrop, w.archetype.rageSensitivity); }
      state.boostMult = E.snackBoost; state.boostTimer = E.snackSec; break;
    case 'supply':
      if (state.economy) state.economy.funds += E.supplyBonus;
      state.boostMult = E.supplyBoost; state.boostTimer = E.supplySec; break;
    case 'inspection':
      if (state.economy) state.economy.funds += E.inspectionBonus; break;
    case 'breakdown':
      state.prodMult = E.breakdownProdMult; state.prodTimer = E.breakdownSec; break;
    case 'accident': {
      const victims = state.workers.filter((w) => !w.logic.escaped);
      if (victims.length) { const v = victims[Math.floor(rng() * victims.length)]; addRage(v.logic, E.accidentRageSpike, v.archetype.rageSensitivity); }
      break;
    }
  }
  return { id: ev.id, kind: ev.kind };
}

export function tickEventMultipliers(state, dt) {
  if (state.boostTimer > 0) { state.boostTimer -= dt; if (state.boostTimer <= 0) { state.boostTimer = 0; state.boostMult = 1; } }
  if (state.prodTimer > 0)  { state.prodTimer -= dt;  if (state.prodTimer <= 0)  { state.prodTimer = 0;  state.prodMult = 1; } }
}
```
  Note: inject `addRage` via a `helpers` arg (tests pass the real `addRage` from rage.js) so `events.js` stays import-light and THREE-free. Tests import `addRage` from `../../../public/construction-game/src/logic/rage.js`.

- [ ] **Step 4: Rewire `main.js`.** Replace the inline `applyEvent` body and the `_eventProdMult/_eventBoostMult` fields with a single `g._eventState` object (from `initEventState()`), call `applyEventEffects`/`tickEventMultipliers`, and keep toast/audio in the engine. Concretely:
  - Import `{ pickEvent, applyEventEffects, tickEventMultipliers, initEventState }` from events.js; ensure `addRage` already imported.
  - In `startGame`: replace the 4 `_eventProd*/_eventBoost*` inits with `game._eventState = initEventState();` (keep `_eventRng`, `_eventTimer`).
  - `applyEvent(ev, g)` becomes:
```js
function applyEvent(ev, g) {
  const view = { workers: g.workers, economy: g.economy, ...g._eventState };
  const res = applyEventEffects(view, ev, CONFIG.events, g._eventRng, { addRage });
  g._eventState.prodMult = view.prodMult; g._eventState.prodTimer = view.prodTimer;
  g._eventState.boostMult = view.boostMult; g._eventState.boostTimer = view.boostTimer;
  showToast(`${ev.icon} ${ev.label}`);
  if (g.audio) { if (res.kind === 'bad') g.audio.alarm(); else g.audio.combo(); }
}
```
  (Or store `_eventState` fields directly on the view by reference — simpler: build `view` once referencing `g._eventState`'s fields. Implementer picks the cleanest non-aliasing approach; the multipliers must end up on `g._eventState`.)
  - In `game.step`: replace the two manual timer-decay lines with `tickEventMultipliers(g._eventState, dt);` and change the production line to `* g._eventState.prodMult * g._eventState.boostMult`.

- [ ] **Step 5: Run all construction-game unit tests** — `npx vitest run __tests__/unit/construction-game/` → green. Then `npm run lint` + `npm run type-check` → clean.

- [ ] **Step 6: Commit** — `refactor(construction): extract pure event-effect fns (applyEventEffects/tickEventMultipliers/initEventState) + tests`.

---

## Task A: Event fairness — re-seed per session + first-event grace + no-2-consecutive-bad

**Files:**
- Modify: `public/construction-game/src/logic/events.js` (a stateful guarded picker)
- Modify: `public/construction-game/src/main.js` (`startGame` re-seed; use guarded picker)
- Modify: `__tests__/unit/construction-game/events.test.ts`

- [ ] **Step 1: Write failing tests** for a new `pickEventGuarded(rng, ctx)` where `ctx = { firstEvent:boolean, lastKind:string|null }`:
  - When `ctx.firstEvent === true`, the returned event `kind !== 'bad'` (resamples up to a cap; assert over many seeds it's never bad on first).
  - When `ctx.lastKind === 'bad'`, the returned event `kind !== 'bad'` (no two consecutive bad).
  - Otherwise behaves like `pickEvent` (still weighted, deterministic given rng).
  - Determinism preserved: same seed + same ctx sequence → same picks.

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement `pickEventGuarded`** in events.js:
```js
export function pickEventGuarded(rng, ctx) {
  const mustAvoidBad = ctx.firstEvent || ctx.lastKind === 'bad';
  let ev = pickEvent(rng);
  for (let i = 0; mustAvoidBad && ev.kind === 'bad' && i < 6; i++) ev = pickEvent(rng);
  return ev;
}
```
  (Re-rolls consume the rng stream — deterministic. Cap 6 guarantees termination; with good+neutral weight 8/12 the chance of 6 straight bads is ~0.0007, and the fallback simply returns the last bad — acceptable.)

- [ ] **Step 4: Wire into `main.js`.** In `startGame`, re-seed per session for cross-game variety while keeping spawn deterministic:
```js
game._eventRng = mulberry32((CONFIG.seed + 777 + (game._session || 0) * 2654435761) >>> 0);
game._eventCtx = { firstEvent: true, lastKind: null };
```
  (Uses the per-session counter `game._session` already incremented in startGame — gives a different stream each playthrough, fully deterministic per session, zero `Math.random()`, zero e2e risk. Confirm `game._session` is set before this line; if not, move the `_session` increment above it.)
  In the event-fire block in `game.step`, replace `pickEvent(g._eventRng)` with:
```js
const ev = pickEventGuarded(g._eventRng, g._eventCtx);
g._eventCtx.firstEvent = false; g._eventCtx.lastKind = ev.kind;
applyEvent(ev, g);
```

- [ ] **Step 5: Tests + lint + type-check green.**

- [ ] **Step 6: Commit** — `feat(construction): event fairness — per-session reseed + first-event grace + no-2-consecutive-bad`.

---

## Task D: Balance — drill rework, per-difficulty event scaling, breakdown tuning, accident-riot guard

**Files:**
- Modify: `public/construction-game/src/logic/config.js` (events durations)
- Modify: `public/construction-game/src/logic/managers.js` (drill stats)
- Modify: `public/construction-game/src/logic/difficulty.js` (event multipliers)
- Modify: `public/construction-game/src/logic/events.js` (`applyEventEffects` honors difficulty mults + accident excludes ≥flee)
- Modify: `public/construction-game/src/main.js` (pass difficulty event-mults; accident threshold)
- Modify: `__tests__/unit/construction-game/{difficulty,managers,events}.test.ts`

- [ ] **Step 1: config.js** — `events.breakdownSec` 14 → 9; `events.snackSec` 6 → 8; `events.supplySec` 6 → 8.

- [ ] **Step 2: managers.js (drill rework)** — change drill `hireCost` 2000 → 1400 and `salary` 12 → 8 (de-trap it). Update `managers.test.ts` expectations.

- [ ] **Step 3: difficulty.js** — add to each mode `eventBadMult` and `eventGoodMult`: easy `{eventBadMult:0.6, eventGoodMult:1.2}`, normal `{1.0,1.0}`, hard `{eventBadMult:1.3, eventGoodMult:0.9}`. In `applyDifficulty`, write them onto `config.events.badMult`/`config.events.goodMult`. Add `difficulty.test.ts` cases. (Add `badMult:1, goodMult:1` defaults to the `config.js` events block.)

- [ ] **Step 4: events.js `applyEventEffects`** — scale by difficulty mults (read from `E.badMult ?? 1`, `E.goodMult ?? 1`): breakdown duration `E.breakdownSec * badMult` and accident spike `E.accidentRageSpike * badMult`; snack/supply boost magnitude `1 + (E.snackBoost-1)*goodMult`, durations and bonuses (`supplyBonus`,`inspectionBonus`) `* goodMult`. Accident victim selection: **exclude workers already at/over flee threshold** so an event can't directly trigger a riot — filter `victims` to `!escaped && w.logic.rage < CONFIG.rage.flee` (inject the flee threshold via `E` or a param; simplest: add `fleeThreshold` to the `E` object passed in, or pass `CONFIG.rage.flee`). Update tests for the scaled values + the flee-exclusion.

- [ ] **Step 5:** Verify `main.js` passes the now-augmented `CONFIG.events` (it already does) and that `applyDifficulty` runs before the first event. Tests + lint + type-check green.

- [ ] **Step 6: Commit** — `feat(construction): rebalance events (drill de-trap, per-difficulty scaling, breakdown 9s, accident≥flee guard)`.

---

## Task B1: Separate toast channels (events vs rewards/system) + queue

**Files:**
- Modify: `public/construction-game/index.html` (add a second toast element)
- Modify: `public/construction-game/style.css` (style the two channels)
- Modify: `public/construction-game/src/main.js` (`showToast` → `showEventToast` + `showRewardToast`, each queued)

- [ ] **Step 1:** In `index.html`, keep `#toast` (top-center, for **site events**) and add `<div id="reward-toast" class="toast reward hidden"></div>`. In `style.css`, position `.toast.reward` distinctly (e.g. top-center but offset downward, or top-right under score) and give event vs reward distinct accent (event banner valence colors added in E1; reward = gold).
- [ ] **Step 2:** In `main.js`, split `showToast` into `showEventToast(msg, kind)` (uses `#toast`) and `showRewardToast(msg)` (uses `#reward-toast`), each with its own timer. Route callers: `applyEvent` → `showEventToast`; building-completion (`🏢 건물 완공`), auto-fire (`💸 적자`), AssetLoader warn callback → `showRewardToast`. Add a tiny per-channel queue: if a message arrives while one is showing, enqueue and show sequentially (min ~1.2s each) so bursts don't clobber.
- [ ] **Step 3:** Manual/e2e: ensure no console errors; the existing e2e still passes. Lint + type-check green.
- [ ] **Step 4: Commit** — `feat(construction): split event vs reward toast channels with per-channel queue`.

---

## Task B2: Persistent ongoing-effect indicators (status chips + progress-bar tint)

**Files:**
- Modify: `public/construction-game/index.html` (a status-chip row)
- Modify: `public/construction-game/style.css`
- Modify: `public/construction-game/src/ui/HUD.js` (render chips from `_eventState` timers; tint progress fill)

- [ ] **Step 1:** Add `<div id="status-chips"></div>` near the timer/progress HUD. Style chips (icon + countdown), red for penalty / green for boost.
- [ ] **Step 2:** In `HUD.update`, read `game._eventState` (prodTimer/prodMult, boostTimer/boostMult) and render a chip per active effect, e.g. `🔧 −50% 8s` (prodMult<1) / `🍱 +40% 4s` (boostMult>1), with the draining timer; remove when timer hits 0 (gives the "effect ended" cue). Also tint `#progress-fill` (swap gradient) red while `prodMult<1`, green/gold while `boostMult>1`, default otherwise. Keep HUD's existing 10Hz throttle.
- [ ] **Step 3:** Lint + type-check + unit green; manual no-errors.
- [ ] **Step 4: Commit** — `feat(construction): persistent event-effect status chips + progress-bar tint`.

---

## Task E1: Events legend (onboarding) + colorblind redundant coding

**Files:**
- Modify: `public/construction-game/index.html` (events legend on start menu; valence markers)
- Modify: `public/construction-game/style.css`
- Modify: `public/construction-game/src/main.js`/`HUD.js`/`Worker.js` as needed for redundant coding

- [ ] **Step 1:** Add a compact **events legend** to the start menu (under the controls grid): 5 rows `icon — label — ▲호재/�zh▼악재/◆중립`. Source labels/icons from `SITE_EVENTS`.
- [ ] **Step 2: Redundant (non-color) valence coding:** event banner (`#toast`) gets a shape/text marker by kind — good = green border + `▲`, bad = red border + `▼`, neutral = `◆` — not hue alone. Rage danger: when a worker's rage ≥ flee (red zone), add a redundant glyph/outline cue on its status sprite (e.g. `💢`) so red/green isn't the only signal. Funds-warn: add `⚠`/`(적자)` text alongside red.
- [ ] **Step 3:** Lint + type-check + unit green.
- [ ] **Step 4: Commit** — `feat(construction): a11y — events legend + colorblind-safe redundant coding`.

---

## Task E2: Manager roster HUD + hire menu modal

**Files:**
- Modify: `public/construction-game/index.html`, `style.css`, `src/ui/HUD.js` (roster), `src/ui/HireMenu.js`/`style.css` (modal)

- [ ] **Step 1: Roster HUD** — a small corner list of active managers (`icon label`), driven from `game.managers`, so identification doesn't depend on the 3D scene (the top "diorama readability" finding). Update on hire/fire (HUD 10Hz tick is fine).
- [ ] **Step 2: Hire menu → centered modal** (like pause/result) instead of the right-dock that overlaps the rightmost plot; ensure all 4 manager cards fit without scrolling at 1280×800 (tighten padding or 2×2 grid). Keep the toggle button + Esc/닫기.
- [ ] **Step 3:** Lint + type-check + unit green; existing e2e (`#hire-toggle` + `#hire-list .hire-card button`) must still pass — keep those selectors/ids.
- [ ] **Step 4: Commit** — `feat(construction): manager roster HUD + hire menu modal (readability/overlap fix)`.

---

## Task E3: Reduced-motion support + audio mute/volume toggle

**Files:**
- Modify: `public/construction-game/style.css` (prefers-reduced-motion), `src/render/retroMaterial.js`/`DioramaCamera.js`/`Worker.js` (motion toggle), `src/audio/AudioManager.js` + `index.html`/`main.js` (mute UI)

- [ ] **Step 1: Reduced motion** — honor `@media (prefers-reduced-motion: reduce)` for CSS transitions/hover-scale, and add a runtime flag (default from the media query, plus a toggle in pause menu) that: reduces/zeroes the vertex-snap jitter (`retroMaterial.js` `uSnap`), disables riot bob (`Worker.js`) and confront push-in (`DioramaCamera`). Keep dither/posterize/low-res (resolution is fine; only motion is the trigger).
- [ ] **Step 2: Audio mute/volume** — add `AudioManager.setMuted(bool)`/`setVolume(0..1)` (toggle `master.gain`), and a mute button (pause menu and/or a small always-visible control); persist in `localStorage`. Surface audio state visibly.
- [ ] **Step 3:** Lint + type-check + unit green; manual no-errors.
- [ ] **Step 4: Commit** — `feat(construction): a11y — reduced-motion option + audio mute/volume`.

---

## Final
- [ ] Full gates: `npx vitest run __tests__/unit/construction-game/` + `npm run lint` + `npm run type-check` + `npx playwright test e2e/construction-game.spec.ts` all green.
- [ ] Add an e2e smoke that fires an event fast via a `?eventDelay=` test hook (QA expert rec #3): `startGame` reads the param and shortens `_eventTimer`; e2e asserts a toast appears with 0 console errors. (Production default unchanged.)
- [ ] Play-verify (controller): re-seed gives a different opening; chips/tint show during effects; roster + modal; reduced-motion + mute work.
- [ ] Update story file §5.2 (note the QA-fix pass) + memory.
- [ ] Finish branch → merge to main (Vercel prod) per established pattern.
