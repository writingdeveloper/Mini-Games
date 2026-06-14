# Fryffel Tower (감자튀김 마천루) — Design Spec

**Date:** 2026-06-13
**Status:** Approved (design) — pending implementation planning
**Repo:** `Mini-Games` (5th game in the hub)
**Working name:** *Fryffel Tower* (alt: Fry High, Stack 'o Fries, 감자탑)

---

## 1. Vision & Positioning

A quirky **3D web** game where you stack french fries into the tallest teetering tower
at a fast-food joint, played as a **real-time competitive party game** (2–4 players).

- **Fantasy:** A comedic fast-food setting — fries from the fryer, ketchup, seagulls,
  salt. The humor and the physics teetering are the draw.
- **Core skill:** Physics-based aim & place. The long, thin fry shape makes stacking
  feel unlike block stackers — you cross fries like a log cabin and fight gravity.

### Prior-art research (done 2026-06-13)
No existing product combines *french-fry physics stacking + fast-food theme + 3D + web +
real-time multiplayer*. Adjacent games:
- **Food Stack / Pancake Pileup / Stack the Burger** — single-player, simple food stacking.
- **Idle Fries / We Bare Bears French Fry Frenzy / Make Fries** — fry-*themed* but cooking/idle, not stacking.
- **Korean "감자튀김 게임"** — physical Jenga-style board games, not video games.
- **Tricky Towers** — the gold standard for multiplayer physics stacking, but tetromino
  blocks, paid PC/console, not web.

**Conclusion:** original niche. Differentiators: ① stick-shaped fry physics (crisscross
teetering), ② cheerful fast-food comedy, ③ download-free web real-time multiplayer.

---

## 2. Goals & Non-Goals

**Goals**
- A genuinely fun **solo** stacking loop first (validates the fun without netcode).
- **Real-time 2–4 player** competitive rounds reusing the hub's socket.io infra.
- A new **bright-cartoon** visual identity for the portfolio.
- Stay **build-free** (Three.js via importmap CDN), consistent with the desert game.
- Clean separation of pure logic for unit testing.

**Non-Goals (YAGNI)**
- Cross-client deterministic physics (towers are independent — not needed).
- Accounts/persistence beyond a simple leaderboard (later, optional).
- Mobile-native app; in-game purchases; level editor.
- Anti-cheat beyond light server-side plausibility checks (casual portfolio game).

---

## 3. Core Gameplay Loop

1. A french fry appears, held by a claw/hand above the tray.
2. Player **moves it left/right** and **rotates its angle**.
3. Player **drops** it — full physics applies (it can tip, roll, slide).
4. Each placed fry raises the tower but adds instability; the goal is maximum stable height.
5. Round ends on a timer; tallest non-collapsed tower wins.

**Controls**
- Keyboard: `←/→` move, `↑/↓` (or `Q/E`) rotate, `Space` drop.
- Mouse/touch: pointer to position, drag to rotate, click/tap to drop.
- Reduced-motion option dampens camera shake and particle effects.

---

## 4. Physics & Feel

- **Engine:** `cannon-es` — pure-JS ESM via importmap CDN. Keeps the build-free pipeline
  (no WASM/async init). Rapier was considered but rejected for added complexity; cross-client
  determinism is unnecessary because each player simulates only their own tower.
- **Bodies:** each fry is a box/capsule rigid body on a static tray. Gravity + friction +
  restitution tuned for satisfying teeter.
- **Height metric:** highest stable contact point of the player's tower above the tray.
- **Collapse:** detected when fry bodies fall below the tray line / leave the play volume.
- **Juice (reduced-motion gated):** squash on placement, exaggerated wobble, collapse
  burst (fries scatter + dust), camera shake on collapse, combo sparkle/salt glints.

---

## 5. Multiplayer Architecture

- **Model:** Tricky-Towers-style — each player has an **independent tower**, simulated
  **locally on that player's client**. No shared/cross-client physics → simple networking.
- **Authority:** client is authoritative for its own tower; it reports
  `{height, placedCount, lastEvent}` to the server. The server validates plausibility
  (rate limits, monotonic-ish height, max deltas), broadcasts room state, and adjudicates
  round end (timer) and scoring. Light anti-cheat is acceptable for a casual game.
- **Reuse (hub infra):**
  - `server/src/games/frytower/FryTowerGameSession.ts` extends `GameSessionBase`.
  - New message types added to `server/src/network/MessageTypes.ts`.
  - `LobbyManager`, `Room`, `RoomCodeGenerator`, `SocketManager` reused unchanged.
- **Message flow (high level):**
  - Client → server: `join`, `fry-placed {height, count}`, `tower-collapsed`,
    `sabotage-fire {target, type}`.
  - Server → clients: `room-state`, `opponent-update {playerId, height}`,
    `sabotage-incoming {type, from}`, `round-start`, `round-end {standings}`, `match-end`.
- **Reconnect:** rejoin a room by code; on drop, the player's tower freezes and is scored
  at its last reported height.

### Sabotage system
Earned by stacking well (a combo meter charges a sabotage), fired at a chosen opponent:
- **강풍 선풍기 (Gust)** — bends the target's tower sideways for ~2s.
- **기름 한방울 (Grease)** — the target's next fry has low friction (slippery).
- **갈매기 (Seagull)** — swoops and nudges one fry on the target's tower.
- **케첩 스플랫 (Ketchup splat)** — briefly obscures part of the target's screen.

---

## 6. Win Condition & Scoring

- Round timer ~60–90s. On timeout, the **tallest non-collapsed tower** wins the round.
- **Best-of:** points accumulate across rounds; highest total wins the match.
- **No elimination wait** — a collapsed player keeps trying until the timer ends.
- **Score** = height + stability bonus + combo (consecutive stable placements) + time left.

---

## 7. Modes

- **Solo (offline):** endless / time-attack with a local best score. Playable with **no
  server** — the game is fully enjoyable even with zero other players online.
- **Multiplayer (online):** lobby + room code, 2–4 players, best-of rounds.
- **Bots (later):** AI opponents fill empty room slots so multiplayer is always demoable.

---

## 8. Visual / Audio / UX

- **Visual tone:** bright cartoon finish (saturated colors, glossy highlights, **bold
  outlines**, ketchup red) on clean low-poly geometry. Implemented with toon/flat materials
  + an outline pass — cheap in build-free Three.js.
- **Stage:** a fast-food counter (fryer, tray, neon menu board), cheerful lighting.
- **Audio:** crisp placement "tok", clattering collapse, combo fanfare, upbeat BGM;
  persisted mute/volume.
- **UX:** lobby + room code entry; HUD (height, timer, combo meter, sabotage inventory,
  opponents' heights); results screen; colorblind-safe coding; reduced-motion toggle.

---

## 9. Tech Stack & File Structure

**Client** — `public/fry-tower-game/` (build-free Three.js, desert-game style + cannon-es):
```
public/fry-tower-game/
  index.html                # importmap (three, cannon-es), canvas, boot
  src/
    main.js                 # wiring, game loop, mode select
    core/Game.js            # scene/render/loop orchestration
    logic/                  # THREE/physics-FREE, unit-tested, seeded RNG
      config.js             #   tunables (gravity, timer, scoring weights, sabotage)
      scoring.js            #   height/stability/combo/time scoring
      combo.js              #   combo meter + sabotage charge
      sabotage.js           #   sabotage selection/effects (pure), seeded
      round.js              #   round/match state machine
      rng.js                #   mulberry32 seeded RNG
    physics/                # cannon-es world, fry bodies, collapse detection
    render/                 # toon material, outline pass, scene, fry mesh, tray, stage
    entities/               # Fry, Tower, Player
    net/                    # socket.io client wrapper + message handlers
    ui/                     # HUD, menu/lobby, results
    audio/                  # AudioManager (sfx/bgm, persisted volume)
  assets/                   # models/textures/audio (CC0; documented)
```

**Server** — extend the existing socket.io server:
```
server/src/games/frytower/FryTowerGameSession.ts   # extends GameSessionBase
server/src/network/MessageTypes.ts                 # + fry-tower message types
```

**Hub integration** — add a 5th card in `app/page.tsx` and a route following the existing
per-game pattern (verified against an existing game during planning). Game title shown as
"Fryffel Tower" with a Korean subtitle, matching the hub's mixed-naming style.

**Determinism/RNG:** outcome-affecting randomness (sabotage rolls, bot decisions) uses a
seeded `mulberry32` so logic unit tests and e2e are deterministic; only cosmetic FX may use
`Math.random`.

---

## 10. Testing Strategy (existing gates)

- **Unit (Vitest/jsdom)** over `src/logic/`: scoring, combo/charge, sabotage selection
  (seeded), round/match state machine.
- **Server unit:** `FryTowerGameSession` — join, fry-placed handling, round-end adjudication,
  scoring, plausibility checks.
- **e2e (Playwright):** canvas mounts with 0 console errors; a solo round runs to completion;
  a sabotage effect applies; (Phase 2+) two simulated clients see each other's height update.
- Lint + type-check green, consistent with the repo's existing CI gates.

---

## 11. Phased Roadmap

Each phase produces working, testable software on its own → branch → gates
(unit/lint/type-check) → play-verify → merge to `main` → Vercel auto-deploy.

### Phase 1 — Solo core (validate the fun)
- Aim & place physics (cannon-es), cartoon/low-poly render, fast-food stage.
- Timer + height + score + combo, juice (wobble/collapse/dust/shake), HUD, restart.
- Ships to the hub as a **solo** game (5th card).
- **Acceptance:** a player can stack fries with physics, see height/score/combo, finish a
  timed round, and restart; 0 console errors; unit + e2e green.

### Phase 2 — Real-time multiplayer
- `FryTowerGameSession` + message types; lobby/room reuse; 2–4 players.
- Height sync, best-of rounds, results screen, reconnect handling.
- **Acceptance:** 2+ clients in a room see each other's height live, a round resolves with
  correct standings, and a disconnect is scored at last height; server unit + e2e green.

### Phase 3 — Sabotage, bots, audio, polish
- Sabotage items + combo charge; AI bots to fill rooms; SFX/BGM; leaderboard;
  accessibility (colorblind-safe, reduced-motion); final hub card art.
- **Acceptance:** sabotage fires and affects only the target; bots play a credible round;
  audio + accessibility options persist; full gates green; live play-verified.

---

## 12. Open Items / Future
- Final name (Fryffel Tower vs alternatives).
- Leaderboard backend (simple score API) — Phase 3 or later.
- Additional fry types (curly/waffle) as cosmetic/physics variants — future.
- Spectator mode — future.
