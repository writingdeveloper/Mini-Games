export const PORT = parseInt(process.env.PORT || '3001', 10);

export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

export const MAX_ROOMS = 50;

export const MAX_PLAYERS_PER_ROOM = 4;

export const MIN_PLAYERS_TO_START = 2;

/** Room idle timeout in milliseconds (5 minutes) */
export const ROOM_IDLE_TIMEOUT_MS = 300_000;

/** Reconnection grace period in milliseconds (30 seconds) */
export const RECONNECT_GRACE_MS = 30_000;

/** Server tick rates (ticks per second) per game type */
export const TICK_RATES: Record<string, number> = {
  escape: 10,
  flight: 20,
  survival: 15,
};

export const DB_PATH = process.env.DB_PATH || './data/minigames.db';
