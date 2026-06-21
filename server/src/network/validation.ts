// Boundary validation/sanitization for UNTRUSTED socket payloads.
// Every socket handler must run client input through these before use: clients can emit any
// shape (a string, null, a giant object), so dereferencing payload fields unguarded is a
// remote crash (TypeError -> unhandled -> process exit) and an injection vector.
import type { GameType } from './MessageTypes.js';

const GAME_TYPES: readonly GameType[] = ['escape', 'flight', 'survival'];
const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;
// strip C0/DEL control chars and HTML angle brackets (hex escapes; no literal control chars in source)
const UNSAFE_NAME_CHARS = /[\x00-\x1F\x7F<>]/g;
export const MAX_NAME_LEN = 24;

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isValidGameType(v: unknown): v is GameType {
  return typeof v === 'string' && (GAME_TYPES as readonly string[]).includes(v);
}

/** Normalize an untrusted room code to the canonical 6-char uppercase form, or null if invalid. */
export function normalizeRoomCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const code = v.trim().toUpperCase();
  return ROOM_CODE_RE.test(code) ? code : null;
}

/**
 * Coerce any untrusted value into a safe display name: string, trimmed, length-capped, with
 * control chars and HTML angle brackets stripped. Defense-in-depth — the client must ALSO render
 * names as text (textContent), never innerHTML. Never throws; falls back to 'Player'.
 */
export function sanitizePlayerName(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  const s = (typeof v === 'string' ? v : '').replace(UNSAFE_NAME_CHARS, '').trim().slice(0, MAX_NAME_LEN);
  return s.length > 0 ? s : 'Player';
}
