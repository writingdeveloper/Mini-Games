import {
  createGame, movePlayer, near, STATIONS, CUSTOMER_SLOTS,
  setNoodle, putInBlancher, liftFromBlancher, tickBlancher, tickSpawns, tickCustomers,
  pourBroth, garnish, serve, ARCHETYPES, tickWave, WAVES,
} from './logic.js';
import { createScene } from './scene.js';
import { createInput } from './input.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const scene = createScene(canvas);

const SPICE_KO = { none: '안 맵게', normal: '기본', extra: '고춧가루 많이' };
const STAGE_KO = { noodle: '면사리', blanched: '데친 면', brothed: '육수', done: '완성' };

let state = createGame(seedNow());
let running = false;
let last = 0;
let rafId = 0;

function seedNow() { return ((performance.now() | 0) ^ 0x9e3779b9) >>> 0; }

function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, STATIONS.setting.x, STATIONS.setting.z)) setNoodle(state);
  else if (near(p.x, p.z, STATIONS.blancher.x, STATIONS.blancher.z)) {
    if (p.holding && p.holding.stage === 'noodle') putInBlancher(state);
    else liftFromBlancher(state);
  } else if (near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) pourBroth(state);
  else serve(state); // serve picks the nearest in-range customer (no-op if none)
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
  $('lives').textContent = '❤'.repeat(Math.max(0, state.lives)) || '—';
  const w = WAVES[state.wave];
  $('wave').textContent = `${w.era} · ${state.wave + 1}/${WAVES.length}`;
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
  scene.sync(state);
  scene.render();
  renderHud();
  if (state.phase === 'won' || state.phase === 'over') { running = false; endGame(); return; }
  rafId = requestAnimationFrame(loop);
}

function endGame() {
  const won = state.phase === 'won';
  $('result-title').textContent = won ? '🎉 영업 대박!' : '영업 종료';
  $('result-sub').textContent = won
    ? `5웨이브 완주 · 점수 ${state.score}`
    : `${state.wave + 1}웨이브에서 마감 · 점수 ${state.score}`;
  $('result').classList.remove('off');
}

function start() {
  if (rafId) cancelAnimationFrame(rafId);
  state = createGame(seedNow());
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
