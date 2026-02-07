import { describe, it, expect } from 'vitest';

// Validate game constants for sanity
const PHYSICS = {
  GRAVITY: 9.81,
  AIR_DENSITY: 1.225,
  AIRCRAFT: {
    MASS: 1000,
    WING_AREA: 20,
    MAX_THRUST: 50000,
    LIFT_COEFFICIENT: 1.2,
    DRAG_COEFFICIENT: 0.03,
    MIN_SPEED: 30,
    MAX_SPEED: 300,
    CRUISE_SPEED: 100,
    PITCH_RATE: 0.8,
    ROLL_RATE: 1.5,
    YAW_RATE: 0.5,
    MIN_ALTITUDE: 10,
    MAX_ALTITUDE: 15000,
    MAX_FUEL: 100,
    FUEL_CONSUMPTION_RATE: 0.02,
  },
};

describe('비행 게임 설정 검증', () => {
  it('최소 속도가 최대 속도보다 작다', () => {
    expect(PHYSICS.AIRCRAFT.MIN_SPEED).toBeLessThan(PHYSICS.AIRCRAFT.MAX_SPEED);
  });

  it('순항 속도가 최소/최대 사이에 있다', () => {
    expect(PHYSICS.AIRCRAFT.CRUISE_SPEED).toBeGreaterThan(PHYSICS.AIRCRAFT.MIN_SPEED);
    expect(PHYSICS.AIRCRAFT.CRUISE_SPEED).toBeLessThan(PHYSICS.AIRCRAFT.MAX_SPEED);
  });

  it('최소 고도가 최대 고도보다 작다', () => {
    expect(PHYSICS.AIRCRAFT.MIN_ALTITUDE).toBeLessThan(PHYSICS.AIRCRAFT.MAX_ALTITUDE);
  });

  it('양력 계수가 항력 계수보다 크다 (비행 가능)', () => {
    expect(PHYSICS.AIRCRAFT.LIFT_COEFFICIENT).toBeGreaterThan(PHYSICS.AIRCRAFT.DRAG_COEFFICIENT);
  });

  it('중력은 양수이다', () => {
    expect(PHYSICS.GRAVITY).toBeGreaterThan(0);
  });

  it('공기 밀도가 현실적인 범위이다', () => {
    expect(PHYSICS.AIR_DENSITY).toBeGreaterThan(0);
    expect(PHYSICS.AIR_DENSITY).toBeLessThan(2);
  });

  it('연료 소모율이 합리적이다 (풀 스로틀 30분 이상 비행 가능)', () => {
    const flightTimeSeconds = PHYSICS.AIRCRAFT.MAX_FUEL / PHYSICS.AIRCRAFT.FUEL_CONSUMPTION_RATE;
    const flightTimeMinutes = flightTimeSeconds / 60;
    expect(flightTimeMinutes).toBeGreaterThan(30);
  });
});
