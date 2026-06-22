import {
  createGame, movePlayer, near, STATIONS, CUSTOMER_SLOTS,
  setNoodle, putInBlancher, liftFromBlancher, tickBlancher, tickSpawns, tickCustomers,
  pourBroth, garnish, serve, ARCHETYPES, tickWave, WAVES, grade, comboMult,
} from './logic.js';
import { createScene } from './scene.js';
import { createInput } from './input.js';
import { createSfx } from './sfx.js';

const audio = createSfx();

const $ = (id) => document.getElementById(id);

const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function popup(text) {
  const el = $('pop'); el.textContent = text; el.classList.remove('show');
  void el.offsetWidth; el.classList.add('show');
}
function flash() {
  if (RM) return;
  const f = $('flash'); f.style.opacity = '1';
  setTimeout(() => (f.style.opacity = '0'), 130);
}

// 첫 영업 1회 코치 토스트(진행 순서 재확인).
let coached = false;
function coach(text, ms = 5200) {
  const el = $('coach'); if (!el) return;
  el.textContent = text; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}

const BEST_KEY = 'garak-guksu-best';
const loadBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
function saveBest(s) { try { if (s > loadBest()) localStorage.setItem(BEST_KEY, String(s)); } catch { /* localStorage unavailable */ } }

const canvas = $('game');
const scene = createScene(canvas);

const SPICE_KO = { none: '안 맵게', normal: '기본', extra: '고춧가루 많이' };
const STAGE_KO = { noodle: '면사리', blanched: '데친 면', brothed: '멸치육수', done: '완성' };

let state = createGame(seedNow());
let running = false;
let last = 0;
let rafId = 0;
let prevMissed = 0;
let seenIds = new Set();
let prevPhase = 'serving';
let prevWave = 0;
let prevDwellSec = 999;
let departWarned = false;

function seedNow() { return ((performance.now() | 0) ^ 0x9e3779b9) >>> 0; }

function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) { const fresh = !p.holding; setNoodle(state); audio.cue('cook'); scene.cookMotion?.(); if (fresh) audio.playVoice('owner_take'); }
  else if (near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    if (p.holding && p.holding.stage === 'noodle') { putInBlancher(state); popup('🍜 데치는 중! 다시 눌러 면 건지기'); }
    else { const lifted = liftFromBlancher(state); if (!lifted && !p.holding) popup('데칠 면이 없어요 (① 면부터)'); }
    audio.cue('cook'); scene.cookMotion?.();
  } else if (near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) {
    const okBroth = pourBroth(state); audio.cue('cook'); scene.cookMotion?.();
    if (!okBroth && (!p.holding || p.holding.stage !== 'blanched')) popup('③ 육수는 데친 면에! ② 데치기 → 다시 눌러 건지기');
  }
  else if (near(p.x, p.z, STATIONS.garnish.x, STATIONS.garnish.z)) {
    // ④ 고명/양념: action 키 = 기본 양념으로 빠른 마무리, 1·2·3(또는 버튼) = 손님 주문에 맞춰 선택.
    if (p.holding && p.holding.stage === 'brothed') {
      garnish(state, 'normal'); audio.cue('cook'); scene.cookMotion?.(); popup('🌶️ 기본 양념 완성! (1·2·3 으로 손님 맞춤)');
    } else if (!p.holding) { popup('① 면부터! 면→데치기→육수→양념'); }
    else { popup('③ 육수까지 받아오세요'); }
  }
  else {
    const before = state.combo;
    const scoreBefore = state.score;
    serve(state); // serve picks the nearest in-range customer (no-op if none)
    if (state.combo > before) {
      const cheers = ['좋았어!', '척척!', '신들렸다!', '오늘 장사 대박!'];
      if (state.combo >= 3) {
        popup(cheers[Math.min(state.combo - 3, cheers.length - 1)]); flash();
        audio.cue('combo');
      } else {
        popup('😋 +' + (state.score - scoreBefore));
        audio.cue('serve');
      }
      audio.playVoice('owner_serve');
      if (Math.random() < 0.5) setTimeout(() => audio.playVoice('cust_happy'), 550);
    } else if (p.holding && p.holding.stage !== 'done') {
      popup('아직 완성 전! ④ 양념까지 마무리하세요');
    }
  }
  renderHud();
}
const input = createInput(action);
// 캔버스: 탭(거의 안 움직임)=조리 동작, 드래그=시점 둘러보기(scene.js가 처리)라 구분.
let _tapX = 0, _tapY = 0, _tapT = 0;
canvas.addEventListener('pointerdown', (e) => { _tapX = e.clientX; _tapY = e.clientY; _tapT = performance.now(); });
canvas.addEventListener('pointerup', (e) => {
  if (Math.abs(e.clientX - _tapX) + Math.abs(e.clientY - _tapY) >= 10 || performance.now() - _tapT >= 400) return;
  const m = scene.getCamMode ? scene.getCamMode() : 'fixed';
  // 마우스 + 추격/1인칭 + 미잠금 → 시점 잠금(마우스 이동 둘러보기 시작); 그 외/잠금 중 → 조리 동작.
  if (e.pointerType === 'mouse' && (m === 'chase' || m === 'first') && scene.isLooking && !scene.isLooking()) {
    scene.requestLook();
  } else {
    action();
  }
});

