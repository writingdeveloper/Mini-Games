import { describe, it, expect } from 'vitest';
import { createGame, KITCHEN, movePlayer, clamp, CUSTOMER_SLOTS, serve, SERVE_BASE, near, REACH, STATIONS, setNoodle, putInBlancher, tickBlancher, slotProgress, liftFromBlancher, donenessScore, BLANCH_TIME, pourBroth, garnish, SPICES, ARCHETYPES, ARCHETYPE_KEYS, tickSpawns, SPAWN_INTERVAL, tickCustomers, patienceProgress, WAVES, INTERMISSION, tickWave, comboMult, SPEED_MAX, grade, placeOrPickup, PLACE_SLOTS, toggleDoor, albaTick, ALBA_RESCUE, throwBowl, DOORWAY, PLAYER_RADIUS } from '../../../public/garak-guksu/src/logic.js';

describe('createGame', () => {
  it('starts empty-handed, no customers, serving wave 0, 5 lives', () => {
    const g = createGame(1);
    expect(g.player).toEqual({ x: 0, z: 0, holding: null });
    expect(g.customers).toEqual([]);
    expect(g.blancher.slots).toEqual([null, null]);
    expect(g.lives).toBe(5);
    expect(g.phase).toBe('serving');
    expect(g.wave).toBe(0);
    expect(g.score).toBe(0);
  });
  it('exposes kitchen bounds', () => {
    expect(KITCHEN.minX).toBeLessThan(KITCHEN.maxX);
    expect(KITCHEN.minZ).toBeLessThan(KITCHEN.maxZ);
  });
  it('starts with zero combo and clean stats', () => {
    const g = createGame(1);
    expect(g.combo).toBe(0);
    expect(g.bestCombo).toBe(0);
    expect(g.served).toBe(0);
    expect(g.missed).toBe(0);
  });
  it('starts with an empty placed shelf', () => {
    const g = createGame(1);
    expect(g.placed.length).toBe(PLACE_SLOTS.length);
    expect(g.placed.every((s: unknown) => s === null)).toBe(true);
  });
});

describe('placeOrPickup (미리 만들기 / 놓기 / 집기)', () => {
  it('places a held bowl on the nearest shelf, then picks it back up', () => {
    const g = createGame();
    const slot = PLACE_SLOTS[0];
    g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = { stage: 'done', doneness: 5, spice: 'normal' };
    expect(placeOrPickup(g)).toBe(true);                 // 놓기
    expect(g.player.holding).toBe(null);
    expect(g.placed[0]).toEqual({ stage: 'done', doneness: 5, spice: 'normal' });
    expect(placeOrPickup(g)).toBe(true);                 // 집기
    expect(g.placed[0]).toBe(null);
    expect(g.player.holding).toEqual({ stage: 'done', doneness: 5, spice: 'normal' });
  });
  it('does nothing when far from any shelf slot', () => {
    const g = createGame();
    g.player.x = 0; g.player.z = -2;
    g.player.holding = { stage: 'noodle' };
    expect(placeOrPickup(g)).toBe(false);
    expect(g.player.holding).toEqual({ stage: 'noodle' });
  });
  it('empty-handed near an empty shelf does nothing', () => {
    const g = createGame();
    const slot = PLACE_SLOTS[0];
    g.player.x = slot.x; g.player.z = slot.z;
    expect(placeOrPickup(g)).toBe(false);
    expect(g.player.holding).toBe(null);
  });
});

