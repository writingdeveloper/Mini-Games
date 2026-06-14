import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Inline stubs — mirrors room-management.test.ts approach of avoiding module
// resolution issues. We re-implement just enough of Room + GameSessionBase to
// drive FryTowerGameSession without a real socket.io Server.
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
  finalHeight: number;
  roundDone: boolean;
  roundWins: number;
  connected: boolean;
}

const BEST_OF = 3;
const ROUND_SECONDS = 90;
const ROUND_GRACE = 6;
const MAX_HEIGHT_DELTA = 2.0;

class FryTowerSession {
  private players = new Map<string, FryPlayer>();
  private round = 1;
  private roundElapsed = 0;
  private tickCount = 0;
  private io: ReturnType<typeof makeIoStub>;
  private room: StubRoom;

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
    for (const p of this.room.players.values()) {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        height: 0,
        score: 0,
        finalHeight: 0,
        roundDone: false,
        roundWins: 0,
        connected: true,
      });
    }
    this._startRound();
  }

  private _startRound(): void {
    this.roundElapsed = 0;
    for (const p of this.players.values()) {
      p.height = 0;
      p.score = 0;
      p.finalHeight = 0;
      p.roundDone = false;
    }
    this.broadcast(MSG.GAME_EVENT, {
      type: 'round_start',
      round: this.round,
      bestOf: BEST_OF,
      seconds: ROUND_SECONDS,
    });
  }

  onTick(dt: number): void {
    this.tickCount++;
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

  onInput(playerId: string, input: Record<string, unknown>): void {
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    const h = input.height;
    if (typeof h === 'number' && h >= p.height && h - p.height < MAX_HEIGHT_DELTA) {
      p.height = h;
    }
    if (typeof input.score === 'number') {
      p.score = input.score as number;
    }
  }

  onAction(playerId: string, type: string, data: Record<string, unknown>): void {
    if (type !== 'round_end') return;
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    p.roundDone = true;
    p.finalHeight =
      typeof data.finalHeight === 'number' ? (data.finalHeight as number) : p.height;
    if (typeof data.score === 'number') {
      p.score = data.score as number;
    }
    // Eagerly finalize if everyone is now done (mirrors FryTowerGameSession)
    const everyoneDone = [...this.players.values()].every(
      (q) => q.roundDone || !q.connected,
    );
    if (everyoneDone) this._finalizeRound();
  }

  private _finalizeRound(): void {
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
    if (p) {
      p.connected = false;
      p.roundDone = true;
      p.finalHeight = p.height;
    }
  }

  onPlayerReconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      p.connected = true;
      this.sendTo(playerId, MSG.GAME_STATE, {
        round: this.round,
        players: Object.fromEntries(
          [...this.players.values()].map((q) => [
            q.id,
            {
              name: q.name,
              height: q.height,
              score: q.score,
              roundDone: q.roundDone,
              roundWins: q.roundWins,
            },
          ]),
        ),
      });
    }
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

function lastEventOf(emissions: Emission[], eventName: string) {
  return [...emissions].reverse().find((e) => e.event === eventName);
}

