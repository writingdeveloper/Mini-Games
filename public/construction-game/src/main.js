import * as THREE from 'three';
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { CONFIG } from './logic/config.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const toast = document.getElementById('toast');

let toastTimer = 0;
export function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

let game = null;
try {
  game = new Game(canvas);
} catch (err) {
  console.error('[construction-game] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.0);
  game.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff0d0, 0.7);
  dir.position.set(20, 40, 10);
  game.scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.site.width, CONFIG.site.depth),
    new THREE.MeshLambertMaterial({ color: 0x8a8170 })
  );
  ground.rotation.x = -Math.PI / 2;
  game.scene.add(ground);

  const input = new Input();
  game.input = input;

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hudEl.classList.remove('hidden');
    game.status = 'playing';
    game.start();
  });

  console.log('[construction-game] ready');
}
