import type { Server, Socket } from 'socket.io';
import { LobbyManager } from '../lobby/LobbyManager.js';
import { MSG } from './MessageTypes.js';
import type { RoomCreatePayload, RoomJoinPayload, GameInputPayload, GameActionPayload } from './MessageTypes.js';
import { GameSessionBase } from '../games/GameSessionBase.js';
import { EscapeGameSession } from '../games/escape/EscapeGameSession.js';
import { FlightGameSession } from '../games/flight/FlightGameSession.js';
import { SurvivalGameSession } from '../games/survival/SurvivalGameSession.js';
import { TICK_RATES } from '../config.js';

export class SocketManager {
  private io: Server;
  private lobby: LobbyManager;
  private sessions: Map<string, GameSessionBase> = new Map();
  private playerRooms: Map<string, string> = new Map(); // socketId -> roomCode

  constructor(io: Server) {
    this.io = io;
    this.lobby = new LobbyManager();
  }

  start(): void {
    this.lobby.start();
    this.io.on('connection', (socket) => this.handleConnection(socket));
    console.log('[SocketManager] Listening for connections');
  }

  stop(): void {
    this.lobby.stop();
    for (const session of this.sessions.values()) {
      session.stop();
    }
    this.sessions.clear();
  }

  private handleConnection(socket: Socket): void {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on(MSG.ROOM_CREATE, (payload: RoomCreatePayload, ack?: (data: unknown) => void) => {
      const room = this.lobby.createRoom(payload.gameType, socket.id, payload.playerName);
      if (!room) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Failed to create room' });
        return;
      }
      socket.join(room.code);
      this.playerRooms.set(socket.id, room.code);
      const response = { room: room.toInfo() };
      if (ack) ack(response);
      else socket.emit(MSG.ROOM_UPDATE, response);
    });

    socket.on(MSG.ROOM_JOIN, (payload: RoomJoinPayload, ack?: (data: unknown) => void) => {
      const room = this.lobby.joinRoom(payload.code, socket.id, payload.playerName);
      if (!room) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Room not found or full' });
        return;
      }
      socket.join(room.code);
      this.playerRooms.set(socket.id, room.code);
      const response = { room: room.toInfo() };
      if (ack) ack(response);
      this.io.to(room.code).emit(MSG.ROOM_UPDATE, response);
    });

    socket.on(MSG.ROOM_LEAVE, () => {
      this.handleLeaveRoom(socket);
    });

    socket.on(MSG.ROOM_READY, (payload: { ready: boolean }) => {
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = this.lobby.getRoom(roomCode);
      if (!room) return;

      room.setReady(socket.id, payload.ready);
      this.io.to(roomCode).emit(MSG.ROOM_UPDATE, { room: room.toInfo() });
    });

    socket.on(MSG.ROOM_LIST, (payload: { gameType?: string }, ack?: (data: unknown) => void) => {
      const gameType = payload?.gameType as 'escape' | 'flight' | 'survival' | undefined;
      const rooms = this.lobby.listRooms(gameType).map(r => r.toInfo());
      const response = { rooms };
      if (ack) ack(response);
      else socket.emit(MSG.ROOM_LIST, response);
    });

    // Host starts the game
    socket.on(MSG.GAME_START, () => {
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = this.lobby.getRoom(roomCode);
      if (!room || room.hostId !== socket.id) return;
      if (!room.allReady()) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Not all players are ready' });
        return;
      }

      this.startGameSession(roomCode);
    });

    socket.on(MSG.GAME_INPUT, (payload: GameInputPayload) => {
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;
      const session = this.sessions.get(roomCode);
      session?.handleInput(socket.id, payload.input);
    });

    socket.on(MSG.GAME_ACTION, (payload: GameActionPayload) => {
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;
      const session = this.sessions.get(roomCode);
      session?.handleAction(socket.id, payload.type, payload.data);
    });

    socket.on(MSG.PING, (timestamp: number) => {
      socket.emit(MSG.PONG, timestamp);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = this.lobby.getRoom(roomCode);
      if (!room) return;

      const session = this.sessions.get(roomCode);
      if (session && room.state === 'playing') {
        // Game in progress - mark as disconnected, allow reconnection
        room.disconnectPlayer(socket.id);
        session.handleDisconnect(socket.id);
        this.io.to(roomCode).emit(MSG.GAME_EVENT, {
          type: 'player_disconnected',
          playerId: socket.id,
        });
      } else {
        // In lobby - remove player
        this.handleLeaveRoom(socket);
      }
    });
  }

  private handleLeaveRoom(socket: Socket): void {
    const roomCode = this.playerRooms.get(socket.id);
    if (!roomCode) return;

    const room = this.lobby.leaveRoom(roomCode, socket.id);
    socket.leave(roomCode);
    this.playerRooms.delete(socket.id);

    if (room) {
      this.io.to(roomCode).emit(MSG.ROOM_UPDATE, { room: room.toInfo() });
    }

    // Cleanup session if room is empty
    const session = this.sessions.get(roomCode);
    if (session && (!room || room.isEmpty())) {
      session.stop();
      this.sessions.delete(roomCode);
    }
  }

  private startGameSession(roomCode: string): void {
    const room = this.lobby.getRoom(roomCode);
    if (!room) return;

    let session: GameSessionBase;

    switch (room.gameType) {
      case 'escape':
        session = new EscapeGameSession(this.io, room);
        break;
      case 'flight':
        session = new FlightGameSession(this.io, room);
        break;
      case 'survival':
        session = new SurvivalGameSession(this.io, room);
        break;
      default:
        return;
    }

    this.sessions.set(roomCode, session);
    session.start();
  }
}
