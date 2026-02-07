import type { Server } from 'socket.io';
import type { Room } from '../../lobby/Room.js';
import { GameSessionBase } from '../GameSessionBase.js';
import { MSG } from '../../network/MessageTypes.js';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface SurvivalPlayer {
  id: string;
  position: Vec3;
  rotation: Vec3;
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
  animation: string;
  alive: boolean;
  lastUpdate: number;
}

interface ServerEnemy {
  id: number;
  position: Vec3;
  rotation: number;
  health: number;
  state: 'patrol' | 'chase';
  targetPlayerId: string | null;
  patrolAngle: number;
  initialPosition: Vec3;
  shootCooldown: number;
}

let enemyIdCounter = 0;

export class SurvivalGameSession extends GameSessionBase {
  private players: Map<string, SurvivalPlayer> = new Map();
  private enemies: Map<number, ServerEnemy> = new Map();
  private dayTime: number = 0;
  private enemySpawnTimer: number = 0;

  constructor(io: Server, room: Room) {
    super(io, room, 15); // 15Hz tick
  }

  protected onStart(): void {
    // Initialize players
    let i = 0;
    const spawnPositions = [
      { x: 0, y: 2, z: 0 },
      { x: 5, y: 2, z: 0 },
      { x: 0, y: 2, z: 5 },
      { x: 5, y: 2, z: 5 },
    ];

    for (const player of this.room.players.values()) {
      const pos = spawnPositions[i % spawnPositions.length];
      this.players.set(player.id, {
        id: player.id,
        position: { ...pos },
        rotation: { x: 0, y: 0, z: 0 },
        health: 100,
        stamina: 100,
        hunger: 100,
        thirst: 100,
        animation: 'idle',
        alive: true,
        lastUpdate: Date.now(),
      });
      i++;
    }

    // Spawn initial enemies
    for (let j = 0; j < 8; j++) {
      const angle = (j / 8) * Math.PI * 2;
      const dist = 20 + Math.random() * 20;
      this.spawnEnemy({
        x: Math.cos(angle) * dist,
        y: 2,
        z: Math.sin(angle) * dist,
      });
    }
  }

  protected onTick(dt: number): void {
    this.dayTime += dt * 0.01;

    // Update enemies (server authoritative)
    this.updateEnemies(dt);

    // Spawn new enemies periodically
    this.enemySpawnTimer += dt;
    if (this.enemySpawnTimer > 5 && this.enemies.size < 20) {
      this.spawnRandomEnemy();
      this.enemySpawnTimer = 0;
    }

    // Update player stats (hunger/thirst drain)
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      player.hunger = Math.max(0, player.hunger - dt * 0.1);
      player.thirst = Math.max(0, player.thirst - dt * 0.15);

      if (player.hunger <= 0 || player.thirst <= 0) {
        player.health -= dt * 2;
      }
      if (player.health <= 0) {
        player.alive = false;
        this.broadcast(MSG.GAME_EVENT, {
          type: 'player_died',
          playerId: player.id,
          reason: player.hunger <= 0 ? 'starvation' : 'dehydration',
        });
      }
    }

    // Check game over - all dead
    const alivePlayers = [...this.players.values()].filter(p => p.alive);
    if (alivePlayers.length === 0 && this.players.size > 0) {
      this.endGame({
        survived: false,
        dayTime: this.dayTime,
        scores: Object.fromEntries(
          [...this.players.values()].map(p => [p.id, { health: p.health }]),
        ),
      });
      return;
    }

