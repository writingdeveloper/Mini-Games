import type { Server } from 'socket.io';
import type { Room } from '../../lobby/Room.js';
import { GameSessionBase } from '../GameSessionBase.js';
import { MSG } from '../../network/MessageTypes.js';
import { MIN_PLAYERS_TO_START } from '../../config.js';

interface FryPlayer {
  id: string;
  name: string;
  height: number;      // live reported height this round
  score: number;       // live reported score this round
  charge: number;      // live reported sabotage charge (anti-spam awareness)
  finalHeight: number; // captured at round_end
  roundDone: boolean;
  roundWins: number;
  connected: boolean;
  lastInputTs: number; // server clock (ms) of the last accepted height report
}

const BEST_OF = 3;
const ROUND_SECONDS = 90;        // matches client CONFIG.round.duration
const ROUND_GRACE = 6;           // server waits this long past ROUND_SECONDS for stragglers

// Anti-cheat: height growth is bounded per unit of wall-clock time, not per message.
// A fast legit climber gains a few meters/sec; this leaves generous headroom while
// still rejecting teleport-to-the-top forgeries. Applied to both live `onInput`
// reports and the authoritative `round_end` finalHeight.
const MAX_HEIGHT_PER_SEC = 8.0;  // max plausible climb rate (units/second)
const HEIGHT_GRACE = 1.0;        // absolute slack added on top of the rate budget
const MAX_SCORE = 1_000_000;     // sane clamp for reported score
const MAX_CHARGE = 10_000;       // sane clamp for reported sabotage charge

export class FryTowerGameSession extends GameSessionBase {
  private players = new Map<string, FryPlayer>();
  private round = 1;
  private roundElapsed = 0;
  private finished = false; // set once the match is over (normal end or walkover)

  constructor(io: Server, room: Room) {
    super(io, room, 10); // 10 Hz tick
  }

  protected onStart(): void {
    const now = Date.now();
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
    const now = Date.now();
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

  protected onTick(dt: number): void {
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

  // Largest height a player may report given the time elapsed since their last
  // accepted report. Rate budget + a small absolute grace so the very first
  // report of a round (or a burst after a network hiccup) isn't unfairly clamped.
  private _heightCeil(p: FryPlayer, now: number): number {
    const elapsedSec = Math.max(0, (now - p.lastInputTs) / 1000);
    return p.height + MAX_HEIGHT_PER_SEC * elapsedSec + HEIGHT_GRACE;
  }

  protected onInput(playerId: string, input: Record<string, unknown>): void {
    if (this.finished) return;
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    const now = Date.now();
    const h = input.height;
    // Monotonic + per-time bound: accept only forward progress within the rate budget.
    if (typeof h === 'number' && Number.isFinite(h) && h >= p.height) {
      const ceil = this._heightCeil(p, now);
      p.height = h <= ceil ? h : ceil; // clamp implausible jumps instead of dropping the frame
      p.lastInputTs = now;
    }
    if (typeof input.score === 'number' && Number.isFinite(input.score)) {
      p.score = Math.min(MAX_SCORE, Math.max(0, input.score as number));
    }
    if (typeof input.charge === 'number' && Number.isFinite(input.charge)) {
      p.charge = Math.min(MAX_CHARGE, Math.max(0, input.charge as number));
    }
  }

  protected onAction(
    playerId: string,
    type: string,
    data: Record<string, unknown>,
  ): void {
    if (this.finished) return;
    if (type === 'sabotage') {
      this._handleSabotage(playerId, data);
      return;
    }
    if (type !== 'round_end') return;
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    p.roundDone = true;
    // finalHeight is the authoritative winner value — validate it the same way as
    // live reports (monotonic + per-time bound), not just a typeof guard.
    const now = Date.now();
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
    // Eagerly finalize if everyone is now done (don't wait for next tick)
    const everyoneDone = [...this.players.values()].every(
      (q) => q.roundDone || !q.connected,
    );
    if (everyoneDone) this._finalizeRound();
  }

  // Relay a sabotage from one player to a connected opponent. Pure pass-through —
  // does not touch round logic. Clients filter incoming events by `target`.
  private _handleSabotage(playerId: string, data: Record<string, unknown>): void {
    const from = this.players.get(playerId);
    if (!from) return;
    const key = data.key;
    const target = data.target;
    if (typeof key !== 'string' || typeof target !== 'string') return;
    if (target === playerId) return; // can't sabotage yourself
    const victim = this.players.get(target);
    if (!victim || !victim.connected) return; // target must be a connected player
    this.broadcast(MSG.GAME_EVENT, {
      type: 'sabotage',
      key,
      from: playerId,
      target,
    });
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

  protected onPlayerDisconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = false;
    p.roundDone = true;
    p.finalHeight = p.height;

    if (this.finished) return;

    // Walkover: if the disconnect leaves fewer than the minimum players still
    // connected, end the match explicitly instead of letting `everyoneDone`
    // silently auto-finalize the remaining best-of rounds (which raced rounds 2-3
    // through in a blink). With >2-player games, ≥2 remain connected, so we just
    // mark the leaver out and let play continue.
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

  protected onPlayerReconnect(_playerId: string): void {
    // No-op for this milestone: reconnect is not wired for Fry Tower — a disconnect
    // mid-match is resolved as a walkover (see onPlayerDisconnect). State resync on
    // reconnect was removed deliberately.
    // TODO platform: reconnect not wired (shared GameSessionBase.handleReconnect /
    // Room.reconnectPlayer / RECONNECT_GRACE_MS still exist for escape/flight/survival;
    // a platform-wide reconnect cleanup is a separate effort).
  }

  protected onStop(): void {
    this.players.clear();
  }
}
