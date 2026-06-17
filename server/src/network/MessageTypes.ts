// Shared message types between server and client

// Lobby events
export const MSG = {
  // Room management
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_UPDATE: 'room:update',
  ROOM_READY: 'room:ready',
  ROOM_LIST: 'room:list',
  ROOM_ERROR: 'room:error',

  // Game lifecycle
  GAME_COUNTDOWN: 'game:countdown',
  GAME_START: 'game:start',
  GAME_STATE: 'game:state',
  GAME_INPUT: 'game:input',
  GAME_ACTION: 'game:action',
  GAME_EVENT: 'game:event',
  GAME_END: 'game:end',

  // Diagnostics
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
} as const;

export type GameType = 'escape' | 'flight' | 'survival';

export type RoomState = 'waiting' | 'countdown' | 'playing' | 'finished';

export interface PlayerInfo {
  id: string;
  name: string;
  ready: boolean;
  color: string;
}

export interface RoomInfo {
  code: string;
  gameType: GameType;
  state: RoomState;
  players: PlayerInfo[];
  hostId: string;
  maxPlayers: number;
}

export interface RoomCreatePayload {
  gameType: GameType;
  playerName: string;
}

export interface RoomJoinPayload {
  code: string;
  playerName: string;
}

export interface GameInputPayload {
  seq: number;
  input: Record<string, unknown>;
  timestamp: number;
}

export interface GameActionPayload {
  type: string;
  data: Record<string, unknown>;
}
