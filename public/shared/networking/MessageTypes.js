// Shared message types - must match server/src/network/MessageTypes.ts
export const MSG = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_UPDATE: 'room:update',
  ROOM_READY: 'room:ready',
  ROOM_LIST: 'room:list',
  ROOM_ERROR: 'room:error',

  GAME_COUNTDOWN: 'game:countdown',
  GAME_START: 'game:start',
  GAME_STATE: 'game:state',
  GAME_INPUT: 'game:input',
  GAME_ACTION: 'game:action',
  GAME_EVENT: 'game:event',
  GAME_END: 'game:end',

  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
};