describe('movePlayer', () => {
  it('moves the chef in the given direction scaled by dt', () => {
    const g = createGame();
    movePlayer(g, { x: 1, z: 0 }, 0.1); // 4.5 * 0.1 = 0.45
    expect(g.player.x).toBeCloseTo(0.45, 5);
    expect(g.player.z).toBe(0);
  });
  it('창고 문 닫힘 → 칸막이(x≈4.38)서 부드럽게 막힘(스냅 없음)', () => {
    const g = createGame();
    movePlayer(g, { x: 1, z: 0 }, 100); // 문 닫힘 기본 → 칸막이 못 넘음
    expect(g.player.x).toBeCloseTo(DOORWAY.x - PLAYER_RADIUS, 5);
  });
  it('문 열고 문간(z≈0)으로는 창고 안(maxX)까지 들어감', () => {
    const g = createGame();
    expect(toggleDoor(g)).toBe(true);
    movePlayer(g, { x: 1, z: 0 }, 100); // z0 = 문간 + 열림 → 통과
    expect(g.player.x).toBe(KITCHEN.maxX);
    expect(toggleDoor(g)).toBe(false);
  });
  it('문 열려도 문간 밖(z≈2)에선 칸막이로 막힘(우회 불가)', () => {
    const g = createGame();
    toggleDoor(g);
    g.player.z = 2.0; // 문간(|z|<0.9) 밖
    movePlayer(g, { x: 1, z: 0 }, 100);
    expect(g.player.x).toBeCloseTo(DOORWAY.x - PLAYER_RADIUS, 5);
  });
  it('창고 안에서 문 닫히면 안에 머묾(칸막이 안쪽서 막힘 — 끼임/스냅 없이)', () => {
    const g = createGame();
    g.player.x = 6.0; g.player.z = 0; // 창고 안(문 닫힘 상태)
    movePlayer(g, { x: -1, z: 0 }, 100); // 주방으로 나가려 함
    expect(g.player.x).toBeCloseTo(DOORWAY.x + PLAYER_RADIUS, 5); // 칸막이 안쪽서 멈춤(문 열어야 나감)
  });
});

describe('albaTick (자율 일꾼 — 조리→배달)', () => {
  function gameWithCustomer(t = 9, spice = 'extra') {
    const g = createGame();
    g.customers.push({ id: 1, slot: 0, archetype: 'worker', order: { spice }, t });
    return g;
  }
  it('급한 손님을 맡아 조리 단계로 전환(targetId·bowlSpice 설정)', () => {
    const g = gameWithCustomer(9, 'extra'); // worker patience 15 → progress 0.6 > ALBA_RESCUE
    albaTick(g, 0.1);
    expect(g.albas[0].phase).toBe('cook');
    expect(g.albas[0].targetId).toBe(1);
    expect(g.albas[0].bowlSpice).toBe('extra');
  });
  it('조리→배달 전체 루프로 서빙(점수·served↑, 손님 제거, 콤보 불변, serveCount↑)', () => {
    const g = gameWithCustomer(7, 'extra');
    let served = false;
    for (let i = 0; i < 130 && !served; i++) { albaTick(g, 0.1); if (g.served > 0) served = true; } // 조리5s+이동
    expect(served).toBe(true);
    expect(g.customers.length).toBe(0);
    expect(g.combo).toBe(0);                 // 알바는 콤보 안 올림(플레이어 몫)
    expect(g.albas[0].serveCount).toBe(1);
    expect(g.albas[0].phase).toBe('idle');
    expect(g.score).toBeGreaterThan(0);
  });
  it('여유로운 손님만 있으면 맡지 않음(idle 유지)', () => {
    const g = gameWithCustomer(0, 'none'); // progress 0 < ALBA_RESCUE
    albaTick(g, 0.1);
    expect(g.albas[0].phase).toBe('idle');
    expect(g.albas[0].targetId).toBe(-1);
  });
  it('맡은 손님이 사라지면(플레이어가 먼저 서빙/이탈) 작업 취소', () => {
    const g = gameWithCustomer(9, 'extra');
    albaTick(g, 0.1);
    expect(g.albas[0].phase).toBe('cook');
    g.customers = [];
    albaTick(g, 0.1);
    expect(g.albas[0].phase).toBe('idle');
    expect(g.albas[0].targetId).toBe(-1);
  });
  it('serving 페이즈가 아니면 동작하지 않음', () => {
    const g = gameWithCustomer(9, 'extra');
    g.phase = 'intermission';
    expect(albaTick(g, 0.1)).toBe(null);
    expect(g.albas[0].phase).toBe('idle');
  });
  it('알바 2명이 서로 다른 손님을 맡음(중복 방지)', () => {
    const g = createGame();
    g.customers.push({ id: 1, slot: 0, archetype: 'worker', order: { spice: 'none' }, t: 9 });
    g.customers.push({ id: 2, slot: 1, archetype: 'worker', order: { spice: 'none' }, t: 9 });
    albaTick(g, 0.1);
    expect(g.albas[0].targetId).toBe(1);
    expect(g.albas[1].targetId).toBe(2);
  });
  it('ALBA_RESCUE 임계값이 0~1 사이', () => {
    expect(ALBA_RESCUE).toBeGreaterThan(0);
    expect(ALBA_RESCUE).toBeLessThan(1);
  });
});

