import { randomInt } from 'node:crypto';

// Characters that avoid confusion (no 0/O, 1/I/L)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(existingCodes: Set<string>): string {
  let code: string;
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      // CSPRNG + unbiased (randomInt), not Math.random() — codes are the only thing
      // protecting a private room, so they must not be predictable/enumerable.
      code += CHARS[randomInt(CHARS.length)];
    }
    attempts++;
    if (attempts > 1000) {
      throw new Error('Failed to generate unique room code');
    }
  } while (existingCodes.has(code));
  return code;
}
