import { CONFIG } from './config.js';

export const SABOTAGE = [
  { key: 'gust',    name: '강풍',  emoji: '💨' },
  { key: 'grease',  name: '기름',  emoji: '🛢️' },
  { key: 'seagull', name: '갈매기', emoji: '🐦' },
  { key: 'ketchup', name: '케첩',  emoji: '🍅' },
];

/**
 * Pick a random sabotage key using the provided seeded rng.
 * @param {() => number} rng — a mulberry32 (or compatible) rng instance
 * @returns {string} one of the SABOTAGE keys
 */
export function grantSabotage(rng) {
  return SABOTAGE[Math.floor(rng() * SABOTAGE.length)].key;
}

/**
 * Whether the player should be granted a new sabotage.
 * @param {number} charge — current charge level
 * @param {string|null} held — currently held sabotage key, or null
 * @param {number} [cost] — charge threshold (defaults to CONFIG.sabotage.grantCost)
 * @returns {boolean}
 */
export function shouldGrant(charge, held, cost = CONFIG.sabotage.grantCost) {
  return !held && charge >= cost;
}

/**
 * Look up a SABOTAGE entry by key.
 * @param {string} key
 * @returns {{ key: string, name: string, emoji: string } | null}
 */
export function sabotageByKey(key) {
  return SABOTAGE.find((s) => s.key === key) ?? null;
}
