// SFX for /garak-guksu: pure WebAudio synthesis — no external files.
// 1980년대 한국 기차역 가락국수 분위기. 인물 음성 없음(분위기 사운드만).
// cue(name)으로 짧은 효과음, ambience(era)로 깔리는 베드(스팀 히스 + 먼 기적).
// 합성만: OscillatorNode / AudioBufferSourceNode(노이즈) / BiquadFilter / GainNode 엔벨로프.
//
// 구현 큐: order · serve · combo · leave · pa · start · cook (알 수 없는 이름은 무시).
// main.js 가 createSfx() 를 직접 사용(구 audio.js/playVoice 는 제거됨).

const MUTE_KEY = 'garak-guksu-muted';

export function createSfx() {
  // localStorage 초기 로드(가드: private mode 등)
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

  let ctx = null;       // AudioContext: 지연 생성(첫 cue 또는 resume)
  let master = null;    // master GainNode — 뮤트 = gain 0
  let noiseBuf = null;  // 재사용 화이트 노이즈 버퍼

  // 현재 진행 중인 ambience 노드들(stopAmbience에서 정리)
  let amb = null;

  // AudioContext 미지원 가드 + 지연 생성
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null; // 미지원 → 모든 합성 no-op
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    return ctx;
  }

  // 1초짜리 화이트 노이즈 버퍼(스팀/지글/기적 노이즈에 재사용)
  function getNoise() {
    if (noiseBuf) return noiseBuf;
    const c = ctx;
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // --- 합성 헬퍼 ---------------------------------------------------------

  // 짧은 톤 + ADSR 비슷한 엔벨로프. dest 없으면 master로.
  function tone(freq, t0, dur, { type = 'sine', gain = 0.2, attack = 0.008, dest = null, glideTo = 0 } = {}) {
    const c = ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest || master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    return { o, g };
  }

  // 노이즈 버스트(필터드) — 스팀/지글 등.
  function noiseBurst(t0, dur, { type = 'bandpass', freq = 1200, Q = 0.7, gain = 0.15, attack = 0.01 } = {}) {
    const c = ctx;
    const src = c.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    return { src, f, g };
  }

  // 두 톤 글라이드(기차 기적) — 살짝 디튠된 사인 2개로 스팀 휘슬 느낌.
  function whistle(t0, dur, f1, f2, gain) {
    const c = ctx;
    const mk = (det) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f1 * det, t0);
      o.frequency.linearRampToValueAtTime(f2 * det, t0 + dur * 0.5);
      o.frequency.linearRampToValueAtTime(f1 * det, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.12, dur * 0.25));
      g.gain.setValueAtTime(gain, t0 + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    };
    mk(1);       // 기본 음
    mk(1.5);     // 완전5도 위 — 증기 기적의 화음감
  }

  // --- 큐(cue) -----------------------------------------------------------

  const CUES = {
    // order: 부드러운 종/마림바 딩(손님 주문). 기음 + 옥타브 + 5도, 빠른 감쇠.
    order(c, t) {
      tone(784.0, t, 0.50, { type: 'triangle', gain: 0.16, attack: 0.004 }); // G5
      tone(1174.7, t, 0.42, { type: 'sine', gain: 0.08, attack: 0.004 });    // D6
      tone(392.0, t, 0.55, { type: 'sine', gain: 0.05 });                    // G4 바닥
    },

    // serve: 기분 좋은 2음 차임(완성 서빙). 상행 4도.
    serve(c, t) {
      tone(659.3, t, 0.18, { type: 'triangle', gain: 0.18, attack: 0.004 });        // E5
      tone(880.0, t + 0.11, 0.30, { type: 'triangle', gain: 0.18, attack: 0.004 }); // A5
    },

    // combo: 밝은 상행 아르페지오(콤보). C-E-G-C.
    combo(c, t) {
      const notes = [523.25, 659.26, 783.99, 1046.5];
      notes.forEach((f, i) => {
        tone(f, t + i * 0.06, 0.20, { type: 'triangle', gain: 0.15, attack: 0.003 });
      });
    },

    // leave: 낮은 슬픈 톤 + 짧은 기차 기적 2톤 글라이드(손님 이탈/기차 출발).
    leave(c, t) {
      tone(220.0, t, 0.45, { type: 'sine', gain: 0.16, glideTo: 174.6 });   // A3 → F3 처짐
      tone(146.8, t, 0.50, { type: 'sine', gain: 0.10 });                   // D3 바닥
      whistle(t + 0.18, 0.55, 392, 466, 0.12);                             // 멀어지는 기적
    },

    // pa: 고전 역 4음 차임(안내방송 도-미-솔-도) 사인.
    pa(c, t) {
      const notes = [523.25, 659.26, 783.99, 1046.5]; // 도-미-솔-도
      notes.forEach((f, i) => {
        tone(f, t + i * 0.22, 0.34, { type: 'sine', gain: 0.17, attack: 0.012 });
      });
    },

    // start: 놋종 + 스팀 노이즈 버스트(게임 시작/주인장 준비).
    start(c, t) {
      // 놋종: 약간 비화성 부분음으로 금속성.
      tone(523.25, t, 1.10, { type: 'sine', gain: 0.16, attack: 0.002 });       // C5
      tone(523.25 * 2.76, t, 0.85, { type: 'sine', gain: 0.05, attack: 0.002 }); // 비화성 부분음
      tone(523.25 * 5.40, t, 0.55, { type: 'sine', gain: 0.025, attack: 0.002 });
      tone(261.63, t, 1.10, { type: 'sine', gain: 0.08 });                       // C4 바닥
      // 스팀 분출
      noiseBurst(t + 0.02, 0.6, { type: 'highpass', freq: 1400, Q: 0.5, gain: 0.10, attack: 0.02 });
    },

    // cook: 짧은 지글/국자 틱(조리 동작). 노이즈 칙 + 미세 틱.
    cook(c, t) {
      noiseBurst(t, 0.12, { type: 'bandpass', freq: 2600, Q: 0.6, gain: 0.07, attack: 0.004 }); // 지글
      tone(2300, t + 0.01, 0.05, { type: 'square', gain: 0.04, attack: 0.001 });                // 국자 틱
    },
  };

  function cue(name) {
    const c = ensureCtx();
    if (!c || muted) return;
    const fn = CUES[name];
    if (!fn) return; // 알 수 없는 name 무시
    fn(c, c.currentTime);
  }

  // --- ambience ----------------------------------------------------------

  // era별 베드 파라미터(스팀 히스 볼륨/필터, 기적 빈도).
  // '증기' 진한 증기, '디젤' 중간, '막차' 옅고 한적.
  const ERA = {
    '증기': { hiss: 0.060, freq: 950, whistleEvery: 9000, whistleGain: 0.05 },
    '디젤': { hiss: 0.045, freq: 800, whistleEvery: 13000, whistleGain: 0.04 },
    '막차': { hiss: 0.030, freq: 700, whistleEvery: 17000, whistleGain: 0.035 },
  };

  function ambience(era) {
    const c = ensureCtx();
    if (!c) return;
    stopAmbience();
    const cfg = ERA[era] || ERA['증기'];

    // 깔리는 필터드 노이즈 = 증기 히스 베드(루프, 살짝 흔들리는 게인).
    const src = c.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cfg.freq;
    f.Q.value = 0.4;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(cfg.hiss, t + 1.5); // 부드럽게 페이드 인
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);

    // 느린 LFO로 히스 게인을 흔들어 '살아있는' 증기 느낌.
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = cfg.hiss * 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    lfo.start(t);

    // 가끔 먼 기적(setInterval). 뮤트면 건너뜀.
    const timer = setInterval(() => {
      if (muted || !ctx) return;
      whistle(ctx.currentTime + 0.05, 1.4, 330, 392, cfg.whistleGain);
    }, cfg.whistleEvery);

    amb = { src, f, g, lfo, lfoGain, timer };
  }

  function stopAmbience() {
    if (!amb) return;
    const { src, lfo, timer } = amb;
    const a = amb;
    amb = null;
    clearInterval(timer);
    if (ctx) {
      const t = ctx.currentTime;
      try {
        a.g.gain.cancelScheduledValues(t);
        a.g.gain.setValueAtTime(Math.max(0.0001, a.g.gain.value), t);
        a.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); // 부드러운 페이드 아웃
      } catch { /* node may already be stopped */ }
      try { src.stop(t + 0.45); } catch { /* already stopped */ }
      try { lfo.stop(t + 0.45); } catch { /* already stopped */ }
    } else {
      try { src.stop(); } catch { /* no ctx */ }
      try { lfo.stop(); } catch { /* no ctx */ }
    }
  }

  // --- mute / lifecycle --------------------------------------------------

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
    if (master && ctx) {
      // 클릭 방지: 짧은 램프로 게인 토글.
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.05);
    }
  }

  function isMuted() { return muted; }

  // 첫 사용자 제스처에서 호출 — AudioContext 생성/재개.
  function resume() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') return c.resume();
    return Promise.resolve();
  }

  return { cue, ambience, stopAmbience, setMuted, isMuted, resume };
}
