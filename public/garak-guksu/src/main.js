import { createGame, movePlayer, interact, serve, near, COOK_STATION, CUSTOMER_SLOT } from './logic.js';
import { createScene } from './scene.js';
import { createInput } from './input.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const scene = createScene(canvas);

let state = createGame();
let running = false;
let last = 0;

function action() {
  if (!running) return;
  const p = state.player;
  if (near(p.x, p.z, COOK_STATION.x, COOK_STATION.z)) interact(state);
  else if (near(p.x, p.z, CUSTOMER_SLOT.x, CUSTOMER_SLOT.z)) serve(state);
  renderHud();
}
const input = createInput(action);
canvas.addEventListener('pointerdown', action);

function renderHud() { $('score').textContent = state.score; }

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  movePlayer(state, input.getMoveDir(), dt);
  scene.sync(state);
  scene.render();
  requestAnimationFrame(loop);
}

function start() {
  state = createGame();
  running = true;
  $('start').classList.add('off');
  $('result').classList.add('off');
  renderHud();
  last = performance.now();
  requestAnimationFrame(loop);
}

$('startbtn').addEventListener('click', start);
$('replaybtn').addEventListener('click', start);

window.__garak = {
  COOK_STATION, CUSTOMER_SLOT,
  get score() { return state.score; },
  get holding() { return state.player.holding; },
  teleport(x, z) { state.player.x = x; state.player.z = z; },
  interact() { interact(state); renderHud(); },
  serve() { serve(state); renderHud(); },
};

scene.sync(state);
scene.render();
