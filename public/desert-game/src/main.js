import { Game } from './core/Game.js';
import { Terrain } from './world/Terrain.js';
import { Sky } from './world/Sky.js';

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

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hud.classList.remove('hidden');
    game.start();
  });
  console.log('[desert-game] ready');
}
