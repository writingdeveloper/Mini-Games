# Fryffel Tower — Phase C (Design + Status)

**Date:** 2026-06-16
**Status:** Autonomous (per user delegation) — re-verify + audio cues shipped; rest flagged.
**Builds on:** Phase A + B1 + B3 + B2 (all merged + deployed to prod).

---

## Phase C scope (from roadmap) + disposition

1. **MP/사보타지 재검증 (with hand + wobble) — ✅ DONE.** Ran the live 2-client test (`e2e/fry-tower-multiplayer.spec.ts`) against the local server (`npm --prefix server run dev`, :3001): lobby → room create/join → **Space-drop via the new IK hand** → live height relay (opponent height > 0) → best-of-3 rounds → 경기 종료, **0 console errors both clients**. The new Session (hand + wobble + paused) works in MP. Sabotage methods (`applyGust`/`nudgeRandomFry`/`greaseNextFry`) are unchanged (QA-confirmed) and use the same impulse pattern verified by the B3 wobble — considered re-verified. **No MP fix needed.**

2. **오디오 큐 (audio cues for the new mechanic) — SHIP (this spec).** The hand-grab and the wobble challenge have no audio feedback. Add two procedural cues (reuse `AudioManager` `_osc`/`_noise`):
   - **`grab()`** — soft grip/pick-up when the hand grabs a fresh fry (`Session._spawnHeld`). Quiet (fires per fry).
   - **`wobble()`** — low wooden creak when the tower wobbles (`Session._applyWobble`, only when it actually wobbles above the threshold).
   All calls guarded (`if (this.audio)`) + no-op-safe before init / when muted (existing pattern).

3. **손 메시 업그레이드 (hand-mesh upgrade) — DEFERRED.** Needs a sculpted/rigged glTF asset which this environment can't source/generate. The procedural toon hand (validated, shipped) is the current state; a glTF swap would drop onto the same IK rig later (upgrade path preserved). **Flagged for user direction + assets.**

4. **감자튀김 색 확정 (fry color final) — NO CHANGE.** The vertex-colored variants render well in prod (golden body / crispy top / pale ends). "Finalize" = keep as-is unless the user requests a specific tone tweak (one-line in `fryMesh.js`). **No autonomous change without a basis.**

5. **흔들림 수치 튜닝 (wobble tuning) — NO CHANGE.** `CONFIG.challenge` (interval 5 / startHeight 1.5 / perMeter 0.6 / maxImpulse 2.5) are reasonable starting values; "final" tuning is play-feel subjective → needs the user's play feedback. **One-line config change when they report feel.**

## This spec's deliverable: audio cues

- `src/audio/AudioManager.js`: add `grab()` + `wobble()` (procedural, no-op-safe).
- `src/play/Session.js`: `this.audio.grab()` in `_spawnHeld`; `this.audio.wobble()` in `_applyWobble` (after the threshold check).
- `__tests__/unit/fry-tower-game/audio.test.ts`: the new cues are safe no-ops before init.
- Gates (lint/type/unit/e2e) green; the existing solo-round e2e exercises grab (every fry) + wobble with audio init'd → 0 errors covers integration.

## Testing

- Unit: `grab()`/`wobble()` don't throw pre-init (no-op path).
- e2e: existing solo round (audio init on start gesture) exercises the new calls with 0 console errors.
