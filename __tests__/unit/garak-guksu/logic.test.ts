import { describe, it, expect } from 'vitest';
import { createGame, KITCHEN } from '../../../public/garak-guksu/src/logic.js';

describe('createGame', () => {
  it('starts with an empty-handed chef at origin, a waiting customer, zero score', () => {
    const g = createGame();
    expect(g.player).toEqual({ x: 0, z: 0, holding: null });
    expect(g.customer).toEqual({ present: true, served: false });
    expect(g.score).toBe(0);
  });
  it('exposes kitchen bounds', () => {
    expect(KITCHEN.minX).toBeLessThan(KITCHEN.maxX);
    expect(KITCHEN.minZ).toBeLessThan(KITCHEN.maxZ);
  });
});
