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
const ROUND_SECONDS = 90;     // matches client CONFIG.round.duration
const ROUND_GRACE = 6;        // server waits this long past ROUND_SECONDS for stragglers
const MAX_HEIGHT_DELTA = 2.0; // per-input plausibility cap (units/100ms)

export class FryTowerGameSession extends GameSessionBase {
  private players = new Map<string, FryPlayer>();
  private round = 1;
  private roundElapsed = 0;

  constructor(io: Server, room: Room) {
    super(io, room, 10); // 10 Hz tick
  }

  protected onStart(): void {
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

  protected onTick(dt: number): void {
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

  protected onInput(playerId: string, input: Record<string, unknown>): void {
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

  protected onAction(
    playerId: string,
    type: string,
    data: Record<string, unknown>,
  ): void {
    if (type !== 'round_end') return;
    const p = this.players.get(playerId);
    if (!p || p.roundDone) return;
    p.roundDone = true;
    p.finalHeight =
      typeof data.finalHeight === 'number' ? (data.finalHeight as number) : p.height;
    if (typeof data.score === 'number') {
      p.score = data.score as number;
    }
    // Eagerly finalize if everyone is now done (don't wait for next tick)
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

  protected onPlayerDisconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      p.connected = false;
      p.roundDone = true;
      p.finalHeight = p.height;
    }
  }

  protected onPlayerReconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (p) {
      p.connected = true;
      // playerId === socketId in Room (id is set to socketId on addPlayer)
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

  protected onStop(): void {
    this.players.clear();
  }
}
