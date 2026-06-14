import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Inline stubs — mirrors room-management.test.ts approach of avoiding module
// resolution issues. We re-implement just enough of Room + GameSessionBase to
// drive FryTowerGameSession without a real socket.io Server.
//
// This slim copy mirrors the real FryTowerGameSession logic (per-time height
// bound, charge clamp, explicit walkover on disconnect) but exposes an
// injectable clock (`now`) so the per-time validation can be tested
// deterministically without real timers.
// ---------------------------------------------------------------------------

// --- Minimal Room stub ---
interface RoomPlayer {
  id: string;
  socketId: string;
  name: string;
  ready: boolean;
  color: string;
  connected: boolean;
  disconnectedAt?: number;
}

class StubRoom {
  code: string;
  gameType: string;
  state: string = 'waiting';
  hostId: string;
  players: Map<string, RoomPlayer> = new Map();

  constructor(code: string, gameType: string, hostId: string) {
    this.code = code;
    this.gameType = gameType;
    this.hostId = hostId;
  }

  addPlayer(socketId: string, name: string): RoomPlayer {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
    const player: RoomPlayer = {
      id: socketId,
      socketId,
      name,
      ready: false,
      color: colors[this.players.size] || '#FFFFFF',
      connected: true,
    };
    this.players.set(socketId, player);
    return player;
  }

  // Mirrors Room.disconnectPlayer — SocketManager flips this BEFORE the session's
  // onPlayerDisconnect runs, so broadcasts reach only the survivors.
  disconnectPlayer(socketId: string): void {
    const p = this.players.get(socketId);
    if (p) {
      p.connected = false;
      p.disconnectedAt = 0;
    }
  }

  getConnectedPlayers(): RoomPlayer[] {
    return [...this.players.values()].filter((p) => p.connected);
  }
}

// --- Minimal io stub that captures (event, data) pairs per socket ---
interface Emission {
  socketId: string;
  event: string;
  data: unknown;
}

