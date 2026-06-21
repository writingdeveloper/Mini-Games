import { describe, it, expect } from 'vitest';
import { isPlainObject, isValidGameType, normalizeRoomCode, sanitizePlayerName, MAX_NAME_LEN } from './validation.js';

describe('isPlainObject', () => {
  it('accepts plain objects, rejects primitives / arrays / null', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject('x')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject([])).toBe(false);
  });
});

describe('isValidGameType', () => {
  it('whitelists exactly escape / flight / survival', () => {
    expect(isValidGameType('escape')).toBe(true);
    expect(isValidGameType('flight')).toBe(true);
    expect(isValidGameType('survival')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isValidGameType('frytower')).toBe(false);
    expect(isValidGameType('')).toBe(false);
    expect(isValidGameType(null)).toBe(false);
    expect(isValidGameType(123)).toBe(false);
    expect(isValidGameType({})).toBe(false);
  });
});

describe('normalizeRoomCode', () => {
  it('uppercases + trims a valid 6-char code', () => {
    expect(normalizeRoomCode('abc123')).toBe('ABC123');
    expect(normalizeRoomCode('  ABC123  ')).toBe('ABC123');
  });
  it('rejects wrong length / non-alnum / non-string', () => {
    expect(normalizeRoomCode('ABC12')).toBeNull();
    expect(normalizeRoomCode('ABC1234')).toBeNull();
    expect(normalizeRoomCode('ABC!23')).toBeNull();
    expect(normalizeRoomCode(123456)).toBeNull();
    expect(normalizeRoomCode(null)).toBeNull();
    expect(normalizeRoomCode({})).toBeNull();
  });
});

describe('sanitizePlayerName', () => {
  it('strips HTML angle brackets so XSS payloads become inert text', () => {
    expect(sanitizePlayerName('<img src=x>')).toBe('img src=x'); // no '<'/'>' -> cannot form a tag
    expect(sanitizePlayerName('<script>')).toBe('script');
  });
  it('strips control characters', () => {
    expect(sanitizePlayerName('a\x00b\x1Fc\x7Fd')).toBe('abcd');
  });
  it('caps length at MAX_NAME_LEN', () => {
    expect(sanitizePlayerName('a'.repeat(100)).length).toBe(MAX_NAME_LEN);
  });
  it('coerces non-strings / empty / whitespace to the fallback', () => {
    expect(sanitizePlayerName(null)).toBe('Player');
    expect(sanitizePlayerName(123)).toBe('Player');
    expect(sanitizePlayerName('   ')).toBe('Player');
    expect(sanitizePlayerName('')).toBe('Player');
    expect(sanitizePlayerName({})).toBe('Player');
  });
  it('keeps a normal trimmed name', () => {
    expect(sanitizePlayerName('  Reze  ')).toBe('Reze');
  });
});