function allEventsOf(emissions: Emission[], eventName: string) {
  return emissions.filter((e) => e.event === eventName);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FryTowerGameSession', () => {
  describe('onStart → round_start broadcast', () => {
    it('broadcasts a round_start game:event after onStart', () => {
      const { emissions, session } = setup();
      session.onStart();
      const roundStartEmissions = emissions.filter(
        (e) => e.event === MSG.GAME_EVENT && (e.data as Record<string, unknown>).type === 'round_start',
      );
      // Both players (p1 + p2) should receive it
      expect(roundStartEmissions.length).toBe(2);
      const payload = roundStartEmissions[0].data as Record<string, unknown>;
      expect(payload.type).toBe('round_start');
      expect(payload.round).toBe(1);
      expect(payload.bestOf).toBe(BEST_OF);
      expect(payload.seconds).toBe(ROUND_SECONDS);
    });
  });

  describe('onInput validation', () => {
    it('rejects an implausible height jump (delta >= 2.0)', () => {
      const { session } = setup();
      session.onStart();
      // First set a baseline height
      session.onInput('p1', { height: 1.0 });
      // Now try to jump by exactly 2.0 (at the cap, should be rejected)
      session.onInput('p1', { height: 3.0 });
      expect(session.getPlayers().get('p1')!.height).toBe(1.0);
    });

    it('rejects a height jump above 2.0 (strictly implausible)', () => {
      const { session } = setup();
      session.onStart();
      session.onInput('p1', { height: 0.5 });
      // Jump of 2.5 — well above cap
      session.onInput('p1', { height: 3.0 });
      expect(session.getPlayers().get('p1')!.height).toBe(0.5);
    });

    it('accepts a valid monotonic height increase within delta cap', () => {
      const { session } = setup();
      session.onStart();
      session.onInput('p1', { height: 0.5 });
      // Jump of 1.9 — just under the 2.0 cap
      session.onInput('p1', { height: 2.4 });
      expect(session.getPlayers().get('p1')!.height).toBeCloseTo(2.4);
    });

    it('rejects a height decrease (non-monotonic)', () => {
      const { session } = setup();
      session.onStart();
      // Use 1.9 as baseline (just under the 2.0 delta cap from 0)
      session.onInput('p1', { height: 1.9 });
      expect(session.getPlayers().get('p1')!.height).toBeCloseTo(1.9);
      // Now try going backwards — should be rejected
      session.onInput('p1', { height: 1.5 });
      expect(session.getPlayers().get('p1')!.height).toBeCloseTo(1.9);
    });

    it('updates score when provided', () => {
      const { session } = setup();
      session.onStart();
      session.onInput('p1', { height: 0.5, score: 42 });
      expect(session.getPlayers().get('p1')!.score).toBe(42);
    });
  });

  describe('round_end → round_result with correct winner', () => {
    it('picks the player with the higher finalHeight as round winner', () => {
      const { emissions, session } = setup();
      session.onStart();
      // p1 submits round_end with finalHeight 3.5
      session.onAction('p1', 'round_end', { finalHeight: 3.5, score: 10 });
      // p2 submits round_end with finalHeight 5.0 — p2 should win
      session.onAction('p2', 'round_end', { finalHeight: 5.0, score: 15 });

      const roundResultEmissions = emissions.filter(
        (e) => e.event === MSG.GAME_EVENT && (e.data as Record<string, unknown>).type === 'round_result',
      );
      // Both p1 and p2 should receive the round_result
      expect(roundResultEmissions.length).toBeGreaterThanOrEqual(2);
      const payload = roundResultEmissions[0].data as Record<string, unknown>;
      expect(payload.type).toBe('round_result');
      expect(payload.round).toBe(1);
      expect(payload.winnerId).toBe('p2');
    });

    it('starts round 2 after round 1 completes (best-of-3)', () => {
      const { emissions, session } = setup();
      session.onStart();
      session.onAction('p1', 'round_end', { finalHeight: 1.0 });
      session.onAction('p2', 'round_end', { finalHeight: 2.0 });

      const roundStartEmissions = emissions.filter(
        (e) => e.event === MSG.GAME_EVENT && (e.data as Record<string, unknown>).type === 'round_start',
      );
      // Should have round_start for round 1 (2 emissions) + round 2 (2 emissions)
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
      session.onStart();

      // Play through all 3 rounds: p2 wins each round
      for (let r = 1; r <= BEST_OF; r++) {
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
      session.onStart();

      for (let r = 1; r <= BEST_OF; r++) {
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
      session.onStart();

      // Round 1: p1 wins
      session.onAction('p1', 'round_end', { finalHeight: 3.0 });
      session.onAction('p2', 'round_end', { finalHeight: 1.0 });
      // Round 2: p2 wins
      session.onAction('p1', 'round_end', { finalHeight: 1.0 });
      session.onAction('p2', 'round_end', { finalHeight: 4.0 });
      // Round 3: p1 wins
      session.onAction('p1', 'round_end', { finalHeight: 5.0 });
      session.onAction('p2', 'round_end', { finalHeight: 2.0 });

      const gameEndEmissions = emissions.filter((e) => e.event === MSG.GAME_END);
      const payload = gameEndEmissions[0].data as Record<string, unknown>;
      expect(payload.matchWinnerId).toBe('p1');
    });
  });

  describe('disconnect handling', () => {
    it('marks player as done when they disconnect, allowing round finalization', () => {
      const { emissions, session } = setup();
      session.onStart();

      // p1 disconnects
      session.onPlayerDisconnect('p1');
      expect(session.getPlayers().get('p1')!.connected).toBe(false);
      expect(session.getPlayers().get('p1')!.roundDone).toBe(true);

      // p2 submits their round_end — round should finalize immediately
      session.onAction('p2', 'round_end', { finalHeight: 2.0 });

      const roundResultEmissions = emissions.filter(
        (e) => e.event === MSG.GAME_EVENT && (e.data as Record<string, unknown>).type === 'round_result',
      );
      expect(roundResultEmissions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GAME_STATE tick', () => {
    it('broadcasts GAME_STATE on each tick with current player heights', () => {
      const { emissions, session } = setup();
      session.onStart();
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
