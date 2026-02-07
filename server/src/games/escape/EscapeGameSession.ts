import type { Server } from 'socket.io';
import type { Room } from '../../lobby/Room.js';
import { GameSessionBase } from '../GameSessionBase.js';
import { MSG } from '../../network/MessageTypes.js';

const GRID_SIZE = 20;

interface Position {
  x: number;
  y: number;
}

interface EscapePlayer {
  id: string;
  position: Position;
  direction: Position;
  nextDirection: Position;
  policeCars: Position[];
  score: number;
  speed: number;
  alive: boolean;
}

export class EscapeGameSession extends GameSessionBase {
  private players: Map<string, EscapePlayer> = new Map();
  private pedestrian: Position = { x: 0, y: 0 };

  constructor(io: Server, room: Room) {
    super(io, room, 10); // 10Hz tick
  }

  protected onStart(): void {
    let i = 0;
    for (const player of this.room.players.values()) {
      // Spread players across the grid
      const startPositions = [
        { x: 5, y: 5 },
        { x: 15, y: 15 },
        { x: 5, y: 15 },
        { x: 15, y: 5 },
      ];
      const pos = startPositions[i % startPositions.length];

      this.players.set(player.id, {
        id: player.id,
        position: { ...pos },
        direction: { x: 0, y: 0 },
        nextDirection: { x: 0, y: 0 },
        policeCars: [],
        score: 0,
        speed: 1,
        alive: true,
      });
      i++;
    }
    this.spawnPedestrian();
  }

  protected onTick(_dt: number): void {
    // Update all players
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      this.updatePlayer(player);
    }

    // Check if game should end (last one standing or time limit)
    const alivePlayers = [...this.players.values()].filter(p => p.alive);
    if (alivePlayers.length <= 1 && this.players.size > 1) {
      const results: Record<string, unknown> = {
        winner: alivePlayers[0]?.id || null,
        scores: Object.fromEntries(
          [...this.players.values()].map(p => [p.id, p.score]),
        ),
      };
      this.endGame(results);
      return;
    }

    // Broadcast state
    this.broadcast(MSG.GAME_STATE, {
      tick: this.tickCount,
      players: Object.fromEntries(
        [...this.players.values()].map(p => [p.id, {
          position: p.position,
          direction: p.direction,
          policeCars: p.policeCars,
          score: p.score,
          speed: p.speed,
          alive: p.alive,
        }]),
      ),
      pedestrian: this.pedestrian,
    });
  }

  protected onStop(): void {
    this.players.clear();
  }

  protected onInput(playerId: string, input: Record<string, unknown>): void {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;

    const dir = input.direction as Position | undefined;
    if (dir && typeof dir.x === 'number' && typeof dir.y === 'number') {
      // Validate: can't reverse direction
      if (player.direction.x !== 0 && dir.x === -player.direction.x) return;
      if (player.direction.y !== 0 && dir.y === -player.direction.y) return;
      player.nextDirection = { x: dir.x, y: dir.y };
    }
  }

  protected onAction(): void {
    // No actions for escape game
  }

  protected onPlayerDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) player.alive = false;
  }

  protected onPlayerReconnect(_playerId: string): void {
    // Player stays dead after disconnect in escape game
  }

  private updatePlayer(player: EscapePlayer): void {
    player.direction = { ...player.nextDirection };

    if (player.direction.x === 0 && player.direction.y === 0) return;

    // Move police cars (trail follows player)
    for (let i = player.policeCars.length - 1; i > 0; i--) {
      player.policeCars[i] = { ...player.policeCars[i - 1] };
    }
    if (player.policeCars.length > 0) {
      player.policeCars[0] = { ...player.position };
    }

    // Move player
    player.position.x += player.direction.x;
    player.position.y += player.direction.y;

    // Wall collision
    if (
      player.position.x < 0 || player.position.x >= GRID_SIZE ||
      player.position.y < 0 || player.position.y >= GRID_SIZE
    ) {
      player.alive = false;
      this.broadcast(MSG.GAME_EVENT, {
        type: 'player_died',
        playerId: player.id,
        reason: 'wall',
      });
      return;
    }

    // Own police collision
    for (const police of player.policeCars) {
      if (player.position.x === police.x && player.position.y === police.y) {
        player.alive = false;
        this.broadcast(MSG.GAME_EVENT, {
          type: 'player_died',
          playerId: player.id,
          reason: 'own_police',
        });
        return;
      }
    }

    // Other players' police collision
    for (const other of this.players.values()) {
      if (other.id === player.id || !other.alive) continue;
      for (const police of other.policeCars) {
        if (player.position.x === police.x && player.position.y === police.y) {
          player.alive = false;
          this.broadcast(MSG.GAME_EVENT, {
            type: 'player_died',
            playerId: player.id,
            reason: 'other_police',
            killerId: other.id,
          });
          return;
        }
      }
    }

    // Pedestrian collision
    if (player.position.x === this.pedestrian.x && player.position.y === this.pedestrian.y) {
      player.score++;
      player.policeCars.push({ ...player.position });
      this.spawnPedestrian();

      if (player.score % 5 === 0) {
        player.speed++;
      }

      this.broadcast(MSG.GAME_EVENT, {
        type: 'pedestrian_hit',
        playerId: player.id,
        score: player.score,
      });
    }
  }

  private spawnPedestrian(): void {
    const occupiedPositions = new Set<string>();

    for (const player of this.players.values()) {
      occupiedPositions.add(`${player.position.x},${player.position.y}`);
      for (const police of player.policeCars) {
        occupiedPositions.add(`${police.x},${police.y}`);
      }
    }

    let pos: Position;
    let attempts = 0;
    do {
      pos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      attempts++;
    } while (occupiedPositions.has(`${pos.x},${pos.y}`) && attempts < 100);

    this.pedestrian = pos;
  }
}