// Mobile joystick → movement direction via input.setTouchDir.
// 카메라가 z=-7 에서 +z 를 본다 → 화면 위(dy<0)=월드 +z, 화면 오른쪽(dx>0)=월드 -x.
// 따라서 손가락 방향(dx,dy)을 월드축으로 보내려면 둘 다 부호 반전한다.
// knob 비주얼은 손가락을 따라가야 하므로 +dx,+dy 그대로 둔다.
const joy = $('joy'), knob = $('knob');
if (joy) {
  let jid = null, cx = 0, cy = 0;
  const jstart = (e) => { jid = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.setPointerCapture(jid); };
  const jmove = (e) => {
    if (e.pointerId !== jid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const len = Math.hypot(dx, dy) || 1; const cl = Math.min(1, len / 48);
    knob.style.transform = `translate(calc(-50% + ${dx / len * cl * 36}px), calc(-50% + ${dy / len * cl * 36}px))`;
    // 부호 반전: 화면 오른쪽→ -x, 화면 위→ +z (knob 은 손가락 방향 유지).
    input.setTouchDir(-dx / len * cl, -dy / len * cl);
  };
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = 'translate(-50%,-50%)'; input.setTouchDir(0, 0); };
  joy.addEventListener('pointerdown', jstart); joy.addEventListener('pointermove', jmove);
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
}
$('act')?.addEventListener('click', action);
document.querySelectorAll('#spicebtns button').forEach((b) => b.addEventListener('click', () => {
  const p = state.player;
  if (near(p.x, p.z, STATIONS.garnish.x, STATIONS.garnish.z)) { garnish(state, b.dataset.s); renderHud(); }
}));

const SPICE_KEYS = { Digit1: 'none', Digit2: 'normal', Digit3: 'extra' };
addEventListener('keydown', (e) => {
  const spice = SPICE_KEYS[e.code];
  if (!spice || !running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.garnish.x, STATIONS.garnish.z)) { garnish(state, spice); renderHud(); }
});

// V키: 카메라 시점 순환(고정 → 자유 궤도 → 1인칭). 게임 상태와 무관하게 동작.
const CAM_MODE_KO = { fixed: '고정 시점', orbit: '자유 시점 · 드래그/휠', chase: '추격 3인칭 · 클릭=마우스 둘러보기', first: '1인칭 · 클릭=마우스 둘러보기 · ESC 해제' };
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || e.repeat) return;
  const mode = scene.cycleCamMode ? scene.cycleCamMode() : null;
  if (mode) showCamToast(CAM_MODE_KO[mode] || mode);
});
function showCamToast(text) {
  let el = document.getElementById('camToast');
  if (!el) {
    el = document.createElement('div'); el.id = 'camToast';
    el.style.cssText = 'position:fixed;left:50%;top:13%;transform:translateX(-50%);background:rgba(13,28,48,0.9);color:#ffe0a8;padding:8px 16px;border-radius:10px;font:600 15px system-ui,sans-serif;z-index:50;pointer-events:none;transition:opacity .4s;border:1px solid rgba(255,207,106,0.55)';
    document.body.appendChild(el);
  }
  el.textContent = '📷 ' + text + '   (V)';
  el.style.opacity = '1';
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 1700);
}

