import { describe, it, expect } from 'vitest';
import { createGame, KITCHEN, movePlayer, clamp, CUSTOMER_SLOT, serve, SERVE_POINTS, near, REACH, STATIONS, setNoodle, putInBlancher, tickBlancher, blancherProgress, liftFromBlancher, donenessScore, BLANCH_TIME } from '../../../public/garak-guksu/src/logic.js';

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

describe('movePlayer', () => {
  it('moves the chef in the given direction scaled by dt', () => {
    const g = createGame();
    movePlayer(g, { x: 1, z: 0 }, 0.1); // 4.5 * 0.1 = 0.45
    expect(g.player.x).toBeCloseTo(0.45, 5);
    expect(g.player.z).toBe(0);
  });
  it('clamps to kitchen bounds', () => {
    const g = createGame();
    movePlayer(g, { x: 1, z: 0 }, 100); // way past maxX
    expect(g.player.x).toBe(KITCHEN.maxX);
  });
});

describe('clamp', () => {
  it('bounds a value', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe('interact (cook station)', () => {
  it('picks up a bowl when empty-handed AND at the station', () => {
    const g = createGame();
    g.player.x = COOK_STATION.x; g.player.z = COOK_STATION.z;
    expect(interact(g)).toBe(true);
    expect(g.player.holding).toBe('bowl');
  });
  it('does nothing when far from the station', () => {
    const g = createGame(); // chef at origin, station at (2,-1.5)
    expect(interact(g)).toBe(false);
    expect(g.player.holding).toBe(null);
  });
  it('does nothing when already holding', () => {
    const g = createGame();
    g.player.x = COOK_STATION.x; g.player.z = COOK_STATION.z;
    g.player.holding = 'bowl';
    expect(interact(g)).toBe(false);
  });
});

describe('near (proximity boundary)', () => {
  it('is true just inside REACH and false just outside', () => {
    expect(near(0, 0, 0, REACH - 0.01)).toBe(true);
    expect(near(0, 0, 0, REACH + 0.01)).toBe(false);
  });
});

describe('serve (customer)', () => {
  function chefAtCustomerWithBowl() {
    const g = createGame();
    g.player.x = CUSTOMER_SLOT.x; g.player.z = CUSTOMER_SLOT.z;
    g.player.holding = 'bowl';
    return g;
  }
  it('serves: clears hands, scores, customer leaves satisfied', () => {
    const g = chefAtCustomerWithBowl();
    expect(serve(g)).toBe(true);
    expect(g.player.holding).toBe(null);
    expect(g.customer).toEqual({ present: false, served: true });
    expect(g.score).toBe(SERVE_POINTS);
  });
  it('does nothing without a bowl', () => {
    const g = chefAtCustomerWithBowl();
    g.player.holding = null;
    expect(serve(g)).toBe(false);
    expect(g.score).toBe(0);
  });
  it('does nothing when far from the customer', () => {
    const g = createGame();
    g.player.holding = 'bowl'; // at origin, customer at (0,3.2)
    expect(serve(g)).toBe(false);
  });
});

describe('setNoodle (사리세팅대)', () => {
  it('puts a noodle bowl in empty hands at the setting station', () => {
    const g = createGame(1);
    g.player.x = STATIONS.setting.x; g.player.z = STATIONS.setting.z;
    expect(setNoodle(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'noodle' });
  });
  it('does nothing away from the station or with full hands', () => {
    const g = createGame(1);
    expect(setNoodle(g)).toBe(false);
  });
});

describe('donenessScore', () => {
  it('perfect in [0.75,0.85], good in [0.7,0.9], else 0', () => {
    expect(donenessScore(0.80)).toBe(50);
    expect(donenessScore(0.72)).toBe(20);
    expect(donenessScore(0.88)).toBe(20);
    expect(donenessScore(0.5)).toBe(0);
    expect(donenessScore(1.0)).toBe(0);
  });
});

describe('데치기 채반 (putIn / tick / lift)', () => {
  function atBlancherWithNoodle() {
    const g = createGame(1);
    g.player.x = STATIONS.blancher.x; g.player.z = STATIONS.blancher.z;
    g.player.holding = { stage: 'noodle' };
    return g;
  }
  it('putInBlancher moves the noodle bowl into the basket, freeing hands', () => {
    const g = atBlancherWithNoodle();
    expect(putInBlancher(g)).toBe(true);
    expect(g.player.holding).toBe(null);
    expect(g.blancher.bowl).toEqual({ t: 0 });
  });
  it('tickBlancher advances time and progress = t / BLANCH_TIME', () => {
    const g = atBlancherWithNoodle();
    putInBlancher(g);
    tickBlancher(g, BLANCH_TIME * 0.8);
    expect(blancherProgress(g)).toBeCloseTo(0.8, 5);
  });
  it('liftFromBlancher gives a blanched bowl scored by doneness', () => {
    const g = atBlancherWithNoodle();
    putInBlancher(g);
    tickBlancher(g, BLANCH_TIME * 0.8);
    expect(liftFromBlancher(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'blanched', doneness: 50 });
    expect(g.blancher.bowl).toBe(null);
  });
  it('liftFromBlancher does nothing with an empty basket', () => {
    const g = createGame(1);
    g.player.x = STATIONS.blancher.x; g.player.z = STATIONS.blancher.z;
    expect(liftFromBlancher(g)).toBe(false);
  });
});
