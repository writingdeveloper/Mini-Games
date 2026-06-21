import type { Server } from 'socket.io';
import type { Room } from '../lobby/Room.js';
import { MSG } from '../network/MessageTypes.js';

export abstract class GameSessionBase {
  protected io: Server;
  protected room: Room;
  protected tickRate: number;
  protected tickInterval: ReturnType<typeof setInterval> | null = null;
  protected tickCount: number = 0;
  protected startTime: number = 0;

  constructor(io: Server, room: Room, tickRate: number) {
    this.io = io;
    this.room = room;
    this.tickRate = tickRate;
  }

  async start(): Promise<void> {
    this.room.state = 'countdown';
    this.broadcast(MSG.GAME_COUNTDOWN, { seconds: 3 });

    await this.countdown(3);

    this.room.state = 'playing';
    this.startTime = Date.now();
    this.onStart();
    this.broadcast(MSG.GAME_START, { timestamp: this.startTime });

    const intervalMs = Math.round(1000 / this.tickRate);
    this.tickInterval = setInterval(() => {
      // Isolate a throwing tick to THIS session — without this guard a single bad tick
      // (e.g. from a malformed client action) escapes the interval callback and crashes the
      // whole Node process, killing every concurrent room.
      try {
        this.tickCount++;
        this.onTick(intervalMs / 1000);
      } catch (err) {
        console.error(`[GameSession ${this.room.code}] tick error, ending game:`, err);
        this.endGame({ error: 'server_error' });
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.room.state = 'finished';
    this.onStop();
  }

  handleInput(playerId: string, input: Record<string, unknown>): void {
    // Client-driven; a throw here must not take down the process (and thus all other rooms).
    try {
      this.onInput(playerId, input);
    } catch (err) {
      console.error(`[GameSession ${this.room.code}] onInput error from ${playerId}:`, err);
    }
  }

  handleAction(playerId: string, type: string, data: Record<string, unknown>): void {
    try {
      this.onAction(playerId, type, data);
    } catch (err) {
      console.error(`[GameSession ${this.room.code}] onAction(${type}) error from ${playerId}:`, err);
    }
  }

  handleDisconnect(playerId: string): void {
    this.onPlayerDisconnect(playerId);
  }

  handleReconnect(playerId: string): void {
    this.onPlayerReconnect(playerId);
  }

  protected broadcast(event: string, data: unknown): void {
    for (const player of this.room.getConnectedPlayers()) {
      this.io.to(player.socketId).emit(event, data);
    }
  }

  protected sendTo(socketId: string, event: string, data: unknown): void {
    this.io.to(socketId).emit(event, data);
  }

  protected endGame(results: Record<string, unknown>): void {
    this.stop();
    this.broadcast(MSG.GAME_END, results);
  }

  private countdown(seconds: number): Promise<void> {
    return new Promise(resolve => {
      let remaining = seconds;
      const timer = setInterval(() => {
        remaining--;
        this.broadcast(MSG.GAME_COUNTDOWN, { seconds: remaining });
        if (remaining <= 0) {
          clearInterval(timer);
          resolve();
        }
      }, 1000);
    });
  }

  // Abstract methods for game-specific logic
  protected abstract onStart(): void;
  protected abstract onTick(dt: number): void;
  protected abstract onStop(): void;
  protected abstract onInput(playerId: string, input: Record<string, unknown>): void;
  protected abstract onAction(playerId: string, type: string, data: Record<string, unknown>): void;
  protected abstract onPlayerDisconnect(playerId: string): void;
  protected abstract onPlayerReconnect(playerId: string): void;
}
