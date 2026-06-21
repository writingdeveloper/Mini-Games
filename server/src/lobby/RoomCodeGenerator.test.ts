import { describe, it, expect } from 'vitest';
import { generateRoomCode } from './RoomCodeGenerator.js';

const SAFE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

describe('generateRoomCode', () => {
  it('produces a 6-char code from the confusion-free alphabet', () => {
    expect(generateRoomCode(new Set())).toMatch(SAFE);
  });

  it('never collides with an existing code and stays unique across many draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode(seen);
      expect(code).toMatch(SAFE);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
    expect(seen.size).toBe(500);
  });
});
