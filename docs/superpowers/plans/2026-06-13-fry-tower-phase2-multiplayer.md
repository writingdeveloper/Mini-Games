# Fryffel Tower — Phase 2 (Real-time Multiplayer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add real-time competitive multiplayer (2–4 players, best-of rounds) to Fryffel Tower by reusing the existing socket.io server + shared lobby/client, keeping each player's tower client-authoritative.

**Architecture:** Each client runs its OWN solo physics Session per round and reports its height/score to the server at 10 Hz (`GameClient.sendInput`). The server (`FryTowerGameSession extends GameSessionBase`) relays everyone's height to the room (`GAME_STATE`), runs the best-of round/match state machine, and adjudicates round/match winners by reported height (light validation). The shared `LobbyUI` handles connect/room/ready/countdown; the game implements `onSinglePlayer` (→ solo) and `onGameStart` (→ multiplayer). Sabotage/bots/audio are Phase 3.

**Tech Stack:** existing `server/` (TypeScript socket.io), shared `public/shared/` client (`GameClient`, `LobbyUI`), the Phase 1 build-free Three.js game at `public/fry-tower-game/`.

**External dependency (user-operated):** end-to-end multiplayer requires the self-hosted game server (`NEXT_PUBLIC_GAME_SERVER_URL`, currently `minigames-api.devmanage.duckdns.org`) to be running and **redeployed with the new server code** (`server/DEPLOY.md`, docker-compose). The agent cannot deploy to that host; this plan delivers the code + a server unit test, and final live play-verification happens once the user redeploys the server.

**Naming:** game type string = `'frytower'`; client folder/route = `fry-tower-game` (Phase 1 paths). Min 2 / max 4 players (already enforced by `Room`/`config`).

---

## File Structure (Phase 2)

**Server — modify:**
- `server/src/network/MessageTypes.ts` — add `'frytower'` to `GameType`
- `server/src/config.ts` — add `frytower` to `TICK_RATES`
- `server/src/network/SocketManager.ts` — import + `case 'frytower'` in `startGameSession`; widen the gameType cast (line ~81)

**Server — create:**
- `server/src/games/frytower/FryTowerGameSession.ts` — the session
- `server/__tests__/...` test → use the repo test location: `__tests__/integration/socket/frytower-session.test.ts` (mirror existing `__tests__/integration/socket/room-management.test.ts`)

**Client — create:**
- `public/fry-tower-game/src/logic/standings.js` — pure round/match standings (unit-tested)
- `public/fry-tower-game/src/net/NetClient.js` — thin wrapper over shared `GameClient` (throttled state send + typed event subscription)
- `public/fry-tower-game/src/play/Multiplayer.js` — multiplayer round flow (server-driven rounds → local Session, report loop, opponents HUD, result overlays)
- `public/fry-tower-game/src/ui/Opponents.js` — opponent height bars + round/match result overlays

**Client — modify:**
- `public/fry-tower-game/src/main.js` — refactor to `startSolo()` + URL-param bootstrap (`?mode=multi&server=` → load socket.io-client, `GameClient`, `LobbyUI`)
- `public/fry-tower-game/src/play/Session.js` — add `dispose()` (remove meshes + stop) so rounds can rebuild without a page reload
- `public/fry-tower-game/index.html` — add opponents HUD container + result overlay elements
- `app/fry-tower-game/page.tsx` — single/multi mode select (mirror `app/escape-game/page.tsx`)

**Tests:**
- `__tests__/unit/fry-tower-game/standings.test.ts`
- `__tests__/integration/socket/frytower-session.test.ts`
- `e2e/fry-tower-game.spec.ts` — extend (solo still works; multi mode mounts the lobby)

---

## Task 1: Server — register `frytower` + FryTowerGameSession + server test

**Files:** modify `server/src/network/MessageTypes.ts`, `server/src/config.ts`, `server/src/network/SocketManager.ts`; create `server/src/games/frytower/FryTowerGameSession.ts`, `__tests__/integration/socket/frytower-session.test.ts`

> First READ the current `server/src/games/GameSessionBase.ts`, `server/src/games/escape/EscapeGameSession.ts`, `server/src/lobby/Room.ts`, and `__tests__/integration/socket/room-management.test.ts` to match exact signatures/imports/test style. The session below follows the GameSessionBase contract (constructor `(io, room, tickRate)`; implement `onStart/onTick/onStop/onInput/onAction/onPlayerDisconnect/onPlayerReconnect`; helpers `broadcast/sendTo/endGame`).