    // Broadcast state
    this.broadcast(MSG.GAME_STATE, {
      tick: this.tickCount,
      dayTime: this.dayTime,
      players: Object.fromEntries(
        [...this.players.values()].map(p => [p.id, {
          position: p.position,
          rotation: p.rotation,
          health: p.health,
          stamina: p.stamina,
          hunger: p.hunger,
          thirst: p.thirst,
          animation: p.animation,
          alive: p.alive,
        }]),
      ),
      enemies: [...this.enemies.values()].map(e => ({
        id: e.id,
        position: e.position,
        rotation: e.rotation,
        health: e.health,
        state: e.state,
        targetPlayerId: e.targetPlayerId,
      })),
    });
  }

  protected onStop(): void {
    this.players.clear();
    this.enemies.clear();
  }

  protected onInput(playerId: string, input: Record<string, unknown>): void {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;

    // Client-authoritative movement with basic validation
    if (input.position && typeof (input.position as Vec3).x === 'number') {
      const pos = input.position as Vec3;
      // Speed check - max ~10 units per tick
      const dx = pos.x - player.position.x;
      const dz = pos.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 15) { // Allow some slack for network jitter
        player.position = pos;
      }
    }
    if (input.rotation && typeof (input.rotation as Vec3).x === 'number') {
      player.rotation = input.rotation as Vec3;
    }
    if (typeof input.animation === 'string') {
      player.animation = input.animation;
    }
    if (typeof input.stamina === 'number') {
      player.stamina = Math.max(0, Math.min(100, input.stamina));
    }
    player.lastUpdate = Date.now();
  }

  protected onAction(playerId: string, type: string, data: Record<string, unknown>): void {
    if (type === 'shoot') {
      // Broadcast shoot event to all players
      this.broadcast(MSG.GAME_EVENT, {
        type: 'player_shoot',
        playerId,
        origin: data.origin,
        direction: data.direction,
        weaponType: data.weaponType,
      });
    } else if (type === 'enemy_hit') {
      const enemyId = data.enemyId as number;
      const damage = (data.damage as number) || 25;
      const enemy = this.enemies.get(enemyId);
      if (enemy) {
        enemy.health -= damage;
        if (enemy.health <= 0) {
          this.enemies.delete(enemyId);
          this.broadcast(MSG.GAME_EVENT, {
            type: 'enemy_killed',
            enemyId,
            killerId: playerId,
          });
        }
      }
    } else if (type === 'grenade') {
      this.broadcast(MSG.GAME_EVENT, {
        type: 'grenade',
        playerId,
        position: data.position,
        radius: data.radius,
      });
    }
  }

  protected onPlayerDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      // Don't immediately kill - allow reconnection
      player.animation = 'idle';
    }
  }

  protected onPlayerReconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      // Send full state sync
      this.sendTo(playerId, MSG.GAME_STATE, {
        tick: this.tickCount,
        dayTime: this.dayTime,
        fullSync: true,
        players: Object.fromEntries(
          [...this.players.values()].map(p => [p.id, {
            position: p.position,
            rotation: p.rotation,
            health: p.health,
            stamina: p.stamina,
            hunger: p.hunger,
            thirst: p.thirst,
            animation: p.animation,
            alive: p.alive,
          }]),
        ),
        enemies: [...this.enemies.values()].map(e => ({
          id: e.id,
          position: e.position,
          rotation: e.rotation,
          health: e.health,
          state: e.state,
        })),
      });
    }
  }

  private spawnEnemy(position: Vec3): void {
    const id = ++enemyIdCounter;
    this.enemies.set(id, {
      id,
      position: { ...position },
      rotation: 0,
      health: 100,
      state: 'patrol',
      targetPlayerId: null,
      patrolAngle: Math.random() * Math.PI * 2,
      initialPosition: { ...position },
      shootCooldown: 1.5 + Math.random(),
    });
  }

  private spawnRandomEnemy(): void {
    // Pick a random alive player to spawn near
    const alivePlayers = [...this.players.values()].filter(p => p.alive);
    if (alivePlayers.length === 0) return;

    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 30;

    this.spawnEnemy({
      x: target.position.x + Math.cos(angle) * dist,
      y: 2,
      z: target.position.z + Math.sin(angle) * dist,
    });
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies.values()) {
      // Find nearest alive player
      let nearestPlayer: SurvivalPlayer | null = null;
      let nearestDist = Infinity;

      for (const player of this.players.values()) {
        if (!player.alive) continue;
        const dx = player.position.x - enemy.position.x;
        const dz = player.position.z - enemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPlayer = player;
        }
      }

      const detectionRange = 25;
      const attackRange = 20;

      if (nearestPlayer && nearestDist < detectionRange) {
        enemy.state = 'chase';
        enemy.targetPlayerId = nearestPlayer.id;

        // Move towards player
        const dx = nearestPlayer.position.x - enemy.position.x;
        const dz = nearestPlayer.position.z - enemy.position.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 2) {
          const speed = 3.5;
          enemy.position.x += (dx / len) * speed * dt;
          enemy.position.z += (dz / len) * speed * dt;
          enemy.rotation = Math.atan2(dx, dz);
        }

        // Shooting
        enemy.shootCooldown -= dt;
        if (nearestDist < attackRange && nearestDist > 3 && enemy.shootCooldown <= 0) {
          enemy.shootCooldown = 1.5 + Math.random();
          // Apply damage to player
          nearestPlayer.health -= 8;
          this.broadcast(MSG.GAME_EVENT, {
            type: 'enemy_shoot',
            enemyId: enemy.id,
            targetId: nearestPlayer.id,
            damage: 8,
          });

          if (nearestPlayer.health <= 0) {
            nearestPlayer.alive = false;
            this.broadcast(MSG.GAME_EVENT, {
              type: 'player_died',
              playerId: nearestPlayer.id,
              reason: 'enemy',
            });
          }
        }

        // Melee attack
        if (nearestDist < 2) {
          nearestPlayer.health -= 10 * dt;
        }
      } else {
        enemy.state = 'patrol';
        enemy.targetPlayerId = null;

        // Patrol behavior
        enemy.patrolAngle += dt * 0.3;
        const patrolX = enemy.initialPosition.x + Math.cos(enemy.patrolAngle) * 8;
        const patrolZ = enemy.initialPosition.z + Math.sin(enemy.patrolAngle) * 8;

        const dx = patrolX - enemy.position.x;
        const dz = patrolZ - enemy.position.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0.1) {
          const speed = 1.5;
          enemy.position.x += (dx / len) * speed * dt;
          enemy.position.z += (dz / len) * speed * dt;
          enemy.rotation = Math.atan2(dx, dz);
        }
      }
    }
  }
}
