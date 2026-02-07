import { MSG } from './MessageTypes.js';

/**
 * GameClient - Socket.io client wrapper for game networking
 * Handles connection, room management, and game state communication
 */
export class GameClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.room = null;
    this.playerId = null;
    this.ping = 0;
    this._pingInterval = null;
    this._listeners = {};
  }

  /**
   * Connect to the game server
   * Requires socket.io-client loaded via CDN or bundled
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (typeof io === 'undefined') {
        reject(new Error('socket.io-client not loaded'));
        return;
      }

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.playerId = this.socket.id;
        this._startPingLoop();
        resolve(this.socket.id);
      });

      this.socket.on('connect_error', (err) => {
        reject(err);
      });

      this.socket.on('disconnect', (reason) => {
        this._stopPingLoop();
        this._emit('disconnected', { reason });
      });

      this.socket.on('reconnect', () => {
        this.playerId = this.socket.id;
        this._emit('reconnected', {});
      });

      // Room events
      this.socket.on(MSG.ROOM_UPDATE, (data) => {
        this.room = data.room;
        this._emit('roomUpdate', data.room);
      });

      this.socket.on(MSG.ROOM_ERROR, (data) => {
        this._emit('roomError', data.message);
      });

      // Game events
      this.socket.on(MSG.GAME_COUNTDOWN, (data) => {
        this._emit('countdown', data.seconds);
      });

      this.socket.on(MSG.GAME_START, (data) => {
        this._emit('gameStart', data);
      });

      this.socket.on(MSG.GAME_STATE, (data) => {
        this._emit('gameState', data);
      });

      this.socket.on(MSG.GAME_EVENT, (data) => {
        this._emit('gameEvent', data);
      });

      this.socket.on(MSG.GAME_END, (data) => {
        this._emit('gameEnd', data);
      });

      this.socket.on(MSG.PONG, (timestamp) => {
        this.ping = Date.now() - timestamp;
      });
    });
  }

  disconnect() {
    this._stopPingLoop();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.room = null;
    this.playerId = null;
  }

  // Room management
  createRoom(gameType, playerName) {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('Not connected')); return; }
      this.socket.emit(MSG.ROOM_CREATE, { gameType, playerName }, (response) => {
        if (response?.room) {
          this.room = response.room;
          resolve(response.room);
        } else {
          reject(new Error('Failed to create room'));
        }
      });
      // Fallback timeout
      setTimeout(() => reject(new Error('Create room timeout')), 5000);
    });
  }

  joinRoom(code, playerName) {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('Not connected')); return; }
      this.socket.emit(MSG.ROOM_JOIN, { code, playerName }, (response) => {
        if (response?.room) {
          this.room = response.room;
          resolve(response.room);
        } else {
          reject(new Error('Failed to join room'));
        }
      });
      setTimeout(() => reject(new Error('Join room timeout')), 5000);
    });
  }

  leaveRoom() {
    if (!this.socket) return;
    this.socket.emit(MSG.ROOM_LEAVE);
    this.room = null;
  }

  setReady(ready) {
    if (!this.socket) return;
    this.socket.emit(MSG.ROOM_READY, { ready });
  }

  listRooms(gameType) {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('Not connected')); return; }
      this.socket.emit(MSG.ROOM_LIST, { gameType }, (response) => {
        resolve(response?.rooms || []);
      });
      setTimeout(() => reject(new Error('List rooms timeout')), 5000);
    });
  }

  startGame() {
    if (!this.socket) return;
    this.socket.emit(MSG.GAME_START);
  }

  // Game communication
  sendInput(input, seq) {
    if (!this.socket) return;
    this.socket.emit(MSG.GAME_INPUT, {
      seq: seq || 0,
      input,
      timestamp: Date.now(),
    });
  }

  sendAction(type, data) {
    if (!this.socket) return;
    this.socket.emit(MSG.GAME_ACTION, { type, data: data || {} });
  }

  // Event system
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    if (callback) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    } else {
      delete this._listeners[event];
    }
  }

  _emit(event, data) {
    const listeners = this._listeners[event];
    if (listeners) {
      for (const cb of listeners) cb(data);
    }
  }

  _startPingLoop() {
    this._pingInterval = setInterval(() => {
      if (this.socket) {
        this.socket.emit(MSG.PING, Date.now());
      }
    }, 3000);
  }

  _stopPingLoop() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  isHost() {
    return this.room?.hostId === this.playerId;
  }

  getPlayerCount() {
    return this.room?.players?.length || 0;
  }
}
