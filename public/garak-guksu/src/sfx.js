// SFX for /garak-guksu: pure WebAudio synthesis — no external files.
// 1980년대 한국 기차역 가락국수 분위기. 인물 음성 없음(분위기 사운드만).
// cue(name)으로 짧은 효과음, ambience(era)로 깔리는 베드(스팀 히스 + 먼 기적).
// 합성만: OscillatorNode / AudioBufferSourceNode(노이즈) / BiquadFilter / GainNode 엔벨로프.
//
// 구현 큐: order · serve · combo · leave · pa · start · cook · tick · tickHard · depart (알 수 없는 이름 무시).
// main.js 가 createSfx() 를 직접 사용(구 audio.js/playVoice 는 제거됨).

const MUTE_KEY = 'garak-guksu-muted';

export function createSfx() {
  // localStorage 초기 로드(가드: private mode 등)
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

  let ctx = null;       // AudioContext: 지연 생성(첫 cue 또는 resume)
  let master = null;    // master GainNode — 뮤트 = gain 0
  let noiseBuf = null;  // 재사용 화이트 노이즈 버퍼

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

    // tick / tickHard: 정차 임박 카운트다운 비프(≤10s / ≤5s 더 급하게).
    tick(c, t) {
      tone(1320, t, 0.09, { type: 'square', gain: 0.09, attack: 0.002 });
    },
    tickHard(c, t) {
      tone(1760, t, 0.11, { type: 'square', gain: 0.13, attack: 0.002 });
      tone(2640, t, 0.06, { type: 'sine', gain: 0.05, attack: 0.001 });
    },

    // depart: 발차! 길고 우렁찬 증기 기적 + 스팀 분출.
    depart(c, t) {
      whistle(t, 1.3, 392, 523, 0.18);
      noiseBurst(t + 0.05, 0.8, { type: 'highpass', freq: 1200, Q: 0.5, gain: 0.12, attack: 0.03 });
      tone(174.6, t, 1.0, { type: 'sine', gain: 0.08 });
    },
  };

  function cue(name) {
    const c = ensureCtx();
    if (!c || muted) return;
    const fn = CUES[name];
    if (!fn) return; // 알 수 없는 name 무시
    fn(c, c.currentTime);
  }

  // --- voice (원격 4080 사전합성 wav) -------------------------------------
  // 주인장/손님 2채널 — 같은 채널이 재생 중이면 새 음성은 무시(말 겹침/스팸 방지).
  // HTMLAudioElement 사용(WebAudio master gain과 별개라 muted를 직접 가드).
  const VOICE_BASE = '/garak-guksu/voices/';
  const VOICE_NAMES = ['owner_greet', 'owner_take', 'owner_serve']; // 손님은 아키타입별
  for (const a of ['soldier', 'worker', 'student', 'granny', 'couple']) {
    for (const k of ['order', 'happy', 'leave']) VOICE_NAMES.push(`${a}_${k}`);
  }
  const voiceEls = {};
  const voicePlaying = { owner: null, cust: null };
  if (typeof Audio !== 'undefined') {
    for (const n of VOICE_NAMES) { const a = new Audio(VOICE_BASE + n + '.wav'); a.preload = 'auto'; voiceEls[n] = a; }
  }
  function playVoice(name) {
    if (muted) return;
    const a = voiceEls[name];
    if (!a) return; // 알 수 없는 음성 무시
    const ch = name.startsWith('owner') ? 'owner' : 'cust';
    const cur = voicePlaying[ch];
    if (cur && !cur.paused && !cur.ended) return; // 같은 채널 재생 중 → 끼어들지 않음
    try { a.currentTime = 0; } catch { /* not ready */ }
    a.volume = 1;
    const p = a.play();
    if (p && p.catch) p.catch(() => { /* autoplay 차단/미준비 무시 */ });
    voicePlaying[ch] = a;
  }

  // --- ambience ----------------------------------------------------------
  // (제거됨) 초기 WebAudio 분위기 베드 — 증기 히스 루프 + 0.13Hz LFO 가 게인을 흔드는
  // "우웅우웅" 지속 드론 + 먼 기적. 계속 깔리는 기계음으로 거슬려 제거.
  // 이제 분위기는 단발 큐(cue)와 실제 음성 에셋(playVoice)으로만 표현.
  // API 호환(main.js·테스트가 호출)을 위해 no-op 으로 유지.
  function ambience() { /* no-op: 분위기 드론 제거됨 */ }
  function stopAmbience() { /* no-op */ }

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
    if (muted) { for (const n in voiceEls) { try { voiceEls[n].pause(); } catch { /* */ } } }
  }

  function isMuted() { return muted; }

  // 첫 사용자 제스처에서 호출 — AudioContext 생성/재개.
  function resume() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') return c.resume();
    return Promise.resolve();
  }

  return { cue, ambience, stopAmbience, setMuted, isMuted, resume, playVoice };
}
