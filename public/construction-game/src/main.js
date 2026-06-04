import * as THREE from 'three';
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { CONFIG } from './logic/config.js';
import { Site } from './world/Site.js';
import { Building } from './world/Building.js';
import { Foreman } from './entities/Foreman.js';
import { DioramaCamera } from './camera/DioramaCamera.js';
import { Worker } from './entities/Worker.js';
import { createWorker, applySlackPressure } from './logic/workerState.js';
import { spawnWorkers, mulberry32 } from './logic/spawn.js';
import { crewOutputPerSecond, advanceProgress } from './logic/production.js';

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

  const input = new Input();
  game.input = input;

  game.add(new Site());

  const building = game.add(new Building());
  game.building = building;

  const foreman = game.add(new Foreman(input));
  game.foreman = foreman;
  game.systems.push(new DioramaCamera(game.camera, foreman));

  const placed = spawnWorkers(CONFIG.seed, CONFIG.workerCount);
  const rng = mulberry32(CONFIG.seed + 99);
  const workers = placed.map((p) => {
    const logic = createWorker(p.id, p.archetypeId, rng);
    return game.add(new Worker(logic, p.x, p.z, CONFIG.exit));
  });
  game.workers = workers;

  game.step = (dt, g) => {
    if (g.status !== 'playing') return;
    g.elapsed += dt;

    for (const cw of workers) {
      if (!cw.archetype.spreads || cw.logic.state !== 'slacking' || cw.logic.escaped) continue;
      for (const ow of workers) {
        if (ow === cw || ow.logic.escaped) continue;
        const dx = ow.position.x - cw.position.x, dz = ow.position.z - cw.position.z;
        if (dx * dx + dz * dz <= CONFIG.chatterSpreadRadius ** 2) {
          applySlackPressure(ow.logic, dt, CONFIG.chatterSpreadFactor);
        }
      }
    }

    const active = workers.filter((w) => !w.logic.escaped);
    const output = crewOutputPerSecond(active.map((w) => w.logic));
    const res = advanceProgress(g.build, output, dt);
    g.build = { progress: res.progress, floorsBuilt: res.floorsBuilt };
    g.building.sync(res.floorsBuilt, res.progress / CONFIG.production.floorProgress);

    for (const w of workers) {
      if (w.justEscaped) { w.justEscaped = false; g.incidents += 1; g.combo = 0; }
    }
    if (active.some((w) => w.logic.state === 'sabotage' || w.logic.state === 'fleeing' || w.logic.state === 'riot')) {
      g.combo = 0;
    }
    g.crewRemaining = active.length;
  };

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hudEl.classList.remove('hidden');
    game.status = 'playing';
    game.start();
  });

  console.log('[construction-game] ready');
}