- [ ] **Step 1: Add `'frytower'` to the GameType union** in `server/src/network/MessageTypes.ts`

```ts
export type GameType = 'escape' | 'flight' | 'survival' | 'frytower';
```

- [ ] **Step 2: Add tick rate** in `server/src/config.ts` `TICK_RATES`

```ts
  frytower: 10,
```

- [ ] **Step 3: Create `server/src/games/frytower/FryTowerGameSession.ts`**

```ts
import type { Server } from 'socket.io';
import type { Room } from '../../lobby/Room.js';
import { GameSessionBase } from '../GameSessionBase.js';
import { MSG } from '../../network/MessageTypes.js';

interface FryPlayer {
  id: string;
  name: string;
  height: number;      // live reported height this round
  score: number;       // live reported score this round
  finalHeight: number; // captured at round_end
  roundDone: boolean;
  roundWins: number;
  connected: boolean;
}

const BEST_OF = 3;
const ROUND_SECONDS = 90;        // matches client CONFIG.round.duration
const ROUND_GRACE = 6;           // server waits this long past ROUND_SECONDS for stragglers
const MAX_HEIGHT_DELTA = 2.0;    // per-input plausibility cap (units/100ms)

export class FryTowerGameSession extends GameSessionBase {
  private players = new Map<string, FryPlayer>();
  private round = 1;
  private roundElapsed = 0;

  constructor(io: Server, room: Room) {
    super(io, room, 10);
  }

  protected onStart(): void {
    for (const p of this.room.players.values()) {
      this.players.set(p.id, {
        id: p.id, name: p.name, height: 0, score: 0,
        finalHeight: 0, roundDone: false, roundWins: 0, connected: true,
      });
    }
    this._startRound();
  }

  private _startRound(): void {
    this.roundElapsed = 0;
    for (const p of this.players.values()) { p.height = 0; p.score = 0; p.finalHeight = 0; p.roundDone = false; }
    this.broadcast(MSG.GAME_EVENT, { type: 'round_start', round: this.round, bestOf: BEST_OF, seconds: ROUND_SECONDS });
  }

  protected onTick(dt: number): void {
    this.roundElapsed += dt;
    this.broadcast(MSG.GAME_STATE, {
      round: this.round,
      players: Object.fromEntries([...this.players.values()].map((p) => [p.id, {
        name: p.name, height: p.height, score: p.score, roundDone: p.roundDone, roundWins: p.roundWins,
      }])),
    });
    const everyoneDone = [...this.players.values()].every((p) => p.roundDone || !p.connected);
    if (everyoneDone || this.roundElapsed >= ROUND_SECONDS + ROUND_GRACE) this._finalizeRound();
  }

  protected onInput(playerId: string, input: Record<string, unknown>): void {
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    const h = input.height;
    if (typeof h === 'number' && h >= p.height && h - p.height < MAX_HEIGHT_DELTA) p.height = h;
    if (typeof input.score === 'number') p.score = input.score as number;
  }

  protected onAction(playerId: string, type: string, data: Record<string, unknown>): void {
    if (type !== 'round_end') return;
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    p.roundDone = true;
    p.finalHeight = typeof data.finalHeight === 'number' ? (data.finalHeight as number) : p.height;
    if (typeof data.score === 'number') p.score = data.score as number;
  }

  private _finalizeRound(): void {
    const active = [...this.players.values()];
    const winner = active.reduce((best, p) =>
      (p.finalHeight || p.height) > (best.finalHeight || best.height) ? p : best, active[0]);
    if (winner) winner.roundWins += 1;
    this.broadcast(MSG.GAME_EVENT, {
      type: 'round_result', round: this.round, winnerId: winner?.id ?? null,
      standings: active.map((p) => ({ id: p.id, name: p.name, finalHeight: p.finalHeight || p.height, roundWins: p.roundWins })),
    });
    if (this.round >= BEST_OF) {
      const matchWinner = active.reduce((best, p) => (p.roundWins > best.roundWins ? p : best), active[0]);
      this.endGame({
        matchWinnerId: matchWinner?.id ?? null,
        totals: active.map((p) => ({ id: p.id, name: p.name, roundWins: p.roundWins })),
      });
    } else {
      this.round += 1;
      this._startRound();
    }
  }

  protected onPlayerDisconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) { p.connected = false; p.roundDone = true; p.finalHeight = p.height; }
  }

  protected onPlayerReconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) { p.connected = true; this.sendTo(playerId, MSG.GAME_STATE, { round: this.round, players: Object.fromEntries([...this.players.values()].map((q) => [q.id, { name: q.name, height: q.height, score: q.score, roundDone: q.roundDone, roundWins: q.roundWins }])) }); }
  }

  protected onStop(): void { this.players.clear(); }
}
```

