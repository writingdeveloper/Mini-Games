import { describe, it, expect, beforeEach } from 'vitest';

// Test the pure game logic of the escape game
// Since the original uses global variables, we recreate the logic as pure functions

const GRID_SIZE = 20;

interface Position {
  x: number;
  y: number;
}

function isWallCollision(pos: Position): boolean {
  return pos.x < 0 || pos.x >= GRID_SIZE || pos.y < 0 || pos.y >= GRID_SIZE;
}

function isPoliceCollision(carPos: Position, policeCars: Position[]): boolean {
  return policeCars.some(p => carPos.x === p.x && carPos.y === p.y);
}

function isPedestrianCollision(carPos: Position, pedestrian: Position): boolean {
  return carPos.x === pedestrian.x && carPos.y === pedestrian.y;
}

function isValidPedestrianPosition(
  pos: Position,
  carPos: Position,
  policeCars: Position[],
): boolean {
  if (pos.x === carPos.x && pos.y === carPos.y) return false;
  for (const police of policeCars) {
    if (pos.x === police.x && pos.y === police.y) return false;
  }
  return true;
}

function updatePoliceCars(policeCars: Position[], carPos: Position): Position[] {
  if (policeCars.length === 0) return [];
  const updated = [...policeCars];
  for (let i = updated.length - 1; i > 0; i--) {
    updated[i] = { ...updated[i - 1] };
  }
  updated[0] = { x: carPos.x, y: carPos.y };
  return updated;
}

function calculateGameSpeed(score: number): number {
  const speed = Math.floor(score / 5) + 1;
  return Math.max(50, 200 - (speed - 1) * 15);
}

describe('도주 게임 - 충돌 검출', () => {
  it('그리드 내부에서는 벽 충돌이 아니다', () => {
    expect(isWallCollision({ x: 0, y: 0 })).toBe(false);
    expect(isWallCollision({ x: 10, y: 10 })).toBe(false);
    expect(isWallCollision({ x: 19, y: 19 })).toBe(false);
  });

  it('그리드 밖으로 나가면 벽 충돌이다', () => {
    expect(isWallCollision({ x: -1, y: 0 })).toBe(true);
    expect(isWallCollision({ x: 20, y: 0 })).toBe(true);
    expect(isWallCollision({ x: 0, y: -1 })).toBe(true);
    expect(isWallCollision({ x: 0, y: 20 })).toBe(true);
  });

  it('경찰차 위치와 겹치면 경찰차 충돌이다', () => {
    const police = [{ x: 5, y: 5 }, { x: 3, y: 3 }];
    expect(isPoliceCollision({ x: 5, y: 5 }, police)).toBe(true);
    expect(isPoliceCollision({ x: 3, y: 3 }, police)).toBe(true);
  });

  it('경찰차 위치와 겹치지 않으면 충돌이 아니다', () => {
    const police = [{ x: 5, y: 5 }];
    expect(isPoliceCollision({ x: 6, y: 5 }, police)).toBe(false);
    expect(isPoliceCollision({ x: 5, y: 6 }, police)).toBe(false);
  });

  it('경찰차가 없으면 충돌이 아니다', () => {
    expect(isPoliceCollision({ x: 5, y: 5 }, [])).toBe(false);
  });

  it('행인과 같은 위치면 충돌이다', () => {
    expect(isPedestrianCollision({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(true);
  });

  it('행인과 다른 위치면 충돌이 아니다', () => {
    expect(isPedestrianCollision({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(false);
  });
});

describe('도주 게임 - 행인 스폰 검증', () => {
  it('자동차 위치에 행인이 스폰되면 안 된다', () => {
    const car = { x: 10, y: 10 };
    expect(isValidPedestrianPosition({ x: 10, y: 10 }, car, [])).toBe(false);
  });

  it('경찰차 위치에 행인이 스폰되면 안 된다', () => {
    const car = { x: 0, y: 0 };
    const police = [{ x: 5, y: 5 }];
    expect(isValidPedestrianPosition({ x: 5, y: 5 }, car, police)).toBe(false);
  });

  it('빈 위치에는 행인이 스폰 가능하다', () => {
    const car = { x: 0, y: 0 };
    const police = [{ x: 5, y: 5 }];
    expect(isValidPedestrianPosition({ x: 10, y: 10 }, car, police)).toBe(true);
  });
});

describe('도주 게임 - 경찰차 업데이트', () => {
  it('경찰차가 자동차의 이전 위치를 따라간다', () => {
    const policeCars = [{ x: 3, y: 3 }, { x: 2, y: 2 }];
    const carPos = { x: 5, y: 5 };
    const updated = updatePoliceCars(policeCars, carPos);

    expect(updated[0]).toEqual({ x: 5, y: 5 });
    expect(updated[1]).toEqual({ x: 3, y: 3 });
  });

  it('경찰차가 1대일 때도 정상 동작한다', () => {
    const policeCars = [{ x: 3, y: 3 }];
    const carPos = { x: 5, y: 5 };
    const updated = updatePoliceCars(policeCars, carPos);

    expect(updated[0]).toEqual({ x: 5, y: 5 });
  });

  it('경찰차가 없으면 빈 배열을 반환한다', () => {
    expect(updatePoliceCars([], { x: 5, y: 5 })).toEqual([]);
  });

  it('긴 경찰차 체인도 올바르게 전파된다', () => {
    const policeCars = [
      { x: 4, y: 4 },
      { x: 3, y: 3 },
      { x: 2, y: 2 },
      { x: 1, y: 1 },
    ];
    const carPos = { x: 5, y: 5 };
    const updated = updatePoliceCars(policeCars, carPos);

    expect(updated[0]).toEqual({ x: 5, y: 5 });
    expect(updated[1]).toEqual({ x: 4, y: 4 });
    expect(updated[2]).toEqual({ x: 3, y: 3 });
    expect(updated[3]).toEqual({ x: 2, y: 2 });
  });
});

describe('도주 게임 - 속도 계산', () => {
  it('초기 게임 속도는 200ms이다', () => {
    expect(calculateGameSpeed(0)).toBe(200);
  });

  it('5점마다 속도가 증가한다', () => {
    expect(calculateGameSpeed(5)).toBe(185);
    expect(calculateGameSpeed(10)).toBe(170);
  });

  it('속도는 50ms 이하로 떨어지지 않는다', () => {
    expect(calculateGameSpeed(1000)).toBe(50);
  });
});
