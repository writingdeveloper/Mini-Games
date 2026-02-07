import type { Server } from 'socket.io';
import type { Room } from '../../lobby/Room.js';
import { GameSessionBase } from '../GameSessionBase.js';
import { MSG } from '../../network/MessageTypes.js';

interface FlightPlayerState {
  id: string;
  lon: number;
  lat: number;
  altitude: number;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  fuel: number;
  score: number;
  checkpointsPassed: number;
  alive: boolean;
  lastUpdate: number;
}

export class FlightGameSession extends GameSessionBase {
  private playerStates: Map<string, FlightPlayerState> = new Map();
  private gameMode: string = 'free';

  constructor(io: Server, room: Room) {
    super(io, room, 20); // 20Hz tick
  }

  protected onStart(): void {
    for (const player of this.room.players.values()) {
      this.playerStates.set(player.id, {
        id: player.id,
        lon: 126.978,
        lat: 37.5665,
        altitude: 500,
        heading: 0,
        pitch: 0,
        roll: 0,
        speed: 100,
        fuel: 100,
        score: 0,
        checkpointsPassed: 0,
        alive: true,
        lastUpdate: Date.now(),
      });
    }
  }

  protected onTick(_dt: number): void {
    // Validate and relay states (client-authoritative with server validation)
    const states: Record<string, unknown> = {};

    for (const [id, state] of this.playerStates) {
      if (!state.alive) continue;

      // Basic validation
      if (state.altitude <= 0) {
        state.alive = false;
        this.broadcast(MSG.GAME_EVENT, {
          type: 'player_crashed',
          playerId: id,
        });
        continue;
      }

      // Speed sanity check (max 300 m/s = ~1080 km/h)
      if (state.speed > 350) {
        state.speed = 300;
      }

      states[id] = {
        lon: state.lon,
        lat: state.lat,
        altitude: state.altitude,
        heading: state.heading,
        pitch: state.pitch,
        roll: state.roll,
        speed: state.speed,
        fuel: state.fuel,
        score: state.score,
        checkpointsPassed: state.checkpointsPassed,
        alive: state.alive,
      };
    }

    this.broadcast(MSG.GAME_STATE, {
      tick: this.tickCount,
      players: states,
      timestamp: Date.now(),
    });

    // Check game end for checkpoint mode
    if (this.gameMode === 'checkpoint') {
      const alivePlayers = [...this.playerStates.values()].filter(p => p.alive);
      if (alivePlayers.length === 0) {
        this.endGame(this.getResults());
      }
    }
  }

  protected onStop(): void {
    this.playerStates.clear();
  }

  protected onInput(playerId: string, input: Record<string, unknown>): void {
    const state = this.playerStates.get(playerId);
    if (!state || !state.alive) return;

    // Client sends its authoritative state; server validates bounds
    if (typeof input.lon === 'number') state.lon = input.lon;
    if (typeof input.lat === 'number') state.lat = input.lat;
    if (typeof input.altitude === 'number') state.altitude = Math.max(0, input.altitude);
    if (typeof input.heading === 'number') state.heading = input.heading;
    if (typeof input.pitch === 'number') state.pitch = input.pitch;
    if (typeof input.roll === 'number') state.roll = input.roll;
    if (typeof input.speed === 'number') state.speed = Math.max(0, input.speed);
    if (typeof input.fuel === 'number') state.fuel = Math.max(0, input.fuel);
    state.lastUpdate = Date.now();
  }

  protected onAction(playerId: string, type: string, data: Record<string, unknown>): void {
    if (type === 'checkpoint_passed') {
      const state = this.playerStates.get(playerId);
      if (state) {
        state.checkpointsPassed++;
        state.score += (data.points as number) || 100;
        this.broadcast(MSG.GAME_EVENT, {
          type: 'checkpoint_passed',
          playerId,
          checkpoint: data.checkpoint,
          score: state.score,
        });
      }
    } else if (type === 'set_mode') {
      this.gameMode = (data.mode as string) || 'free';
    }
  }

  protected onPlayerDisconnect(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (state) state.alive = false;
  }

  protected onPlayerReconnect(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (state) {
      // Send current state to reconnected player
      this.sendTo(playerId, MSG.GAME_STATE, {
        tick: this.tickCount,
        players: Object.fromEntries(
          [...this.playerStates.entries()].map(([id, s]) => [id, { ...s }]),
        ),
        timestamp: Date.now(),
        fullSync: true,
      });
    }
  }

  private getResults(): Record<string, unknown> {
    const scores = [...this.playerStates.values()]
      .sort((a, b) => b.score - a.score)
      .map(p => ({
        id: p.id,
        score: p.score,
        checkpoints: p.checkpointsPassed,
      }));

    return {
      winner: scores[0]?.id || null,
      scores,
    };
  }
}
