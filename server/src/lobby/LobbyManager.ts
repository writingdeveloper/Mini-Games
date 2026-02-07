import { Room } from './Room.js';
import { generateRoomCode } from './RoomCodeGenerator.js';
import { MAX_ROOMS, ROOM_IDLE_TIMEOUT_MS } from '../config.js';
import type { GameType } from '../network/MessageTypes.js';

export class LobbyManager {
  private rooms: Map<string, Room> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.cleanupInterval = setInterval(() => this.cleanupIdleRooms(), 60_000);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  createRoom(gameType: GameType, hostSocketId: string, hostName: string): Room | null {
    if (this.rooms.size >= MAX_ROOMS) return null;

    const existingCodes = new Set(this.rooms.keys());
    const code = generateRoomCode(existingCodes);
    const room = new Room(code, gameType, hostSocketId);
    room.addPlayer(hostSocketId, hostName);
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, socketId: string, playerName: string): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    const player = room.addPlayer(socketId, playerName);
    return player ? room : null;
  }

  leaveRoom(code: string, socketId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.removePlayer(socketId);
    if (room.isEmpty()) {
      this.rooms.delete(code);
      return null;
    }
    return room;
  }

  disconnectFromRoom(code: string, socketId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.disconnectPlayer(socketId);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomByPlayer(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return undefined;
  }

  listRooms(gameType?: GameType): Room[] {
    const rooms = [...this.rooms.values()].filter(r => r.state === 'waiting');
    if (gameType) return rooms.filter(r => r.gameType === gameType);
    return rooms;
  }

  private cleanupIdleRooms(): void {
    for (const [code, room] of this.rooms) {
      if (room.isEmpty() || room.isIdle(ROOM_IDLE_TIMEOUT_MS)) {
        this.rooms.delete(code);
      }
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
