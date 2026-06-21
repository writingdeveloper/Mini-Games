import type { Server, Socket } from 'socket.io';
import { LobbyManager } from '../lobby/LobbyManager.js';
import { MSG } from './MessageTypes.js';
import { GameSessionBase } from '../games/GameSessionBase.js';
import { EscapeGameSession } from '../games/escape/EscapeGameSession.js';
import { FlightGameSession } from '../games/flight/FlightGameSession.js';
import { SurvivalGameSession } from '../games/survival/SurvivalGameSession.js';
import { isPlainObject, isValidGameType, normalizeRoomCode } from './validation.js';

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

  /**
   * Register a socket handler that can never crash the process: any throw (e.g. from a malformed
   * client payload) is caught, logged, and surfaced as a ROOM_ERROR instead of propagating to the
   * event loop and terminating Node (which would drop EVERY room/session for all users).
   */
  private safeOn(socket: Socket, event: string, handler: (...args: unknown[]) => void): void {
    socket.on(event, (...args: unknown[]) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[Socket] ${event} handler error from ${socket.id}:`, err);
        socket.emit(MSG.ROOM_ERROR, { message: 'Server error' });
      }
    });
  }

  private handleConnection(socket: Socket): void {
    console.log(`[Socket] Connected: ${socket.id}`);

    this.safeOn(socket, MSG.ROOM_CREATE, (payload, ack) => {
      if (!isPlainObject(payload) || !isValidGameType(payload.gameType)) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Invalid game type' });
        return;
      }
      // playerName is sanitized server-side in Room.addPlayer
      const room = this.lobby.createRoom(payload.gameType, socket.id, payload.playerName as string);
      if (!room) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Failed to create room' });
        return;
      }
      socket.join(room.code);
      this.playerRooms.set(socket.id, room.code);
      const response = { room: room.toInfo() };
      if (typeof ack === 'function') ack(response);
      else socket.emit(MSG.ROOM_UPDATE, response);
    });

    this.safeOn(socket, MSG.ROOM_JOIN, (payload, ack) => {
      const code = isPlainObject(payload) ? normalizeRoomCode(payload.code) : null;
      if (!code) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Invalid room code' });
        return;
      }
      const room = this.lobby.joinRoom(code, socket.id, (payload as Record<string, unknown>).playerName as string);
      if (!room) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Room not found or full' });
        return;
      }
      socket.join(room.code);
      this.playerRooms.set(socket.id, room.code);
      const response = { room: room.toInfo() };
      if (typeof ack === 'function') ack(response);
      this.io.to(room.code).emit(MSG.ROOM_UPDATE, response);
    });

    this.safeOn(socket, MSG.ROOM_LEAVE, () => {
      this.handleLeaveRoom(socket);
    });

    this.safeOn(socket, MSG.ROOM_READY, (payload) => {
      if (!isPlainObject(payload) || typeof payload.ready !== 'boolean') return;
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = this.lobby.getRoom(roomCode);
      if (!room || room.state !== 'waiting') return; // no ready-toggling mid-game

      room.setReady(socket.id, payload.ready);
      this.io.to(roomCode).emit(MSG.ROOM_UPDATE, { room: room.toInfo() });
    });

    this.safeOn(socket, MSG.ROOM_LIST, (payload, ack) => {
      const raw = isPlainObject(payload) ? payload.gameType : undefined;
      const gameType = isValidGameType(raw) ? raw : undefined;
      const rooms = this.lobby.listRooms(gameType).map(r => r.toInfo());
      const response = { rooms };
      if (typeof ack === 'function') ack(response);
      else socket.emit(MSG.ROOM_LIST, response);
    });

    // Host starts the game
    this.safeOn(socket, MSG.GAME_START, () => {
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;

      const room = this.lobby.getRoom(roomCode);
      if (!room || room.hostId !== socket.id) return;
      // Re-entrancy guard: a repeated game:start must NOT spawn a second session (its tick
      // interval would leak forever). A session is registered synchronously before start().
      if (this.sessions.has(roomCode) || room.state !== 'waiting') return;
      if (!room.allReady()) {
        socket.emit(MSG.ROOM_ERROR, { message: 'Not all players are ready' });
        return;
      }

      this.startGameSession(roomCode);
    });

    this.safeOn(socket, MSG.GAME_INPUT, (payload) => {
      if (!isPlainObject(payload) || !isPlainObject(payload.input)) return;
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;
      this.sessions.get(roomCode)?.handleInput(socket.id, payload.input);
    });

    this.safeOn(socket, MSG.GAME_ACTION, (payload) => {
      if (!isPlainObject(payload) || typeof payload.type !== 'string' || !isPlainObject(payload.data)) return;
      const roomCode = this.playerRooms.get(socket.id);
      if (!roomCode) return;
      this.sessions.get(roomCode)?.handleAction(socket.id, payload.type, payload.data);
    });

    this.safeOn(socket, MSG.PING, (timestamp) => {
      socket.emit(MSG.PONG, timestamp);
    });

    socket.on('disconnect', () => {
      try {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        const roomCode = this.playerRooms.get(socket.id);
        if (!roomCode) return;

        const room = this.lobby.getRoom(roomCode);
        if (!room) {
          this.playerRooms.delete(socket.id);
          return;
        }

        const session = this.sessions.get(roomCode);
        if (session && room.state === 'playing') {
          // Game in progress - mark as disconnected. Reconnect is not yet wired, so drop the
          // playerRooms entry to avoid leaking it forever (socket.id is never reused).
          room.disconnectPlayer(socket.id);
          session.handleDisconnect(socket.id);
          this.playerRooms.delete(socket.id);
          this.io.to(roomCode).emit(MSG.GAME_EVENT, {
            type: 'player_disconnected',
            playerId: socket.id,
          });
        } else {
          // In lobby - remove player
          this.handleLeaveRoom(socket);
        }
      } catch (err) {
        console.error(`[Socket] disconnect handler error for ${socket.id}:`, err);
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
    // start() is async (countdown); an unhandled rejection here would crash the process.
    session.start().catch((err) => {
      console.error(`[SocketManager] session ${roomCode} start failed:`, err);
      session.stop();
      this.sessions.delete(roomCode);
    });
  }
}
