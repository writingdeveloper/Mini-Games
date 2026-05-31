import { Game } from './core/Game.js';
import { Terrain } from './world/Terrain.js';
import { Sky } from './world/Sky.js';
import { Input } from './core/Input.js';
import { Car } from './vehicle/Car.js';
import { ChaseCamera } from './camera/ChaseCamera.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');

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

  const chase = new ChaseCamera(game.camera, car, input);
  game.systems.push(chase);

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hud.classList.remove('hidden');
    game.start();
  });
  console.log('[desert-game] ready');
}
