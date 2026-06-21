import {
  createGame, movePlayer, near, STATIONS, CUSTOMER_SLOTS,
  setNoodle, putInBlancher, liftFromBlancher, tickBlancher, tickSpawns, tickCustomers,
  pourBroth, garnish, serve, ARCHETYPES, tickWave, WAVES, grade, comboMult,
} from './logic.js';
import { createScene } from './scene.js';
import { createInput } from './input.js';

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

function seedNow() { return ((performance.now() | 0) ^ 0x9e3779b9) >>> 0; }

function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) setNoodle(state);
  else if (near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    if (p.holding && p.holding.stage === 'noodle') putInBlancher(state);
    else liftFromBlancher(state);
  } else if (near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) pourBroth(state);
  else {
    const before = state.combo;
    serve(state); // serve picks the nearest in-range customer (no-op if none)
    if (state.combo > before) {
      const cheers = ['좋았어!', '척척!', '신들렸다!', '오늘 장사 대박!'];
      if (state.combo >= 3) { popup(cheers[Math.min(state.combo - 3, cheers.length - 1)]); flash(); }
    }
  }
  renderHud();
}
const input = createInput(action);
canvas.addEventListener('pointerdown', action);

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
  if (state.missed > prevMissed) { prevMissed = state.missed; popup('아이고 기차!'); }
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
  running = true;
  $('start').classList.add('off');
  $('result').classList.add('off');
  renderHud();
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}

$('startbtn').addEventListener('click', start);
$('replaybtn').addEventListener('click', start);

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
