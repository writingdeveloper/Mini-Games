import { describe, it, expect } from 'vitest';
import { createGame, KITCHEN, movePlayer, clamp, CUSTOMER_SLOTS, serve, SERVE_BASE, near, REACH, STATIONS, setNoodle, putInBlancher, tickBlancher, blancherProgress, liftFromBlancher, donenessScore, BLANCH_TIME, pourBroth, garnish, SPICES, ARCHETYPES, ARCHETYPE_KEYS, tickSpawns, SPAWN_INTERVAL, tickCustomers, patienceProgress } from '../../../public/garak-guksu/src/logic.js';

describe('createGame', () => {
  it('starts with an empty-handed chef at origin, a waiting customer, zero score', () => {
    const g = createGame();
    expect(g.player).toEqual({ x: 0, z: 0, holding: null });
    expect(g.customer).toMatchObject({ present: true, served: false });
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

describe('near (proximity boundary)', () => {
  it('is true just inside REACH and false just outside', () => {
    expect(near(0, 0, 0, REACH - 0.01)).toBe(true);
    expect(near(0, 0, 0, REACH + 0.01)).toBe(false);
  });
});

describe('serve (가장 가까운 손님)', () => {
  function customerAt(g, slot, spice, arche = 'student') {
    const c = { id: g._nextId++, slot, archetype: arche, order: { spice }, t: 0 };
    g.customers.push(c);
    return c;
  }
  function doneBowl(spice, doneness = 50) { return { stage: 'done', doneness, spice }; }

  it('serves the nearest in-range customer, scoring completeness + accuracy', () => {
    const g = createGame(1);
    const c = customerAt(g, 1, 'extra'); // slot 1 = x:-1
    const slot = CUSTOMER_SLOTS[1];
    g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(SERVE_BASE + 50 + 30);
    expect(g.player.holding).toBe(null);
    expect(g.customers.find((x) => x.id === c.id)).toBeUndefined(); // left satisfied
  });
  it('omits accuracy when spice is wrong', () => {
    const g = createGame(1);
    customerAt(g, 0, 'none');
    const slot = CUSTOMER_SLOTS[0];
    g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 20);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(SERVE_BASE + 20);
  });
  it('refuses when no customer is in range', () => {
    const g = createGame(1);
    customerAt(g, 3, 'normal'); // far slot
    g.player.holding = doneBowl('normal', 50); // chef at origin
    expect(serve(g)).toBe(false);
    expect(g.score).toBe(0);
  });
  it('refuses a non-done bowl', () => {
    const g = createGame(1);
    customerAt(g, 0, 'normal');
    const slot = CUSTOMER_SLOTS[0];
    g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = { stage: 'brothed', doneness: 50 };
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

describe('육수 + 마감 (pourBroth / garnish)', () => {
  it('pourBroth turns a blanched bowl into a brothed one, keeping doneness', () => {
    const g = createGame(1);
    g.player.x = STATIONS.broth.x; g.player.z = STATIONS.broth.z;
    g.player.holding = { stage: 'blanched', doneness: 50 };
    expect(pourBroth(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'brothed', doneness: 50 });
  });
  it('pourBroth does nothing on a non-blanched bowl', () => {
    const g = createGame(1);
    g.player.x = STATIONS.broth.x; g.player.z = STATIONS.broth.z;
    g.player.holding = { stage: 'noodle' };
    expect(pourBroth(g)).toBe(false);
  });
  it('garnish finishes a brothed bowl with the chosen spice', () => {
    const g = createGame(1);
    g.player.x = STATIONS.garnish.x; g.player.z = STATIONS.garnish.z;
    g.player.holding = { stage: 'brothed', doneness: 20 };
    expect(garnish(g, 'extra')).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'done', doneness: 20, spice: 'extra' });
  });
  it('garnish rejects an invalid spice or non-brothed bowl', () => {
    const g = createGame(1);
    g.player.x = STATIONS.garnish.x; g.player.z = STATIONS.garnish.z;
    g.player.holding = { stage: 'brothed', doneness: 20 };
    expect(garnish(g, 'ketchup')).toBe(false);
    g.player.holding = { stage: 'noodle' };
    expect(garnish(g, 'normal')).toBe(false);
  });
});

describe('스폰 (tickSpawns)', () => {
  it('spawns into a free slot after SPAWN_INTERVAL with a valid archetype + order', () => {
    const g = createGame(1);
    expect(g.customers).toEqual([]);
    tickSpawns(g, SPAWN_INTERVAL); // exactly the interval
    expect(g.customers.length).toBe(1);
    const c = g.customers[0];
    expect(ARCHETYPE_KEYS).toContain(c.archetype);
    expect(typeof c.slot).toBe('number');
    expect(SPICES).toContain(c.order.spice);
    expect(c.t).toBe(0);
  });
  it('does not spawn before the interval elapses', () => {
    const g = createGame(1);
    tickSpawns(g, SPAWN_INTERVAL * 0.5);
    expect(g.customers.length).toBe(0);
  });
  it('fills at most all slots (never double-books a slot)', () => {
    const g = createGame(1);
    for (let i = 0; i < 50; i++) tickSpawns(g, SPAWN_INTERVAL);
    expect(g.customers.length).toBe(CUSTOMER_SLOTS.length);
    const slots = g.customers.map((c) => c.slot);
    expect(new Set(slots).size).toBe(slots.length); // unique
  });
});

describe('초조 + 이탈 (tickCustomers / lives)', () => {
  function withOneCustomer(g, arche = 'soldier') {
    g.customers.push({ id: 1, slot: 0, archetype: arche, order: { spice: 'normal' }, t: 0 });
    return g.customers[0];
  }
  it('patienceProgress is t / patience', () => {
    const g = createGame(1);
    const c = withOneCustomer(g, 'soldier'); // patience 12
    c.t = 6;
    expect(patienceProgress(c)).toBeCloseTo(0.5, 5);
  });
  it('a customer past patience leaves and costs a life', () => {
    const g = createGame(1);
    withOneCustomer(g, 'soldier'); // patience 12
    tickCustomers(g, 12.1);
    expect(g.customers.length).toBe(0);
    expect(g.lives).toBe(4);
  });
  it('lives hitting 0 sets over', () => {
    const g = createGame(1);
    g.lives = 1;
    withOneCustomer(g, 'soldier');
    tickCustomers(g, 13);
    expect(g.lives).toBe(0);
    expect(g.over).toBe(true);
  });
  it('does not advance once over', () => {
    const g = createGame(1);
    g.over = true;
    const c = withOneCustomer(g);
    tickCustomers(g, 100);
    expect(c.t).toBe(0);
  });
});
