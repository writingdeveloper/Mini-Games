import type { GameType, RoomState, PlayerInfo, RoomInfo } from '../network/MessageTypes.js';
import { MAX_PLAYERS_PER_ROOM, RECONNECT_GRACE_MS } from '../config.js';

const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];

export interface RoomPlayer {
  id: string;
  socketId: string;
  name: string;
  ready: boolean;
  color: string;
  connected: boolean;
  disconnectedAt?: number;
}

export class Room {
  public readonly code: string;
  public readonly gameType: GameType;
  public state: RoomState = 'waiting';
  public hostId: string;
  public players: Map<string, RoomPlayer> = new Map();
  public createdAt: number = Date.now();
  public lastActivity: number = Date.now();

  constructor(code: string, gameType: GameType, hostId: string) {
    this.code = code;
    this.gameType = gameType;
    this.hostId = hostId;
  }

  addPlayer(socketId: string, name: string): RoomPlayer | null {
    if (this.players.size >= MAX_PLAYERS_PER_ROOM) return null;
    if (this.state !== 'waiting') return null;

    const color = PLAYER_COLORS[this.players.size] || '#FFFFFF';
    const player: RoomPlayer = {
      id: socketId,
      socketId,
      name,
      ready: false,
      color,
      connected: true,
    };
    this.players.set(socketId, player);
    this.lastActivity = Date.now();
    return player;
  }

  removePlayer(socketId: string): boolean {
    const removed = this.players.delete(socketId);
    if (removed) {
      this.lastActivity = Date.now();
      // Transfer host if needed
      if (this.hostId === socketId && this.players.size > 0) {
        const nextHost = this.players.values().next().value;
        if (nextHost) this.hostId = nextHost.id;
      }
    }
    return removed;
  }

  disconnectPlayer(socketId: string): void {
    const player = this.players.get(socketId);
    if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
  }

  reconnectPlayer(socketId: string, newSocketId: string): RoomPlayer | null {
    const player = this.players.get(socketId);
    if (!player) return null;
    if (Date.now() - (player.disconnectedAt || 0) > RECONNECT_GRACE_MS) return null;

    player.connected = true;
    player.socketId = newSocketId;
    player.disconnectedAt = undefined;

    // Re-key if socket ID changed
    if (socketId !== newSocketId) {
      this.players.delete(socketId);
      this.players.set(newSocketId, player);
      if (this.hostId === socketId) this.hostId = newSocketId;
    }
    return player;
  }

  setReady(socketId: string, ready: boolean): void {
    const player = this.players.get(socketId);
    if (player) {
      player.ready = ready;
      this.lastActivity = Date.now();
    }
  }

  allReady(): boolean {
    if (this.players.size < 2) return false;
    for (const player of this.players.values()) {
      if (!player.ready) return false;
    }
    return true;
  }

  getConnectedPlayers(): RoomPlayer[] {
    return [...this.players.values()].filter(p => p.connected);
  }

  getPlayerInfos(): PlayerInfo[] {
    return [...this.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      color: p.color,
    }));
  }

  toInfo(): RoomInfo {
    return {
      code: this.code,
      gameType: this.gameType,
      state: this.state,
      players: this.getPlayerInfos(),
      hostId: this.hostId,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
    };
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  isIdle(timeoutMs: number): boolean {
    return Date.now() - this.lastActivity > timeoutMs;
  }
}