function nearestCustomer() {
  const p = state.player; let best = null, bestD = Infinity;
  for (const c of state.customers) {
    const slot = CUSTOMER_SLOTS[c.slot];
    const d = (p.x - slot.x) ** 2 + (p.z - slot.z) ** 2;
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function renderHud() {
  $('score').textContent = state.score;
  $('combo').textContent = state.combo >= 2 ? `콤보 ×${comboMult(state.combo).toFixed(1)}` : `콤보 ${state.combo}`;
  $('lives').textContent = '❤'.repeat(Math.max(0, state.lives)) || '—';
  const w = WAVES[Math.min(state.wave, WAVES.length - 1)];
  $('wave').textContent = `${w.era} · ${Math.min(state.wave + 1, WAVES.length)}/${WAVES.length}`;
  const sec = Math.max(0, Math.ceil(state.dwellLeft));
  $('dwell').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const nearby = nearestCustomer();
  $('order').textContent = nearby ? SPICE_KO[nearby.order.spice] : '-';
  $('held').textContent = state.player.holding ? STAGE_KO[state.player.holding.stage] : '빈손';
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  let _dir = input.getMoveDir();
  const _vy = scene.getViewYaw ? scene.getViewYaw() : 0; // 1인칭/추격: 보는 방향 기준 이동
  if (_vy) { const s = Math.sin(_vy), c = Math.cos(_vy); _dir = { x: _dir.z * s + _dir.x * c, z: _dir.z * c - _dir.x * s }; }
  movePlayer(state, _dir, dt, input.isSprint() ? 1.8 : 1);
  tickBlancher(state, dt);
  tickWave(state, dt);
  tickSpawns(state, dt);
  tickCustomers(state, dt);
  if (state.missed > prevMissed) { prevMissed = state.missed; popup('아이고 기차!'); audio.cue('leave'); audio.playVoice('cust_leave'); }

  // 신규 손님 감지 → 주문 큐 + 손님 주문 음성(같은 채널 재생 중이면 자동 무시).
  for (const c of state.customers) {
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      audio.cue('order');
      audio.playVoice('cust_order');
    }
  }

  // 발차 긴박 연출: 카운트다운 + HUD 빨강 깜빡 + 비네트 + 카운트다운 비프.
  const dwellSec = Math.max(0, Math.ceil(state.dwellLeft));
  if (state.phase === 'serving') {
    $('dwellcell')?.classList.toggle('urgent', dwellSec <= 10);
    $('vignette')?.classList.toggle('show', dwellSec <= 5);
    if (dwellSec <= 8 && !departWarned) { departWarned = true; popup('📢 곧 발차 — 서둘러요!'); audio.cue('pa'); }
    if (dwellSec !== prevDwellSec && dwellSec <= 10 && dwellSec > 0) audio.cue(dwellSec <= 5 ? 'tickHard' : 'tick');
  } else {
    $('dwellcell')?.classList.remove('urgent');
    $('vignette')?.classList.remove('show');
  }
  prevDwellSec = dwellSec;

  // 발차(웨이브 종료) = 사건: 우렁찬 기적 + 플래시 + '발차!' (+ 막차 진입 고조).
  if (state.wave > prevWave) {
    prevWave = state.wave;
    departWarned = false;
    audio.cue('depart'); flash(); popup('🚂 발차!');
    $('dwellcell')?.classList.remove('urgent');
    $('vignette')?.classList.remove('show');
    if (WAVES[Math.min(state.wave, WAVES.length - 1)].era === '막차') {
      setTimeout(() => popup('📢 대전발 0시 50분 목포행 — 막차!'), 750);
    }
  }
  prevPhase = state.phase;
  scene.sync(state, now / 1000);
  scene.render();
  renderHud();
  if (state.phase === 'won' || state.phase === 'over') { running = false; endGame(); return; }
  rafId = requestAnimationFrame(loop);
}

function endGame() {
  const won = state.phase === 'won';
  saveBest(state.score);
  $('result-title').textContent = `${won ? '🎉 ' : ''}${grade(state)}`;
  const comicNote = state.missed === 0 ? ' 단 한 명도 못 놓쳤다!' : state.missed >= 6 ? ' 기차가 우리 편이었다…' : '';
  $('result-sub').textContent = (won ? '5웨이브 완주!' : `${state.wave + 1}웨이브에서 마감`) + comicNote;
  $('result-stats').innerHTML =
    `점수 <b>${state.score}</b> · 최고 콤보 <b>${state.bestCombo}</b><br>` +
    `😋 만족 ${state.served} · 🚂 놓침 ${state.missed}<br>` +
    `🏆 최고기록 ${loadBest()}`;
  $('result').classList.remove('off');
}

function start() {
  if (rafId) cancelAnimationFrame(rafId);
  state = createGame(seedNow());
  prevMissed = 0;
  seenIds = new Set();
  prevPhase = 'serving';
  prevWave = 0;
  prevDwellSec = 999;
  departWarned = false;
  running = true;
  $('start').classList.add('off');
  $('result').classList.add('off');
  if (!coached) { coached = true; coach('① 왼쪽부터 순서대로 — 면 → 데치기(게이지!) → 멸치육수 → 고춧가루 → 🚂 손님께! · E로 조리·서빙'); }
  renderHud();
  // 첫 사용자 제스처 → AudioContext 재개 + 시작 큐 + 현재 에라 분위기 베드.
  audio.resume();
  audio.cue('start');
  audio.playVoice('owner_greet'); // 주인장 인사(영업 시작)
  audio.ambience(WAVES[Math.min(state.wave, WAVES.length - 1)].era);
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}

$('startbtn').addEventListener('click', start);
$('replaybtn').addEventListener('click', start);

// Mute button
const muteBtn = $('mute');
if (muteBtn) {
  // Sync initial display with persisted state
  muteBtn.textContent = audio.isMuted() ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(audio.isMuted()));
  muteBtn.addEventListener('click', () => {
    const next = !audio.isMuted();
    audio.setMuted(next);
    muteBtn.textContent = next ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(next));
  });
}

