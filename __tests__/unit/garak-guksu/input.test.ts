import { describe, it, expect, vi } from 'vitest';
import { createInput } from '../../../public/garak-guksu/src/input.js';

// 카메라 불변식: 화면 위 = 월드 +z, 화면 오른쪽 = 월드 -x.
// (scene.js camera.position=(0,7.5,-7), lookAt=(0,0.5,1.5) → -z에서 +z를 본다)
// 따라서 "위로(W)" 누르면 +z, "오른쪽(D)" 누르면 -x 가 나와야 한다.
// jsdom 환경에서 window 전역 addEventListener / KeyboardEvent 사용 가능.

function press(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}
function release(code: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

describe('createInput 방향 회귀 (카메라 불변식)', () => {
  it('KeyW → getMoveDir().z > 0 (화면 위 = 월드 +z)', () => {
    const input = createInput(() => {});
    press('KeyW');
    const d = input.getMoveDir();
    expect(d.z).toBeGreaterThan(0);
    expect(d.x).toBe(0);
    release('KeyW');
  });

  it('KeyD → getMoveDir().x < 0 (화면 오른쪽 = 월드 -x)', () => {
    const input = createInput(() => {});
    press('KeyD');
    const d = input.getMoveDir();
    expect(d.x).toBeLessThan(0);
    expect(d.z).toBe(0);
    release('KeyD');
  });

  it('KeyS → -z, KeyA → +x (반대 방향)', () => {
    const input = createInput(() => {});
    press('KeyS');
    expect(input.getMoveDir().z).toBeLessThan(0);
    release('KeyS');

    const input2 = createInput(() => {});
    press('KeyA');
    expect(input2.getMoveDir().x).toBeGreaterThan(0);
    release('KeyA');
  });

  it('방향 벡터는 정규화되어 길이 1 (대각선 포함)', () => {
    const input = createInput(() => {});
    press('KeyW');
    press('KeyD');
    const d = input.getMoveDir();
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 5);
    expect(d.z).toBeGreaterThan(0);
    expect(d.x).toBeLessThan(0);
    release('KeyW');
    release('KeyD');
  });

  it('아무 키도 없으면 0 벡터', () => {
    const input = createInput(() => {});
    expect(input.getMoveDir()).toEqual({ x: 0, z: 0 });
  });

  it('keyup 후 방향 해제', () => {
    const input = createInput(() => {});
    press('KeyW');
    expect(input.getMoveDir().z).toBeGreaterThan(0);
    release('KeyW');
    expect(input.getMoveDir()).toEqual({ x: 0, z: 0 });
  });

  it('E / Space 는 이동이 아니라 onAction 을 발화', () => {
    const onAction = vi.fn();
    const input = createInput(onAction);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(input.getMoveDir()).toEqual({ x: 0, z: 0 }); // 이동 없음
  });

  it('setTouchDir 가 키보드 입력과 합쳐진다', () => {
    const input = createInput(() => {});
    input.setTouchDir(0, 1); // 화면 위
    const d = input.getMoveDir();
    expect(d.z).toBeGreaterThan(0);
  });
});
