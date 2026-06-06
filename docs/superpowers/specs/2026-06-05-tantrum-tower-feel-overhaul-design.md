# Tantrum Tower — Feel Overhaul Design (S-overhaul)

> Source: multi-agent expert panel (workflow `tantrum-tower-feel-overhaul`, 7 agents) +
> user decisions on 2026-06-05. This is the design record; the implementation plan lives in
> `docs/superpowers/plans/2026-06-05-tantrum-tower-feel-overhaul.md`.

## Player request (verbatim intent)
1. Buildings finish automatically without nagging workers — managing must **matter** again (but stay relaxed via manager-delegation, not frantic).
2. Workers should show a visible "doing work" reaction/motion while building.
3. The empty area **outside the construction fence** feels barren — fill it.
4. The buildings being constructed should look more **realistic**.
5. StarCraft-SCV style: workers gather at the building and **interact** with it.
6. Audit **all hireable-character AI** — make behavior precise, fix oddities.
7. Research free online **voice + 3D assets** to add, and what's worth adding.

## Confirmed decisions (2026-06-05)
- **Rebalance strength:** use the experts' simulation-verified numbers (unmanaged loses; need to actively manage or delegate 2–3 managers; over-pushing causes riots). Restores the 양날의 검 without re-introducing frantic constant-soothing.
- **Worker visuals:** **Hybrid** — ship the primitive hammer-rig motion now (guaranteed visible, deterministic) AND wire the animated Kenney glTF worker behind the existing graceful AssetLoader fallback (loads → real hammer animation; fails → primitive).
- **Assets this batch:** all three — Korean foreman voice (MeloTTS, MIT), CC0 construction SFX/ambience, modular building+prop glTF.

---

## Diagnosis: why it "builds itself"

**The pure logic does NOT auto-win unmanaged.** A worker outputs only while `state==='working'`; once `slackTimer<=0` it flips to `slacking` and nothing restores `working` except `applyTactic` (player key or a manager) or vibe's slack top-up. With no input, rage stays 0, so a slacked worker is dead forever. Integrated unmanaged progress over a shift ≈ **1 floor** vs a 9-floor target — doing nothing already **loses**.