window.__garak = {
  STATIONS,
  CUSTOMER_SLOTS,
  get score() { return state.score; },
  get holding() { return state.player.holding; },
  get customers() { return state.customers; },
  get lives() { return state.lives; },
  get phase() { return state.phase; },
  get wave() { return state.wave; },
  get combo() { return state.combo; },
  get bestCombo() { return state.bestCombo; },
  get playerX() { return state.player.x; },
  get playerZ() { return state.player.z; },
  get muted() { return audio.isMuted(); },
  teleport(x, z) { state.player.x = x; state.player.z = z; },
  setNoodle() { setNoodle(state); renderHud(); },
  putInBlancher() { putInBlancher(state); renderHud(); },
  tick(dt) { tickBlancher(state, dt); },
  liftFromBlancher() { liftFromBlancher(state); renderHud(); },
  pourBroth() { pourBroth(state); renderHud(); },
  garnish(spice) { garnish(state, spice); renderHud(); },
  serve() { serve(state); renderHud(); },
  tickSpawns(dt) { tickSpawns(state, dt); },
  tickCustomers(dt) { tickCustomers(state, dt); },
  tickWave(dt) { tickWave(state, dt); },
};

// 시작화면 최고기록 표기.
{ const b = loadBest(); const el = $('start-best'); if (el) el.textContent = b ? `🏆 최고기록 ${b}` : ''; }

scene.sync(state);
scene.render();