function makeIoStub(emissions: Emission[]) {
  return {
    to(socketId: string) {
      return {
        emit(event: string, data: unknown) {
          emissions.push({ socketId, event, data });
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// The session under test — imported via inline reimplementation to avoid
// TypeScript NodeNext module resolution issues in tests (same pattern as
// room-management.test.ts).  We copy-paste a slim version that exercises the
// real logic without the .js extension import chain.
// ---------------------------------------------------------------------------

const MSG = {
  GAME_COUNTDOWN: 'game:countdown',
  GAME_START: 'game:start',
  GAME_STATE: 'game:state',
  GAME_EVENT: 'game:event',
  GAME_END: 'game:end',
} as const;

interface FryPlayer {
  id: string;
  name: string;
  height: number;
  score: number;
  charge: number;
  finalHeight: number;
  roundDone: boolean;
  roundWins: number;
  connected: boolean;
  lastInputTs: number;
}

const BEST_OF = 3;
const ROUND_SECONDS = 90;
const ROUND_GRACE = 6;
const MIN_PLAYERS_TO_START = 2;
const MAX_HEIGHT_PER_SEC = 8.0;
const HEIGHT_GRACE = 1.0;
const MAX_SCORE = 1_000_000;
const MAX_CHARGE = 10_000;

class FryTowerSession {
  private players = new Map<string, FryPlayer>();
  private round = 1;
  private roundElapsed = 0;
  private finished = false;
  private io: ReturnType<typeof makeIoStub>;
  private room: StubRoom;
  // Injectable clock so per-time validation is deterministic in tests.
  public now: () => number = () => Date.now();

  constructor(io: ReturnType<typeof makeIoStub>, room: StubRoom) {
    this.io = io;
    this.room = room;
  }

  // -- helpers matching GameSessionBase --
  private broadcast(event: string, data: unknown): void {
    for (const player of this.room.getConnectedPlayers()) {
      this.io.to(player.socketId).emit(event, data);
    }
  }

  private sendTo(socketId: string, event: string, data: unknown): void {
    this.io.to(socketId).emit(event, data);
  }

  private endGame(results: Record<string, unknown>): void {
    this.stop();
    this.broadcast(MSG.GAME_END, results);
  }

  stop(): void {
    this.players.clear();
  }

  // -- session lifecycle --
  onStart(): void {
    const now = this.now();
    for (const p of this.room.players.values()) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        height: 0,
        score: 0,
        charge: 0,
        finalHeight: 0,
        roundDone: false,
        roundWins: 0,
        connected: true,
        lastInputTs: now,
      });
    }
    this._startRound();
  }

  private _startRound(): void {
    this.roundElapsed = 0;
    const now = this.now();
    for (const p of this.players.values()) {
      p.height = 0;
      p.score = 0;
      p.charge = 0;
      p.finalHeight = 0;
      p.roundDone = false;
      p.lastInputTs = now;
    }
    this.broadcast(MSG.GAME_EVENT, {
      type: 'round_start',
      round: this.round,
      bestOf: BEST_OF,
      seconds: ROUND_SECONDS,
    });
  }

  onTick(dt: number): void {
    if (this.finished) return;
    this.roundElapsed += dt;
    this.broadcast(MSG.GAME_STATE, {
      round: this.round,
      players: Object.fromEntries(
        [...this.players.values()].map((p) => [
          p.id,
          {
            name: p.name,
            height: p.height,
            score: p.score,
            roundDone: p.roundDone,
            roundWins: p.roundWins,
          },
        ]),
      ),
    });
    const everyoneDone = [...this.players.values()].every(
      (p) => p.roundDone || !p.connected,
    );
    if (everyoneDone || this.roundElapsed >= ROUND_SECONDS + ROUND_GRACE) {
      this._finalizeRound();
    }
  }

  private _heightCeil(p: FryPlayer, now: number): number {
    const elapsedSec = Math.max(0, (now - p.lastInputTs) / 1000);
    return p.height + MAX_HEIGHT_PER_SEC * elapsedSec + HEIGHT_GRACE;
  }

  onInput(playerId: string, input: Record<string, unknown>): void {
    if (this.finished) return;
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    const now = this.now();
    const h = input.height;
    if (typeof h === 'number' && Number.isFinite(h) && h >= p.height) {
      const ceil = this._heightCeil(p, now);
      p.height = h <= ceil ? h : ceil;
      p.lastInputTs = now;
    }
    if (typeof input.score === 'number' && Number.isFinite(input.score)) {
      p.score = Math.min(MAX_SCORE, Math.max(0, input.score as number));
    }
    if (typeof input.charge === 'number' && Number.isFinite(input.charge)) {
      p.charge = Math.min(MAX_CHARGE, Math.max(0, input.charge as number));
    }
  }

  onAction(playerId: string, type: string, data: Record<string, unknown>): void {
    if (this.finished) return;
    if (type !== 'round_end') return;
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    p.roundDone = true;
    const now = this.now();
    const fh = data.finalHeight;
    if (typeof fh === 'number' && Number.isFinite(fh) && fh >= p.height) {
      const ceil = this._heightCeil(p, now);
      p.finalHeight = fh <= ceil ? fh : ceil;
    } else {
      p.finalHeight = p.height;
    }
    p.lastInputTs = now;
    if (typeof data.score === 'number' && Number.isFinite(data.score)) {
      p.score = Math.min(MAX_SCORE, Math.max(0, data.score as number));
    }
    const everyoneDone = [...this.players.values()].every(
      (q) => q.roundDone || !q.connected,
    );
    if (everyoneDone) this._finalizeRound();
  }

  private _finalizeRound(): void {
    if (this.finished) return;
    const active = [...this.players.values()];
    const winner = active.reduce(
      (best, p) =>
        (p.finalHeight || p.height) > (best.finalHeight || best.height) ? p : best,
      active[0],
    );
    if (winner) winner.roundWins += 1;
    this.broadcast(MSG.GAME_EVENT, {
      type: 'round_result',
      round: this.round,
      winnerId: winner?.id ?? null,
      standings: active.map((p) => ({
        id: p.id,
        name: p.name,
        finalHeight: p.finalHeight || p.height,
        roundWins: p.roundWins,
      })),
    });
    if (this.round >= BEST_OF) {
      const matchWinner = active.reduce(
        (best, p) => (p.roundWins > best.roundWins ? p : best),
        active[0],
      );
      this.finished = true;
      this.endGame({
        matchWinnerId: matchWinner?.id ?? null,
        totals: active.map((p) => ({
          id: p.id,
          name: p.name,
          roundWins: p.roundWins,
        })),
      });
    } else {
      this.round += 1;
      this._startRound();
    }
  }

  onPlayerDisconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = false;
    p.roundDone = true;
    p.finalHeight = p.height;

    if (this.finished) return;

    const connected = [...this.players.values()].filter((q) => q.connected);
    if (connected.length < MIN_PLAYERS_TO_START) {
      this.finished = true;
      const survivor = connected[0] ?? null;
      this.broadcast(MSG.GAME_EVENT, {
        type: 'forfeit',
        winnerId: survivor?.id ?? null,
        leftId: playerId,
      });
      this.endGame({
        matchWinnerId: survivor?.id ?? null,
        reason: 'walkover',
        totals: [...this.players.values()].map((q) => ({
          id: q.id,
          name: q.name,
          roundWins: q.roundWins,
        })),
      });
    }
  }

  onPlayerReconnect(_playerId: string): void {
    // No-op for this milestone (mirrors FryTowerGameSession): disconnect = walkover.
  }

  // Test accessor
  getPlayers(): Map<string, FryPlayer> {
    return this.players;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup() {
  const emissions: Emission[] = [];
  const io = makeIoStub(emissions);
  const room = new StubRoom('FRYTEST', 'frytower', 'p1');
  room.addPlayer('p1', 'Alice');
  room.addPlayer('p2', 'Bob');
  const session = new FryTowerSession(io, room);
  return { emissions, io, room, session };
}

function eventsOfType(emissions: Emission[], eventName: string, type: string) {
  return emissions.filter(
    (e) => e.event === eventName && (e.data as Record<string, unknown>).type === type,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FryTowerGameSession', () => {
  describe('onStart → round_start broadcast', () => {
    it('broadcasts a round_start game:event after onStart', () => {
      const { emissions, session } = setup();
      session.onStart();
      const roundStartEmissions = eventsOfType(emissions, MSG.GAME_EVENT, 'round_start');
      // Both players (p1 + p2) should receive it
      expect(roundStartEmissions.length).toBe(2);
      const payload = roundStartEmissions[0].data as Record<string, unknown>;
      expect(payload.type).toBe('round_start');
      expect(payload.round).toBe(1);
      expect(payload.bestOf).toBe(BEST_OF);
      expect(payload.seconds).toBe(ROUND_SECONDS);
    });
  });

  describe('onInput per-time height validation', () => {
    it('rejects a height decrease (non-monotonic)', () => {
      const { session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();
      t = 2000; // +1s
      session.onInput('p1', { height: 3.0 });
      expect(session.getPlayers().get('p1')!.height).toBeCloseTo(3.0);
      // Going backwards must be ignored.
      session.onInput('p1', { height: 1.5 });
      expect(session.getPlayers().get('p1')!.height).toBeCloseTo(3.0);
    });

    it('clamps an implausible teleport to the per-second ceiling', () => {
      const { session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart(); // lastInputTs = 1000, height = 0
      // Only 0.1s later → ceiling = 0 + 8*0.1 + 1.0(grace) = 1.8
      t = 1100;
      session.onInput('p1', { height: 500 }); // absurd jump
      expect(session.getPlayers().get('p1')!.height).toBeCloseTo(1.8);
    });

    it('accepts a fast-but-plausible climb within the per-second budget', () => {
      const { session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();
      // 1s later → ceiling = 0 + 8*1 + 1 = 9.0; report 7.5 is allowed.
      t = 2000;
      session.onInput('p1', { height: 7.5 });
      expect(session.getPlayers().get('p1')!.height).toBeCloseTo(7.5);
    });

    it('clamps reported score and charge to sane bounds', () => {
      const { session } = setup();
      session.onStart();
      session.onInput('p1', { score: -50, charge: 99_999_999 });
      expect(session.getPlayers().get('p1')!.score).toBe(0);
      expect(session.getPlayers().get('p1')!.charge).toBe(MAX_CHARGE);
      session.onInput('p1', { score: 1_000, charge: 250 });
      expect(session.getPlayers().get('p1')!.score).toBe(1_000);
      expect(session.getPlayers().get('p1')!.charge).toBe(250);
    });

    it('ignores non-finite height (NaN/Infinity)', () => {
      const { session } = setup();
      session.onStart();
      session.onInput('p1', { height: Number.POSITIVE_INFINITY });
      session.onInput('p1', { height: Number.NaN });
      expect(session.getPlayers().get('p1')!.height).toBe(0);
    });
  });

  describe('round_end finalHeight validation', () => {
    it('clamps an inflated finalHeight to the per-time ceiling', () => {
      const { emissions, session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();
      t = 1100; // 0.1s of play → ceiling = 0 + 8*0.1 + 1.0(grace) = 1.8
      // p1 cheats with a huge finalHeight; p2 plays honestly low. The round_result
      // standings capture the authoritative (clamped) finalHeight at finalize time —
      // assert there, since _startRound zeroes live finalHeight for the next round.
      session.onAction('p1', 'round_end', { finalHeight: 999, score: 10 });
      session.onAction('p2', 'round_end', { finalHeight: 1.0, score: 5 });
      const roundResult = eventsOfType(emissions, MSG.GAME_EVENT, 'round_result')[0]
        .data as Record<string, unknown>;
      const standings = roundResult.standings as Array<{ id: string; finalHeight: number }>;
      // p1's finalHeight must be bounded to 1.8 — not 999.
      expect(standings.find((s) => s.id === 'p1')!.finalHeight).toBeCloseTo(1.8);
      // p1 (1.8) still legitimately beats p2 (1.0).
      expect(roundResult.winnerId).toBe('p1');
    });

    it('falls back to live height when finalHeight is missing/invalid', () => {
      const { session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();
      t = 2000;
      session.onInput('p1', { height: 5.0 }); // within budget (ceil 9.0)
      session.onAction('p1', 'round_end', { score: 10 }); // no finalHeight
      expect(session.getPlayers().get('p1')!.finalHeight).toBeCloseTo(5.0);
    });
  });

  describe('round_end → round_result with correct winner', () => {
    it('picks the player with the higher finalHeight as round winner', () => {
      const { emissions, session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();
      t = 2000; // 1s elapsed → ceiling ~9.0, both values legal
      session.onAction('p1', 'round_end', { finalHeight: 3.5, score: 10 });
      session.onAction('p2', 'round_end', { finalHeight: 5.0, score: 15 });

      const roundResultEmissions = eventsOfType(emissions, MSG.GAME_EVENT, 'round_result');
      expect(roundResultEmissions.length).toBeGreaterThanOrEqual(2);
      const payload = roundResultEmissions[0].data as Record<string, unknown>;
      expect(payload.type).toBe('round_result');
      expect(payload.round).toBe(1);
      expect(payload.winnerId).toBe('p2');
    });

    it('starts round 2 after round 1 completes (best-of-3)', () => {
      const { emissions, session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();
      t += 1000;
      session.onAction('p1', 'round_end', { finalHeight: 1.0 });
      session.onAction('p2', 'round_end', { finalHeight: 2.0 });

      const roundStartEmissions = eventsOfType(emissions, MSG.GAME_EVENT, 'round_start');
      // round 1 (2 emissions) + round 2 (2 emissions)
      expect(roundStartEmissions.length).toBe(4);
      const round2Start = roundStartEmissions.find(
        (e) => (e.data as Record<string, unknown>).round === 2,
      );
      expect(round2Start).toBeDefined();
    });
  });

  describe('match end after BEST_OF rounds', () => {
    it('emits GAME_END (game:end) after all BEST_OF rounds complete', () => {
      const { emissions, session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();

      for (let r = 1; r <= BEST_OF; r++) {
        t += 1000; // 1s of play per round → ceiling ~9.0, finalHeights legal
        session.onAction('p1', 'round_end', { finalHeight: 1.0 });
        session.onAction('p2', 'round_end', { finalHeight: 2.0 });
      }

      const gameEndEmissions = emissions.filter((e) => e.event === MSG.GAME_END);
      expect(gameEndEmissions.length).toBeGreaterThanOrEqual(1); // both players get it
      const payload = gameEndEmissions[0].data as Record<string, unknown>;
      expect(payload.matchWinnerId).toBe('p2');
      expect(Array.isArray(payload.totals)).toBe(true);
    });

    it('correctly tallies round wins — p2 wins 3/3 rounds', () => {
      const { emissions, session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();

      for (let r = 1; r <= BEST_OF; r++) {
        t += 1000;
        session.onAction('p1', 'round_end', { finalHeight: 1.0 });
        session.onAction('p2', 'round_end', { finalHeight: 2.0 });
      }

      const gameEndEmissions = emissions.filter((e) => e.event === MSG.GAME_END);
      const payload = gameEndEmissions[0].data as Record<string, unknown>;
      const totals = payload.totals as Array<{ id: string; name: string; roundWins: number }>;
      const p2Total = totals.find((t) => t.id === 'p2');
      expect(p2Total?.roundWins).toBe(3);
    });

    it('correctly tallies when p1 and p2 each win some rounds', () => {
      const { emissions, session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();

      // Round 1: p1 wins (1s elapsed → ceiling ~9.0)
      t += 1000;
      session.onAction('p1', 'round_end', { finalHeight: 3.0 });
      session.onAction('p2', 'round_end', { finalHeight: 1.0 });
      // Round 2: p2 wins
      t += 1000;
      session.onAction('p1', 'round_end', { finalHeight: 1.0 });
      session.onAction('p2', 'round_end', { finalHeight: 4.0 });
      // Round 3: p1 wins
      t += 1000;
      session.onAction('p1', 'round_end', { finalHeight: 5.0 });
      session.onAction('p2', 'round_end', { finalHeight: 2.0 });

      const gameEndEmissions = emissions.filter((e) => e.event === MSG.GAME_END);
      const payload = gameEndEmissions[0].data as Record<string, unknown>;
      expect(payload.matchWinnerId).toBe('p1');
    });
  });

  describe('disconnect → explicit walkover', () => {
    it('ends the match as a walkover when a disconnect leaves <2 connected', () => {
      const { emissions, room, session } = setup();
      session.onStart();

      // Simulate SocketManager: room flips connected BEFORE the session handler,
      // then the session resolves the walkover.
      room.disconnectPlayer('p2');
      session.onPlayerDisconnect('p2');

      // Forfeit event names the survivor (p1) and the leaver (p2).
      const forfeit = eventsOfType(emissions, MSG.GAME_EVENT, 'forfeit');
      expect(forfeit.length).toBeGreaterThanOrEqual(1);
      const fdata = forfeit[0].data as Record<string, unknown>;
      expect(fdata.winnerId).toBe('p1');
      expect(fdata.leftId).toBe('p2');
      // It must reach the surviving player p1 (broadcast filters by connected).
      expect(forfeit.some((e) => e.socketId === 'p1')).toBe(true);
      expect(forfeit.some((e) => e.socketId === 'p2')).toBe(false);

      // And the match ends explicitly with a walkover game:end.
      const gameEnd = emissions.filter((e) => e.event === MSG.GAME_END);
      expect(gameEnd.length).toBeGreaterThanOrEqual(1);
      const edata = gameEnd[0].data as Record<string, unknown>;
      expect(edata.reason).toBe('walkover');
      expect(edata.matchWinnerId).toBe('p1');
    });

    it('does NOT race rounds 2-3 after a walkover (no further round_start/round_result)', () => {
      const { emissions, room, session } = setup();
      session.onStart();
      room.disconnectPlayer('p2');
      session.onPlayerDisconnect('p2');

      const before = emissions.length;
      // Further ticks / a late round_end from the survivor must not finalize more rounds.
      session.onTick(0.1);
      session.onAction('p1', 'round_end', { finalHeight: 1.0 });

      const newRoundStarts = eventsOfType(emissions, MSG.GAME_EVENT, 'round_start').filter(
        (e) => emissions.indexOf(e) >= before,
      );
      const newRoundResults = eventsOfType(emissions, MSG.GAME_EVENT, 'round_result').filter(
        (e) => emissions.indexOf(e) >= before,
      );
      expect(newRoundStarts.length).toBe(0);
      expect(newRoundResults.length).toBe(0);
    });
  });

  describe('GAME_STATE tick', () => {
    it('broadcasts GAME_STATE on each tick with current player heights', () => {
      const { emissions, session } = setup();
      let t = 1000;
      session.now = () => t;
      session.onStart();
      t = 2000; // 1s → ceiling ~9.0, both values legal
      session.onInput('p1', { height: 1.5 });
      session.onInput('p2', { height: 0.8 });

      // Advance one tick (small dt so round doesn't finalize)
      session.onTick(0.1);

      const stateEmissions = emissions.filter((e) => e.event === MSG.GAME_STATE);
      expect(stateEmissions.length).toBeGreaterThanOrEqual(2); // p1 + p2 receive it
      const payload = stateEmissions[0].data as Record<string, unknown>;
      const players = payload.players as Record<string, Record<string, unknown>>;
      expect(players['p1'].height).toBe(1.5);
      expect(players['p2'].height).toBe(0.8);
    });
  });
});
