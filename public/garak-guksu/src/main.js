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

const BEST_KEY = 'garak-guksu-best';
const loadBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
function saveBest(s) { try { if (s > loadBest()) localStorage.setItem(BEST_KEY, String(s)); } catch { /* localStorage unavailable */ } }

const canvas = $('game');
const scene = createScene(canvas);

const SPICE_KO = { none: '안 맵게', normal: '기본', extra: '고춧가루 많이' };
const STAGE_KO = { noodle: '면사리', blanched: '데친 면', brothed: '육수', done: '완성' };

let state = createGame(seedNow());
let running = false;
let last = 0;
let rafId = 0;
let prevMissed = 0;
let seenIds = new Set();
let prevPhase = 'serving';

function seedNow() { return ((performance.now() | 0) ^ 0x9e3779b9) >>> 0; }

function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) { setNoodle(state); audio.cue('cook'); }
  else if (near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    if (p.holding && p.holding.stage === 'noodle') putInBlancher(state);
    else liftFromBlancher(state);
    audio.cue('cook');
  } else if (near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) { pourBroth(state); audio.cue('cook'); }
  else {
    const before = state.combo;
    serve(state); // serve picks the nearest in-range customer (no-op if none)
    if (state.combo > before) {
      const cheers = ['좋았어!', '척척!', '신들렸다!', '오늘 장사 대박!'];
      if (state.combo >= 3) {
        popup(cheers[Math.min(state.combo - 3, cheers.length - 1)]); flash();
        audio.cue('combo');
      } else {
        audio.cue('serve');
      }
    }
  }
  renderHud();
}
const input = createInput(action);
canvas.addEventListener('pointerdown', action);

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
  movePlayer(state, input.getMoveDir(), dt);
  tickBlancher(state, dt);
  tickWave(state, dt);
  tickSpawns(state, dt);
  tickCustomers(state, dt);
  if (state.missed > prevMissed) { prevMissed = state.missed; popup('아이고 기차!'); audio.cue('leave'); }

  // 신규 손님 감지 → 주문 큐 한 번(분위기 음 합성, 인물 음성 없음).
  for (const c of state.customers) {
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      audio.cue('order');
    }
  }

  // intermission 진입(발차 안내) → PA 차임 + 화면 안내.
  if (state.phase === 'intermission' && prevPhase !== 'intermission') {
    audio.cue('pa');
    popup('📢 곧 발차 — 다음 손님!');
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
  running = true;
  $('start').classList.add('off');
  $('result').classList.add('off');
  renderHud();
  // 첫 사용자 제스처 → AudioContext 재개 + 시작 큐 + 현재 에라 분위기 베드.
  audio.resume();
  audio.cue('start');
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

scene.sync(state);
scene.render();
