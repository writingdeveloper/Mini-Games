import { describe, it, expect, beforeEach } from 'vitest';
import { createSfx } from '../../../public/garak-guksu/src/sfx.js';

// sfx.js 는 순수 WebAudio 합성(외부 파일 없음). 구 audio.js/playVoice 는 제거됨.
// jsdom 에는 AudioContext 가 없으므로 합성은 no-op 이어야 한다(가드된 ensureCtx).
// 따라서 형태(함수 존재) + "throw 없이 호출됨" 위주로 검증한다.

describe('createSfx (신규 인터페이스 · 형태 + 안전 호출)', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* private mode */ }
  });

  it('throw 없이 생성된다', () => {
    expect(() => createSfx()).not.toThrow();
  });

  it('cue · ambience · stopAmbience · setMuted · isMuted · resume 함수를 노출한다', () => {
    const sfx = createSfx();
    for (const name of ['cue', 'ambience', 'stopAmbience', 'setMuted', 'isMuted', 'resume']) {
      expect(typeof (sfx as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('cue 호출이 (AudioContext 부재에도) throw 하지 않는다 — 알려진/미지의 이름 모두', () => {
    const sfx = createSfx();
    const names = ['order', 'serve', 'combo', 'leave', 'pa', 'start', 'cook', 'unknown-cue', ''];
    for (const n of names) {
      try { sfx.cue(n); } catch (e) { throw new Error(`cue(${n}) threw: ${e}`); }
    }
  });

  it('ambience / stopAmbience 가 throw 하지 않는다 (각 era + 미지 era)', () => {
    const sfx = createSfx();
    for (const era of ['증기', '디젤', '막차', '???']) {
      try { sfx.ambience(era); sfx.stopAmbience(); } catch (e) { throw new Error(`ambience(${era}) threw: ${e}`); }
    }
    // stopAmbience 를 ambience 없이 호출해도 안전
    expect(() => sfx.stopAmbience()).not.toThrow();
  });

  it('setMuted / isMuted 가 상태를 토글한다', () => {
    const sfx = createSfx();
    sfx.setMuted(true);
    expect(sfx.isMuted()).toBe(true);
    sfx.setMuted(false);
    expect(sfx.isMuted()).toBe(false);
  });

  it('mute 상태가 localStorage 로 지속된다 (새 인스턴스가 읽어옴)', () => {
    const a = createSfx();
    a.setMuted(true);
    const b = createSfx();
    expect(b.isMuted()).toBe(true);
  });

  it('resume() 은 Promise 를 반환한다 (AudioContext 부재여도)', () => {
    const sfx = createSfx();
    const p = sfx.resume();
    expect(typeof p.then).toBe('function');
    return p; // 거부되지 않아야 함
  });
});