describe('throwBowl (국수 던지기)', () => {
  it('완성 그릇을 들고 있으면 손을 비우고 그릇을 반환', () => {
    const g = createGame();
    g.player.holding = { stage: 'done', spice: 'normal', doneness: 50 };
    const b = throwBowl(g);
    expect(b).toEqual({ stage: 'done', spice: 'normal', doneness: 50 });
    expect(g.player.holding).toBe(null);
  });
  it('미완성 그릇/빈손은 던지지 않음(null)', () => {
    const g = createGame();
    expect(throwBowl(g)).toBe(null);          // 빈손
    g.player.holding = { stage: 'noodle' };
    expect(throwBowl(g)).toBe(null);          // 미완성
    expect(g.player.holding).not.toBe(null);  // 그대로 유지
  });
});

describe('충돌 (BLOCKERS — 에셋 관통 방지)', () => {
  it('조리대로 걸어 들어가도 관통하지 않고 표면 밖에 멈춘다', () => {
    const g = createGame();
    g.player.x = STATIONS.broth.x; g.player.z = 0.6;                 // 육수 조리대(1,-1.5) 앞
    for (let i = 0; i < 80; i++) movePlayer(g, { x: 0, z: -1 }, 0.05); // -z 로 계속 밀어붙임
    const d = Math.hypot(g.player.x - STATIONS.broth.x, g.player.z - STATIONS.broth.z);
    expect(d).toBeGreaterThan(0.9);   // 0.8 + 0.32 = 1.12 근처 — 절대 0(관통)이 아님
  });
  it('충돌로 멈춰도 조리 거리(REACH)는 유지된다', () => {
    const g = createGame();
    g.player.x = STATIONS.broth.x; g.player.z = 0.6;
    for (let i = 0; i < 80; i++) movePlayer(g, { x: 0, z: -1 }, 0.05);
    expect(near(g.player.x, g.player.z, STATIONS.broth.x, STATIONS.broth.z)).toBe(true);
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

describe('comboMult', () => {
  it('1 at combo≤1, +0.4 per streak, capped at 3 (×3 at streak 6)', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(1)).toBe(1);
    expect(comboMult(2)).toBeCloseTo(1.4, 5);
    expect(comboMult(6)).toBe(3);
    expect(comboMult(10)).toBe(3); // capped
  });
});

describe('serve (콤보 · 속도 · 정확)', () => {
  function customerAt(g, slot, spice, arche = 'student') {
    const c = { id: g._nextId++, slot, archetype: arche, order: { spice }, t: 0 };
    g.customers.push(c); return c;
  }
  function doneBowl(spice, doneness = 50) { return { stage: 'done', doneness, spice }; }

  it('correct serve: combo++, full-speed bonus, score = (base+doneness+speed+accuracy)×mult', () => {
    const g = createGame(1);
    customerAt(g, 1, 'extra'); // t=0 → patienceProgress 0 → speed max
    const slot = CUSTOMER_SLOTS[1]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.combo).toBe(1);
    expect(g.bestCombo).toBe(1);
    expect(g.served).toBe(1);
    // (100 + 50 + 50 + 30) × comboMult(1)=1 = 230
    expect(g.score).toBe(230);
  });
  it('second correct serve multiplies by comboMult(2)=1.4', () => {
    const g = createGame(1);
    g.combo = 1; // already one in
    customerAt(g, 0, 'none');
    const slot = CUSTOMER_SLOTS[0]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('none', 50); // t=0 → speed 50
    serve(g);
    expect(g.combo).toBe(2);
    // (100+50+50+30) × 1.4 = 322
    expect(g.score).toBe(322);
  });
  it('wrong spice: half base, no bonus, combo resets', () => {
    const g = createGame(1);
    g.combo = 4;
    customerAt(g, 0, 'none');
    const slot = CUSTOMER_SLOTS[0]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.score).toBe(50); // base/2
    expect(g.combo).toBe(0);
    expect(g.served).toBe(0); // mis-serve doesn't count as satisfied
  });
  it('speed bonus scales with remaining patience', () => {
    const g = createGame(1);
    const c = customerAt(g, 2, 'normal', 'granny'); // patience 25
    c.t = 12.5; // half patience → speed 25
    const slot = CUSTOMER_SLOTS[2]; g.player.x = slot.x; g.player.z = slot.z;
    g.player.holding = doneBowl('normal', 20);
    serve(g);
    // (100 + 20 + 25 + 30) × 1 = 175
    expect(g.score).toBe(175);
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
  it('serves the NEARER of two in-range customers', () => {
    const g = createGame(1);
    customerAt(g, 1, 'normal');           // slot 1 = x:-1
    const nearer = customerAt(g, 2, 'extra'); // slot 2 = x:1
    g.player.x = 1; g.player.z = 3.2;     // exactly at slot 2
    g.player.holding = doneBowl('extra', 50);
    expect(serve(g)).toBe(true);
    expect(g.customers.find((c) => c.id === nearer.id)).toBeUndefined();
    expect(g.customers.length).toBe(1);   // the farther one remains
  });
});

describe('미리만들기 서빙 (진열대 버퍼 보상)', () => {
  it('빈손이어도 가까운 진열대의 완성 그릇으로 서빙한다', () => {
    const g = createGame(1);
    g.placed[0] = { stage: 'done', doneness: 50, spice: 'extra' };  // 미리 만들어 둠
    const shelf = PLACE_SLOTS[0];                                    // (-2.5, 2.3)
    g.player.x = shelf.x; g.player.z = shelf.z;
    g.customers.push({ id: g._nextId++, slot: 0, archetype: 'student', order: { spice: 'extra' }, t: 0 }); // slot0(-3,3.2) 사정권
    expect(g.player.holding).toBe(null);
    expect(serve(g)).toBe(true);
    expect(g.placed[0]).toBe(null);   // 진열대에서 나감
    expect(g.served).toBe(1);
    expect(g.combo).toBe(1);
  });
  it('손에 완성 그릇이 있으면 손 그릇을 먼저 쓰고 진열대는 남긴다', () => {
    const g = createGame(1);
    g.placed[0] = { stage: 'done', doneness: 50, spice: 'extra' };
    const shelf = PLACE_SLOTS[0];
    g.player.x = shelf.x; g.player.z = shelf.z;
    g.player.holding = { stage: 'done', doneness: 50, spice: 'extra' };
    g.customers.push({ id: g._nextId++, slot: 0, archetype: 'student', order: { spice: 'extra' }, t: 0 });
    expect(serve(g)).toBe(true);
    expect(g.player.holding).toBe(null);     // 손 그릇 소진
    expect(g.placed[0]).not.toBe(null);      // 진열대는 그대로
  });
});

describe('grade (등급/칭호)', () => {
  it('perfect run wins as 역전의 명인', () => {
    const g = createGame(1); g.phase = 'won'; g.missed = 0; g.served = 12;
    expect(grade(g)).toBe('역전의 명인');
  });
  it('many walkouts → 기차 도살자', () => {
    const g = createGame(1); g.missed = 6;
    expect(grade(g)).toBe('기차 도살자');
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

describe('멀티 채반 (slots)', () => {
  function atBlancher(g) {
    g.player.x = STATIONS.blancher.x; g.player.z = STATIONS.blancher.z;
    return g;
  }
  it('putInBlancher fills the first free slot, freeing hands', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' };
    expect(putInBlancher(g)).toBe(true);
    expect(g.player.holding).toBe(null);
    expect(g.blancher.slots[0]).toEqual({ t: 0 });
    expect(g.blancher.slots[1]).toBe(null);
  });
  it('two noodles fill both slots; a third is refused', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' }; putInBlancher(g);
    g.player.holding = { stage: 'noodle' }; putInBlancher(g);
    expect(g.blancher.slots.every((s) => s !== null)).toBe(true);
    g.player.holding = { stage: 'noodle' };
    expect(putInBlancher(g)).toBe(false); // no free slot
  });
  it('tickBlancher advances all slots; slotProgress = t / BLANCH_TIME', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' }; putInBlancher(g);
    tickBlancher(g, BLANCH_TIME * 0.8);
    expect(slotProgress(g.blancher.slots[0])).toBeCloseTo(0.8, 5);
  });
  it('liftFromBlancher takes the MOST-cooked slot, scored by doneness', () => {
    const g = atBlancher(createGame(1));
    g.player.holding = { stage: 'noodle' }; putInBlancher(g); // slot 0
    tickBlancher(g, BLANCH_TIME * 0.8);                        // slot 0 at 0.8
    g.player.holding = { stage: 'noodle' }; putInBlancher(g); // slot 1 (t=0)
    expect(liftFromBlancher(g)).toBe(true);
    expect(g.player.holding).toEqual({ stage: 'blanched', doneness: 50 }); // slot 0 (more cooked)
    expect(g.blancher.slots[0]).toBe(null);
    expect(g.blancher.slots[1]).not.toBe(null);
  });
  it('liftFromBlancher does nothing with all slots empty', () => {
    const g = atBlancher(createGame(1));
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
    g.wave = 4; g.dwellLeft = WAVES[4].dwell; // wave 4 count=8 > 4 slots
    for (let i = 0; i < 50; i++) tickSpawns(g, SPAWN_INTERVAL);
    expect(g.customers.length).toBe(CUSTOMER_SLOTS.length);
    const slots = g.customers.map((c) => c.slot);
    expect(new Set(slots).size).toBe(slots.length); // unique
  });
  it('does not burst-spawn when a slot frees after the counter was full', () => {
    const g = createGame(1);
    g.wave = 4; g.dwellLeft = WAVES[4].dwell; // wave 4 count=8 > 4 slots
    for (let i = 0; i < 20; i++) tickSpawns(g, SPAWN_INTERVAL); // fill all 4
    expect(g.customers.length).toBe(CUSTOMER_SLOTS.length);
    g.customers.shift(); // a slot frees
    g.waveSpawned = CUSTOMER_SLOTS.length; // reset waveSpawned to match actual spawned
    tickSpawns(g, 0.1);  // tiny dt — timer was reset while full, so NO instant spawn
    expect(g.customers.length).toBe(CUSTOMER_SLOTS.length - 1);
    tickSpawns(g, SPAWN_INTERVAL); // after a full interval it spawns again
    expect(g.customers.length).toBe(CUSTOMER_SLOTS.length);
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
  it('lives hitting 0 sets phase to over', () => {
    const g = createGame(1);
    g.lives = 1;
    withOneCustomer(g, 'soldier');
    tickCustomers(g, 13);
    expect(g.lives).toBe(0);
    expect(g.phase).toBe('over');
  });
  it('does not advance once phase is not serving', () => {
    const g = createGame(1);
    g.phase = 'over';
    const c = withOneCustomer(g);
    tickCustomers(g, 100);
    expect(c.t).toBe(0);
  });
  it('multiple simultaneous walkouts each cost a life', () => {
    const g = createGame(1);
    g.customers.push({ id: 1, slot: 0, archetype: 'soldier', order: { spice: 'normal' }, t: 0 });
    g.customers.push({ id: 2, slot: 1, archetype: 'soldier', order: { spice: 'normal' }, t: 0 });
    tickCustomers(g, 13); // both past soldier patience 12
    expect(g.customers.length).toBe(0);
    expect(g.lives).toBe(3); // 5 - 2
  });
  it('a walkout increments missed and resets combo', () => {
    const g = createGame(1); g.combo = 4;
    g.customers.push({ id: 1, slot: 0, archetype: 'soldier', order: { spice: 'normal' }, t: 0 });
    tickCustomers(g, 13);
    expect(g.missed).toBe(1);
    expect(g.combo).toBe(0);
  });
});

describe('waves & phase (setup + spawn gate)', () => {
  it('starts on wave 0, serving, with the era-1 dwell timer', () => {
    const g = createGame(1);
    expect(g.wave).toBe(0);
    expect(g.phase).toBe('serving');
    expect(g.dwellLeft).toBe(WAVES[0].dwell);
    expect(g.waveSpawned).toBe(0);
  });
  it('tickSpawns stops after the wave quota (count) is reached', () => {
    const g = createGame(1);
    // wave 0 count is small; spawn many intervals, freeing slots each time
    for (let i = 0; i < 30; i++) { tickSpawns(g, SPAWN_INTERVAL); g.customers = []; }
    expect(g.waveSpawned).toBe(WAVES[0].count);
  });
  it('tickSpawns does nothing unless phase is serving', () => {
    const g = createGame(1);
    g.phase = 'intermission';
    tickSpawns(g, SPAWN_INTERVAL);
    expect(g.customers.length).toBe(0);
  });
});

describe('tickWave (정차 타이머 → 전환 → 완주)', () => {
  it('dwell timer counts down while serving', () => {
    const g = createGame(1);
    tickWave(g, 10);
    expect(g.dwellLeft).toBe(WAVES[0].dwell - 10);
    expect(g.phase).toBe('serving');
  });
  it('dwell reaching 0 clears customers and enters intermission (no life penalty)', () => {
    const g = createGame(1);
    g.customers.push({ id: 1, slot: 0, archetype: 'granny', order: { spice: 'none' }, t: 0 });
    tickWave(g, WAVES[0].dwell + 1);
    expect(g.customers).toEqual([]);     // train departed
    expect(g.lives).toBe(5);             // departure is NOT a life loss
    expect(g.phase).toBe('intermission');
    expect(g.wave).toBe(1);
  });
  it('intermission elapsing starts the next wave with its dwell', () => {
    const g = createGame(1);
    tickWave(g, WAVES[0].dwell + 1);     // → intermission, wave 1
    tickWave(g, INTERMISSION + 0.1);     // → serving wave 1
    expect(g.phase).toBe('serving');
    expect(g.dwellLeft).toBe(WAVES[1].dwell);
    expect(g.waveSpawned).toBe(0);
  });
  it('finishing the last wave wins', () => {
    const g = createGame(1);
    g.wave = WAVES.length - 1; g.dwellLeft = WAVES[g.wave].dwell;
    tickWave(g, WAVES[g.wave].dwell + 1);
    expect(g.phase).toBe('won');
  });
  it('does nothing once won/over', () => {
    const g = createGame(1);
    g.phase = 'won';
    tickWave(g, 100);
    expect(g.wave).toBe(0);
  });
});