- [ ] **Step 4: Register the session** in `server/src/network/SocketManager.ts`

Add the import near the other game-session imports:
```ts
import { FryTowerGameSession } from '../games/frytower/FryTowerGameSession.js';
```
Add a case in `startGameSession()`'s `switch` (before `default`):
```ts
      case 'frytower':
        session = new FryTowerGameSession(this.io, room);
        break;
```
Widen the gameType cast at line ~81 (wherever the union `'escape' | 'flight' | 'survival'` is cast) to include `'frytower'`. (Grep `'survival'` in SocketManager.ts and add `| 'frytower'` to that literal cast.)

- [ ] **Step 5: Write the server test** `__tests__/integration/socket/frytower-session.test.ts`

Mirror `room-management.test.ts`'s setup. Construct a `FryTowerGameSession` against a fake `io` (capture broadcasts) and a `Room` with 2 players. Assert:
- `onStart` broadcasts a `round_start` event.
- `onInput` clamps an implausible height jump (rejects `height` delta ≥ 2.0) and accepts a valid increase.
- two `round_end` actions → a `round_result` is broadcast with the higher-finalHeight player as `winnerId`.
- after `BEST_OF` rounds, a `GAME_END` is broadcast with a `matchWinnerId`.

(If a real socket.io `Server` is awkward to construct in the test, build a minimal stub: `{ to: () => ({ emit }) }` capturing emitted `(event, data)` — match however `GameSessionBase.broadcast` sends. Read `GameSessionBase.ts` first to mirror its emit path exactly.)

- [ ] **Step 6: Run server + repo gates**

