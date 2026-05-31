import { Game } from './core/Game.js';
import { CONFIG } from './logic/config.js';
import { Terrain } from './world/Terrain.js';
import { Sky } from './world/Sky.js';
import { Input } from './core/Input.js';
import { Car } from './vehicle/Car.js';
import { DustEmitter } from './vehicle/DustEmitter.js';
import { ChaseCamera } from './camera/ChaseCamera.js';
import { Landmarks } from './world/Landmarks.js';
import { Collectibles } from './world/Collectibles.js';
import { HUD } from './ui/HUD.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const toast = document.getElementById('toast');

let toastTimer = 0;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

let game = null;
try {
  game = new Game(canvas); // creating the WebGLRenderer throws if WebGL is unavailable
} catch (err) {
  console.error('[desert-game] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  const terrain = game.add(new Terrain());
  game.terrain = terrain;

  const sky = new Sky(game.scene);
  game.systems.push(sky);
  game.sky = sky;

  const input = new Input();
  const car = game.add(new Car(terrain, input));
  game.car = car;

  game.add(new DustEmitter(car, sky));

  const chase = new ChaseCamera(game.camera, car, input);
  game.systems.push(chase);

  const landmarks = game.add(
    new Landmarks(terrain, (_it, count) => showToast(`✨ 신기루 발견!  ${count} / ${CONFIG.landmarks.count}`))
  );
  game.landmarks = landmarks;

  const collectibles = game.add(new Collectibles(terrain, () => {}));
  game.collectibles = collectibles;

  game.systems.push(new HUD(game));

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hudEl.classList.remove('hidden');
    game.start();
  });
  console.log('[desert-game] ready');
}
