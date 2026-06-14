import * as THREE from 'three';
import { Game } from './core/Game.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');

let game = null;
try {
  game = new Game(canvas); // creating WebGLRenderer throws if WebGL is unavailable
} catch (err) {
  console.error('[fry-tower] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  game.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a3a, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 12, 8);
  game.scene.add(dir);

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xe23434, roughness: 0.8 })
  );
  game.scene.add(tray);

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hud.classList.remove('hidden');
    game.start();
  });

  game.renderOnce(); // show the stage before the player presses start
  console.log('[fry-tower] ready');
}