**What the player actually saw = hired managers trivially win with zero rage risk:**
- `soothe` was three free benefits: −25 rage **and** +30% output (`boost 1.3`) **and** re-activate. A soothe-manager keeps the whole crew at rage 0 forever.
- `rageDecayPerSec` was so high (easy/normal/hard 6.8/5.4/4.4) that bark's +28 every ~5s was cancelled by decay (~27) → **rage never accumulates** → the "risk" half of the sword never fires.
- `successRate 1.0` + a hard-coded `AWARENESS=22` (= the 44-wide lot's half-width) made one manager omniscient.

**Conclusion: logic is sound; the surrounding numbers are wrong.** Fix is mostly tuning + a manager-AI triage rewrite.

---

## Story designs (concrete)

### S1 — Rebalance (numbers only) — scope S
Files: `logic/config.js`, `logic/difficulty.js`, `__tests__/unit/construction-game/difficulty.test.ts`.
- `tactics.soothe.boost` 1.3 → **1.0** (the single fix that restores the sword: calming is now the safe, lower-throughput option; bark 2.0 / taunt 1.6 unchanged so the boost ladder mirrors the rage ladder). Set to 1.0 (neutral), **not** below — a penalty would recreate the old "must keep soothing" pain.
- `rageDecayPerSec` per difficulty: easy 6.8→**2.6**, normal 5.4→**2.2**, hard 4.4→**1.8** (sustained pushing now accumulates rage → bark-spam/bark-managers drive flee/riot).
- `slackMult` per difficulty: easy 1.5→**1.2**, normal 1.3→**1.1**, hard 1.05→**0.95** (kills the ~15–20s "free runway" at shift start so the need to manage is felt immediately).
- **Unchanged:** base `config.js` `rage.decayPerSec=4` and `slackMult=1.0` (keeps `rage.test.ts` / `workerState.test.ts` green); `production.js`, `workerState.js`, `rage.js`, `archetypes.js`, main step logic.
- Update `difficulty.test.ts` numeric pins in the SAME change.
- Verified targets: easy 1 veteran wins; normal needs 2 veterans; hard needs 3; soothe-led delegation wins at rage 0 (relaxed); bark-heavy auto self-limits via riots. Hard-with-3 is thin (~3% margin) — if a playtest fails, relax hard to slack 1.0 / decay 2.0.

### S2 — Manager-AI triage rewrite — scope L
Files: `entities/Manager.js`, `logic/managers.js`, `entities/Worker.js`, new Vitest.
- **Priority targeting (HIGH):** managers currently ignore `fleeing`/`riot`/near-riot workers (chase only slacking+sabotage) — they abandon every real crisis. Replace the binary state filter with a pure `scoreManagerTarget(managerPos, archetype, worker)` (in `logic/managers.js`): eligible = state ∈ {slacking, sabotage, fleeing, riot} OR `rage >= flee - preemptMargin`; `score = stateWeight*100 - k*distSq` (riot 4, fleeing 3, sabotage 2, slacking 1, preempt 0.5). Soothe-capable (veteran/intern) up-weight high-rage; aggressive (drill) down-weight fleeing/riot.
- **Kill dead/divergent code (HIGH):** `pickManagerTarget` is exported, unit-tested, but has **zero callers**, and has diverged (uses `radius²` 4–7 vs the live `AWARENESS=22`). Make `Manager._findProblem` delegate to the single pure picker; per-archetype `awareness` field replaces the global const (veteran widest, intern shortest, ~12 baseline).
- **chooseTactic never crosses flee (HIGH):** drill barking a rage-70 worker → instant riot (the manager you hired causes the riot). Add pure `chooseTactic(archetype, worker, rageCfg)` returning bark/taunt/soothe/null that never selects a rage-raiser that would reach `flee`.
- **Hysteresis (HIGH):** commit to `_target` by worker id; only switch when it becomes ineligible or a clearly higher-priority crisis beats it by a margin; min commit ~0.6–1.0s. Stops per-frame thrash.
- **Separation (MED):** pure `separation(self, others, rsep≈1.4)`; managers flank a shared target at per-manager angle offsets instead of stacking; reused by workers + SCV slots.
- **Vibe fixes (MED):** the `nd > 7` standoff compares squared vs linear (bug) — compare consistently (KEEP≈3.5 linear or its square) so vibe actually mingles; rove toward the **highest-rage** worker in range, not merely nearest. Make the hidden `slackTimer += dt*0.5` aura explicit/named or drop it.
- **Intern fumble (MED):** give failure a readable, capped consequence (small rage bump / worsened slack / "…" reaction); route the success roll through a **seeded** RNG (not `Math.random`) for determinism; keep `Math.random` only for cosmetic bob.
- **Manager state machine (MED):** SEEK → ACT (0.7s, apply once) → COOLDOWN (hold near target) → SEEK; animate during SEEK+ACT not only on the act frame.
- `AWARENESS` 22 → ~12 (zone, not whole lot — reinforces the delegation curve; 14 is a safe compromise if 1 manager oscillates).

### S3 — SCV gather + on-station coupling — scope L
Files: new `logic/site.js`, `logic/production.js`, `entities/Worker.js`, `world/Buildings.js`, `main.js`, new Vitest.
- **Single source of truth (pure `logic/site.js`):** `activeBuildingIndex(floorsBuilt, F)`, `buildingCenter(index, targetBuildings, spacing, groupZ)`; export FOOTPRINT/spacing/groupZ constants imported by BOTH `Buildings.js` and the gather logic so render/logic can't drift. (Building world center = (localX, 0, −6); spacing 12; FOOTPRINT 10.)
- **Work slots (pure, deterministic):** `workSlots(center, footprint, count, ring≈1.0–2.0)` returns stable points hugging the active building's **+Z (camera-facing) face**; assign `worker.id % slots`, with a staggered back row for overflow. Recompute world pos each frame; re-assign only when the active building index changes or crew shrinks.
- **On-station coupling (load-bearing):** `Worker.update` writes `worker.logic.onStation` (dist to slot < ~0.8). `workerOutput` gains a station factor: **full** output on-station, **×0.35** while a productive worker walks to its slot. Sabotage/slacking unaffected. This creates the SCV "travel dip" when the crew migrates to the next building. `production.test.ts` has no `onStation` → default to full when `undefined` (back-compat).
- Workers in `working` gather + face the wall (hammer arc strikes toward it); `slacking`/`sabotage` keep wandering **away** from the line ("that guy walked off the job"). Managers patrol relative to the active-building anchor too (not fixed spawn).
- Logic owns: index, center, slots, assignment, onStation threshold, factor, separation. Render owns: lerp mesh to slot, animation, facing, dust — meeting only through `onStation` + slot coords.

### S4 — Work motion + floor-complete FX — scope M
Files: `entities/Worker.js`, `world/Building.js`, `world/Buildings.js`, `camera/DioramaCamera.js`, `main.js`. New `SpritePool`.
- **Work motion (primitive hammer-rig):** two thin arm boxes parented at shoulders + a tool sprite (canvas hammer glyph, NearestFilter) at the right hand + an additive spark sprite. In the `working` branch drive `_workPhase += dt*(6+rand)` (separate from slow `_wanderPhase`): overhead-down arm arc, forward body lean + tiny crouch on the down-stroke, fire a spark on the down-stroke zero-cross (staggered by `_workRand` so the crew crackles asynchronously). On leaving `working`, lerp arms to rest, hide sparks. **reducedMotion:** static "working" pose (arms fixed, tool visible), no swing/sparks.
- **Floor-complete FX:** easeOutBack pop-in of the new floor (`scale.y 0→1` overshoot "thunk"); pooled dust-puff ring at the floor base; pooled spark burst from the top edge; `DioramaCamera.pushIn` at the building + new `DioramaCamera.shake(amp, secs)` (decaying random offset, guarded by reducedMotion). Floor = small shake; building-complete = bigger shake + existing 🏢 toast. Low "thud" blip co-timed with dust.
- **Perf:** ONE `SpritePool` (preallocated ~64 sprites with vel/life) — never `new` per event; weld sparks reuse one persistent sprite per worker. Reset pools on `buildWorld`. reducedMotion = instant floor + no FX (doubles as the low-end fast path). FX RNG is cosmetic only — never feeds `game.build`/economy/seeded streams.

### S5 — Backdrop outside the fence — scope M
Files: `world/Site.js` (new `_buildExterior()`), `logic/spawn.js` (new `spawnSkyline`), `core/Game.js` (fog), `main.js` (scene.background). All static, added ONCE in Site (survives restarts; auto-retro'd by the existing `applyRetroToObject` pass).
- **Skydome:** large BackSide sphere (r≈600) with a ~15-line gradient ShaderMaterial (top hazy blue → horizon smoggy tan-grey == fog color); `fog:false`, `depthWrite:false`, `userData.__retro=true` so the retro pass skips it. Also set `scene.background` + fog to the same horizon color for cohesion.
- **Fog retune:** `0x9fb0bf`→`0xb9bda8`, `Fog(color, 45, 150)` — lot stays crisp, skyline (70–150m) is 30–100% fogged into soft silhouettes; posterize bands it into clean retro gradients.
- **Distant city:** `spawnSkyline(seed+999, ~64)` → **2 InstancedMesh draw calls** total (bodies: unit box, per-instance color from a muted twilight palette; windows: unit quads, MeshBasic unlit warm `0xffd98a`, ~55% cells dropped to dark). Bias taller/denser into −Z (the camera's hero vista). Deterministic via mulberry32 → CI-stable.
- **Surrounding ground:** y-staggered flat layers (dirt 0.00 / sidewalk −0.01 / parking −0.012 / road −0.015 / asphalt apron −0.02), all darker+desaturated than the tan lot so the site stays the focal plane. Front road meets the gate at z=22.
- **Perf:** ~9–11 extra static draw calls, ~2.7k tris total. Optional: reuse `crane.glb` on the −Z horizon via the existing async loader; instanced street lamps; a box truck past the +X fence.

### S6 — Building realism (primitive) — scope M
Files: `world/Building.js` (new `makeFloorStorey` factory), shared module-level materials.
- Per storey (all flat Lambert unless noted): darkened core slab with per-floor hue jitter; **window band** (thin inset box) with a canvas texture of discrete lit/unlit warm cells on `.map`+`.emissiveMap` (offset per floor so floors differ) — the big realism win; top/bottom **spandrel trim** boxes (lighter concrete); 4 corner **mullions** (dark). 
- **Rooftop** on the topmost floor only (lifted as it grows): AC box, water tank cylinder on legs, antenna mast + tiny red emissive aviation light, parapet lip.
- **Ghost/in-progress:** keep the translucent yellow ghost but add scaffold poles at the 4 corners while `progress<1` so the active floor reads as under-construction (pairs with the SCV crew hammering at its base).
- **Perf/retro:** every material through `applyRetro({snap:160})` once and tagged `userData.shared` (so `removeEntity` won't dispose singletons); window canvas texture created once, shared; ~10 small meshes / ~4 shared materials per storey; consider `mergeGeometries` per completed floor to drop 10 draws→1.
- Optional later polish: a CC0 facade/window **texture** (ambientCG/PolyHaven/Kenney) on the window band; rooftop prop glTFs.

### S7 — Audio + voice + 3D assets — scope M
Files: `audio/AudioManager.js` (add a `fetch → decodeAudioData → AudioBuffer` cache), `assets/AssetLoader.js` (metalness fix), `entities/Worker.js`/`Manager.js` (`setModel` wiring), new `public/construction-game/assets/{chars,props,voice,sfx}/…`.
- **Critical unlock:** the "characters render black" history was a missing one-liner — empty glTF PBR defaults to `metalness=1`. Add `m.metalness=0; m.roughness=1` in `AssetLoader._loadInner`'s existing material traverse → animated Kenney/Quaternius workers render bright. AssetLoader already does `SkeletonUtils.clone` + `AnimationMixer`.
- **Hybrid worker (per decision):** wire the Kenney Mini-Characters hard-hat worker glb in `Worker.setModel()` (currently a no-op) with the existing graceful fallback to the primitive; drive `idle`/`walk`/`interact` from worker state + the SCV gather/work flags from S3/S4.
- **Audio samples:** add the buffer cache, then load CC0 SFX (hammer/impact/ambience loop) and Kenney stings; replace the 55Hz hum with a real site loop; fire hammer on the build tick; stings on `floorUp()`/`alarm()`. Keep the existing oscillator synth as the decode-fail fallback.
- **Korean voice (per decision):** pre-generate short barks (윽박/비꼬기/달래기) + a few worker grunts offline with **MeloTTS-Korean (MIT)** → `.ogg`(+mp3 fallback) under `assets/voice/`; play a random variant from `AudioManager.shout()`. Keep the synth blip as fallback. (Do NOT use edge-tts/Azure — TOS-restricted; avoid CC-BY-NC.)

### Asset shortlist (all CC0/MIT unless noted)
| Asset | License | Use |
|---|---|---|
| Kenney **Mini Characters** | CC0 | animated hard-hat worker (32 anims: idle/walk/interact/pick-up) |
| Kenney **Modular Buildings** | CC0 | realistic building modules (option for S6) |
| Kenney **Conveyor Kit** (itch mirror) | CC0 | outside-fence industrial props (S5) |
| Kenney **Impact / Interface Sounds** | CC0 | beam thuds; floor-complete / alarm stings |
| OpenGameArt **100 CC0 SFX #2** (rubberduck) | CC0 | construction-site ambience loop (replaces 55Hz hum) |
| OpenGameArt **100 CC0 metal & wood SFX** | CC0 | hammer / tool / metal-hit per build tick |
| **MeloTTS-Korean** | MIT | pre-generate Korean foreman barks (output is MIT-clean) |
| Quaternius **Ultimate Modular Men / Universal Anim Lib / Downtown MegaKit** | CC0 | higher-fidelity worker + city upgrade path (later) |
| Pixabay construction SFX | Pixabay (commercial OK, keep CREDITS) | specific clips if a CC0 pack lacks one |
| **AVOID:** Freesound DCSFX loop (CC-BY-NC), edge-tts/Azure (TOS) | — | not commercial-clean |

## Sequencing
S1 → S2 (core loop first — the gameplay foundation). S3 builds the gather geometry that S4's motion/FX reuse. S5/S6 are independent visual passes. S7 last (download/network risk; graceful fallback). Each story: branch work → unit+lint+typecheck green → play-verify → commit; merge core-loop checkpoint first so it can be playtested, then the feel/visual passes, then assets.

## Invariants to preserve
Determinism (mulberry32 streams; outcome RNG seeded, only cosmetic FX may use `Math.random`); existing unit-test shapes (only the rebalanced numeric pins move, in-commit); PS2 retro pipeline; reduced-motion honored everywhere; build-free ESM (no bundler); graceful AssetLoader fallback (missing asset → primitive, no crash).
