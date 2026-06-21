import {
  createGame, movePlayer, near, STATIONS, CUSTOMER_SLOT,
  setNoodle, putInBlancher, liftFromBlancher, tickBlancher, blancherProgress,
  pourBroth, garnish, serve,
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
    if (state.blancher.bowl) liftFromBlancher(state); else putInBlancher(state);
  } else if (near(p.x, p.z, STATIONS.broth.x, STATIONS.broth.z)) pourBroth(state);
  else if (near(p.x, p.z, CUSTOMER_SLOT.x, CUSTOMER_SLOT.z)) serve(state);
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

function renderHud() {
  $('score').textContent = state.score;
  $('order').textContent = state.customer.present ? SPICE_KO[state.customer.order.spice] : '-';
  $('held').textContent = state.player.holding ? STAGE_KO[state.player.holding.stage] : '빈손';
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  movePlayer(state, input.getMoveDir(), dt);
  tickBlancher(state, dt);
  scene.sync(state);
  scene.render();
  rafId = requestAnimationFrame(loop);
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
  STATIONS, CUSTOMER_SLOT,
  get score() { return state.score; },
  get holding() { return state.player.holding; },
  get order() { return state.customer.order; },
  get progress() { return blancherProgress(state); },
  teleport(x, z) { state.player.x = x; state.player.z = z; },
  setNoodle() { setNoodle(state); renderHud(); },
  putInBlancher() { putInBlancher(state); renderHud(); },
  tick(dt) { tickBlancher(state, dt); },
  liftFromBlancher() { liftFromBlancher(state); renderHud(); },
  pourBroth() { pourBroth(state); renderHud(); },
  garnish(spice) { garnish(state, spice); renderHud(); },
  serve() { serve(state); renderHud(); },
};

scene.sync(state);
scene.render();