Run: `npm test` (server tests run under the repo Vitest; confirm the new test passes and nothing regresses) and `npx tsc --noEmit` (the server has its own tsconfig — also run `npm --prefix server run build` or the server's type-check if present; check `server/package.json` scripts and run the type-check it defines).
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add server/src/network/MessageTypes.ts server/src/config.ts server/src/network/SocketManager.ts server/src/games/frytower __tests__/integration/socket/frytower-session.test.ts
git commit -m "feat(fry-tower): server FryTowerGameSession + frytower game type (Phase 2.1)"
```

---

## Task 2: Client pure logic — standings (TDD)

**Files:** create `public/fry-tower-game/src/logic/standings.js`, `__tests__/unit/fry-tower-game/standings.test.ts`

- [ ] **Step 1: Write the failing test** `__tests__/unit/fry-tower-game/standings.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { rankPlayers, matchLeader } from "../../../public/fry-tower-game/src/logic/standings.js";

const players = {
  a: { name: "A", height: 1.2, roundWins: 2 },
  b: { name: "B", height: 2.5, roundWins: 1 },
  c: { name: "C", height: 0.4, roundWins: 0 },
};

describe("standings", () => {
  it("ranks players by height descending (current round)", () => {
    const r = rankPlayers(players, "height");
    expect(r.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
  it("ranks by roundWins for the match leaderboard", () => {
    const r = rankPlayers(players, "roundWins");
    expect(r[0].id).toBe("a");
  });
  it("matchLeader returns the id with the most round wins", () => {
    expect(matchLeader(players)).toBe("a");
  });
  it("handles an empty map", () => {
    expect(rankPlayers({}, "height")).toEqual([]);
    expect(matchLeader({})).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run __tests__/unit/fry-tower-game/standings.test.ts` → FAIL (module missing).

- [ ] **Step 3: Create `public/fry-tower-game/src/logic/standings.js`**

```js
// Pure ranking helpers over a { id: { name, height, score, roundWins } } map.
export function rankPlayers(players, key = 'height') {
  return Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
}

export function matchLeader(players) {
  const ranked = rankPlayers(players, 'roundWins');
  return ranked.length ? ranked[0].id : null;
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run __tests__/unit/fry-tower-game/standings.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add public/fry-tower-game/src/logic/standings.js __tests__/unit/fry-tower-game/standings.test.ts
git commit -m "feat(fry-tower): pure standings/ranking logic (Phase 2.2)"
```

---

## Task 3: Client net wrapper + multiplayer bootstrap

**Files:** create `public/fry-tower-game/src/net/NetClient.js`; modify `public/fry-tower-game/src/main.js`

- [ ] **Step 1: Create `public/fry-tower-game/src/net/NetClient.js`**

```js
// Thin wrapper over the shared GameClient: throttled state reporting + typed subscriptions.
export class NetClient {
  constructor(gameClient) {
    this.client = gameClient;
    this.playerId = gameClient.playerId;
    this._reportTimer = null;
  }

  // Begin sending {height, score} at 10 Hz from a getter the caller supplies.
  startReporting(getState) {
    this.stopReporting();
    this._reportTimer = setInterval(() => {
      const s = getState();
      if (s) this.client.sendInput({ height: s.height, score: s.score });
    }, 100);
  }
  stopReporting() {
    if (this._reportTimer) { clearInterval(this._reportTimer); this._reportTimer = null; }
  }
  reportRoundEnd(finalHeight, score) {
    this.client.sendAction('round_end', { finalHeight, score });
  }

  onState(cb) { this.client.on('gameState', cb); }
  onEvent(cb) { this.client.on('gameEvent', cb); }   // round_start / round_result
  onEnd(cb) { this.client.on('gameEnd', cb); }       // match end
}
```

- [ ] **Step 2: Refactor `public/fry-tower-game/src/main.js`** to split solo wiring into `startSolo()` and add the multiplayer bootstrap

```js
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { Stage } from './render/Stage.js';
import { Session } from './play/Session.js';
import { HUD } from './ui/HUD.js';
import { Fx } from './render/Fx.js';

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
  const fx = new Fx(game.scene, game.camera);
  game.add(fx);

  // ---- Solo (existing behavior) ----
  function startSolo() {
    menu.classList.add('hidden');
    result.classList.add('hidden');
    hud.classList.remove('hidden');
    const session = new Session(game.scene, {
      fx,
      onEnd: ({ height, score }) => {
        resultDetail.textContent = `높이 ${height.toFixed(1)}m · 점수 ${score}`;
        result.classList.remove('hidden');
      },
    });
    game.add({ update: (dt) => session.update(dt, input) });
    game.add(new HUD(session));
    game.start();
    window.__fry = { get session() { return session; } };
  }

  startBtn.addEventListener('click', startSolo);
  restartBtn.addEventListener('click', () => location.reload());

  // ---- Multiplayer bootstrap (mirrors escape-game) ----
  const params = new URLSearchParams(location.search);
  const serverUrl = params.get('server');
  if (params.get('mode') === 'multi' && serverUrl) {
    menu.classList.add('hidden');
    bootstrapMultiplayer(serverUrl);
  }

  function bootstrapMultiplayer(url) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/shared/lobby/LobbyUI.css';
    document.head.appendChild(css);
    const sio = document.createElement('script');
    sio.src = url + '/socket.io/socket.io.js';
    sio.onload = async () => {
      const { GameClient } = await import('/shared/networking/GameClient.js');
      const { LobbyUI } = await import('/shared/lobby/LobbyUI.js');
      const { startMultiplayer } = await import('./play/Multiplayer.js');
      const client = new GameClient(url);
      const lobby = new LobbyUI(client, {
        gameType: 'frytower',
        gameName: 'FRYFFEL TOWER',
        onSinglePlayer: () => startSolo(),
        onGameStart: () => startMultiplayer({ game, input, fx, client }),
      });
      lobby.show();
    };
    sio.onerror = () => { console.error('[fry-tower] failed to load socket.io-client'); menu.classList.remove('hidden'); };
    document.head.appendChild(sio);
  }

  game.renderOnce();
  console.log('[fry-tower] ready');
}
```

- [ ] **Step 3: Verify solo still works (e2e)** — `npm run test:e2e -- fry-tower-game` → still 3 passed (the bootstrap only activates with `?mode=multi`).

- [ ] **Step 4: Commit**

```bash
git add public/fry-tower-game/src/net/NetClient.js public/fry-tower-game/src/main.js
git commit -m "feat(fry-tower): net wrapper + multiplayer bootstrap (Phase 2.3)"
```

---

## Task 4: Multiplayer round flow + opponents HUD + Session.dispose

**Files:** create `public/fry-tower-game/src/play/Multiplayer.js`, `public/fry-tower-game/src/ui/Opponents.js`; modify `public/fry-tower-game/src/play/Session.js`, `public/fry-tower-game/index.html`

- [ ] **Step 1: Add `dispose()` to `public/fry-tower-game/src/play/Session.js`** so rounds rebuild without a reload

Add a method that removes all of the session's meshes from the scene and marks it stopped:
```js
  dispose() {
    if (this.active) { this.scene.remove(this.active.mesh); this.active = null; }
    for (const f of this.placed) this.scene.remove(f.mesh);
    this.placed = [];
    this.bodies = [];
    this._pendingSettle = [];
    this._disposed = true;
  }
```
And guard `update()` to no-op after dispose: at the top of `update(dt, input)` add `if (this._disposed) return;`.

- [ ] **Step 2: Create `public/fry-tower-game/src/ui/Opponents.js`** (opponent height bars + result overlays)

```js
import { rankPlayers, matchLeader } from '../logic/standings.js';

// Renders opponent height bars into #opponents and round/match overlays into #result.
export class Opponents {
  constructor(myId) {
    this.myId = myId;
    this.el = document.getElementById('opponents');
    this.result = document.getElementById('result');
    this.resultTitle = document.getElementById('result-title');
    this.resultDetail = document.getElementById('result-detail');
  }
  renderState(players) {
    if (!this.el) return;
    const others = rankPlayers(players, 'height').filter((p) => p.id !== this.myId);
    this.el.innerHTML = others.map((p) =>
      `<div class="opp"><span class="opp-name">${p.name ?? p.id.slice(0, 4)}</span>` +
      `<span class="opp-bar"><i style="height:${Math.min(100, (p.height || 0) * 20)}%"></i></span>` +
      `<span class="opp-h">${(p.height || 0).toFixed(1)}m · ${p.roundWins ?? 0}승</span></div>`
    ).join('');
  }
  showRoundResult(ev) {
    const win = ev.standings?.find((s) => s.id === ev.winnerId);
    this.resultTitle.textContent = `${ev.round}라운드 종료`;
    this.resultDetail.textContent = win ? `${win.name} 승리 (${win.finalHeight.toFixed(1)}m)` : '무승부';
    this.result.classList.remove('hidden');
  }
  showMatchEnd(data, players) {
    const id = data.matchWinnerId ?? matchLeader(players);
    const w = (data.totals || []).find((t) => t.id === id);
    this.resultTitle.textContent = '경기 종료!';
    this.resultDetail.textContent = w ? `우승: ${w.name} (${w.roundWins}승)` : '경기 종료';
    this.result.classList.remove('hidden');
  }
  hideResult() { this.result.classList.add('hidden'); }
}
```

- [ ] **Step 3: Create `public/fry-tower-game/src/play/Multiplayer.js`** (the round flow)

```js
import { Session } from './Session.js';
import { HUD } from '../ui/HUD.js';
import { NetClient } from '../net/NetClient.js';
import { Opponents } from '../ui/Opponents.js';

// Drives server-authoritative best-of rounds: each round runs a local Session,
// reports height/score at 10Hz, and reports round_end when the local round finishes.
export function startMultiplayer({ game, input, fx, client }) {
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('opponents')?.classList.remove('hidden');
  const net = new NetClient(client);
  const opponents = new Opponents(client.playerId);
  let session = null;
  let hud = null;
  let latestPlayers = {};

  function endRoundLocally() {
    if (!session) return;
    net.stopReporting();
    net.reportRoundEnd(session.height, session.score);
  }

  function startRound() {
    opponents.hideResult();
    if (session) session.dispose();
    session = new Session(game.scene, { fx, onEnd: () => endRoundLocally() });
    hud = hud || new HUD(session);
    hud.session = session;
    net.startReporting(() => ({ height: session.height, score: session.score }));
    window.__fry = { get session() { return session; } };
  }

  // One driver system for the whole match.
  game.add({ update: (dt) => { if (session) { session.update(dt, input); hud && hud.update(); } } });

  net.onState((data) => { latestPlayers = data.players || {}; opponents.renderState(latestPlayers); });
  net.onEvent((ev) => {
    if (ev.type === 'round_start') startRound();
    else if (ev.type === 'round_result') opponents.showRoundResult(ev);
  });
  net.onEnd((data) => { net.stopReporting(); opponents.showMatchEnd(data, latestPlayers); });

  game.start();
}
```

> Note: `HUD` reads `this.session` each frame; assigning `hud.session = session` between rounds repoints it. Confirm `HUD.update()` reads `this.session` (Phase 1 it does).

- [ ] **Step 4: Add HUD containers to `public/fry-tower-game/index.html`**

Add an opponents panel (hidden by default) after `#hud`, and ensure `#result` has `#result-title` (Phase 1 already has `result-title`/`result-detail`):
```html
  <div id="opponents" class="hidden"></div>
```
Add minimal CSS to `public/fry-tower-game/style.css`:
```css
#opponents { position: fixed; top: 14px; right: 14px; z-index: 4; display: flex; flex-direction: column; gap: 8px; }
#opponents .opp { background: rgba(255,246,223,0.92); border: 3px solid #2a1b08; border-radius: 10px; padding: 6px 10px; font-weight: 800; color: #2a1b08; display: flex; align-items: center; gap: 8px; box-shadow: 0 3px 0 #2a1b08; }
#opponents .opp-bar { width: 10px; height: 40px; background: #e9d8b0; border: 2px solid #2a1b08; border-radius: 4px; position: relative; overflow: hidden; }
#opponents .opp-bar i { position: absolute; bottom: 0; left: 0; right: 0; background: #f7b330; display: block; }
```

- [ ] **Step 5: e2e — multi mode mounts the lobby (no live server needed)**

Add to `e2e/fry-tower-game.spec.ts` a test that loads `/fry-tower-game/index.html?mode=multi&server=https://example.invalid` and asserts the lobby overlay appears (`.lobby-overlay` with the game name) — i.e., the bootstrap runs and shows `LobbyUI` even though the server is unreachable (socket.io script load may fail; if so, assert the menu re-appears via the `sio.onerror` path instead). Keep this resilient: assert EITHER `.lobby-overlay` is visible OR `#menu` is visible (bootstrap attempted), with 0 uncaught pageerrors. Solo tests remain unchanged and must still pass.

Run: `npm run test:e2e -- fry-tower-game` → all pass.

- [ ] **Step 6: Commit**

```bash
git add public/fry-tower-game/src/play/Multiplayer.js public/fry-tower-game/src/ui/Opponents.js public/fry-tower-game/src/play/Session.js public/fry-tower-game/index.html public/fry-tower-game/style.css e2e/fry-tower-game.spec.ts
git commit -m "feat(fry-tower): multiplayer round flow + opponents HUD + Session.dispose (Phase 2.4)"
```

---

## Task 5: Hub page mode-select + final gates

**Files:** modify `app/fry-tower-game/page.tsx`

- [ ] **Step 1: Rewrite `app/fry-tower-game/page.tsx`** to add single/multi selection (mirror `app/escape-game/page.tsx`)

Use the same `mode: 'select' | 'single' | 'multi'` pattern; `GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || ''`; `iframeSrc = mode==='multi' && GAME_SERVER_URL ? \`/fry-tower-game/index.html?mode=multi&server=${encodeURIComponent(GAME_SERVER_URL)}\` : '/fry-tower-game/index.html'`; the multiplayer button `disabled={!GAME_SERVER_URL}`; keep the "홈으로" link + a "모드 선택" back button (copy escape's JSX, swap title to "Fryffel Tower" / 🍟 and colors to amber→red). Keep `LoadingOverlay`.

- [ ] **Step 2: Run ALL gates**

- `npm test` (unit incl. standings + server frytower-session)
- `npm run lint`
- `npx tsc --noEmit`
- server type-check (per `server/package.json`)
- `npm run test:e2e -- fry-tower-game`
Expected: all green; solo unaffected.

- [ ] **Step 3: Commit**

```bash
git add app/fry-tower-game/page.tsx
git commit -m "feat(fry-tower): hub single/multi mode select (Phase 2.5)"
```

---

## Done criteria (Phase 2)

- Server compiles + a `FryTowerGameSession` unit test passes (join → round_start; input validation; round_result by height; match end after best-of).
- Client: `?mode=multi` mounts the shared lobby; choosing single still plays the Phase 1 solo game; a multiplayer match runs server-driven best-of rounds with live opponent height bars and round/match result overlays; rounds rebuild via `Session.dispose()` (no reload).
- Gates green (unit, lint, type-check, e2e); solo unregressed.
- **User step:** redeploy the game server (`server/DEPLOY.md`) with the new session, then live 2-client play-verify together. Merge to `main` → Vercel auto-deploys the client; the server runs on the self-hosted host.

After Phase 2 ships, Phase 3: sabotage items + AI bots + audio + leaderboard + mobile/touch controls + mobile-HUD layout + camera-follows-height (the deferred Phase 1 QA items).
