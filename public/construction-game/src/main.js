import * as THREE from 'three';
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { CONFIG } from './logic/config.js';
import { Site } from './world/Site.js';
import { Building } from './world/Building.js';
import { Foreman } from './entities/Foreman.js';
import { DioramaCamera } from './camera/DioramaCamera.js';
import { Worker } from './entities/Worker.js';
import { ConfrontationPrompt } from './ui/ConfrontationPrompt.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { createWorker, applySlackPressure } from './logic/workerState.js';
import { spawnWorkers, mulberry32 } from './logic/spawn.js';
import { crewOutputPerSecond, advanceProgress } from './logic/production.js';
import { applyTactic, tacticByKey } from './logic/tactics.js';
import { evaluate } from './logic/scoring.js';

const canvas = document.getElementById('game');
const menuEl = document.getElementById('menu');
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
  const diorama = new DioramaCamera(game.camera, foreman);
  game.systems.push(diorama);
  game.diorama = diorama;

  const placed = spawnWorkers(CONFIG.seed, CONFIG.workerCount);
  const rng = mulberry32(CONFIG.seed + 99);
  const workers = placed.map((p) =>
    game.add(new Worker(createWorker(p.id, p.archetypeId, rng), p.x, p.z, CONFIG.exit))
  );
  game.workers = workers;

  const prompt = new ConfrontationPrompt();

  function resetState() {
    game.status = 'playing';
    game.elapsed = 0;
    game.build = { progress: 0, floorsBuilt: 0 };
    game.combo = 0;
    game.incidents = 0;
    game.crewRemaining = CONFIG.workerCount;
    const rng2 = mulberry32(CONFIG.seed + 99);
    placed.forEach((p, i) => {
      const fresh = createWorker(p.id, p.archetypeId, rng2);
      Object.assign(workers[i].logic, fresh);
      workers[i].enteredRiot = false;
      workers[i].justEscaped = false;
      workers[i].object3d.visible = true;
      workers[i].position.set(p.x, 0, p.z);
      workers[i]._lastKey = '';
    });
    for (const f of game.building.floors) {
      game.building.object3d.remove(f);
      f.geometry.dispose();
    }
    game.building.floors = [];
    game.building.sync(0, 0);
    hudEl.classList.remove('hidden');
  }

  const menu = new Menu(game, () => { resetState(); game.start(); });

  game.systems.push(new HUD(game));

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

    prompt.update(g.foreman, workers);
    const tacticKey = g.input.state.tactic;
    if (tacticKey) {
      const target = prompt.current;
      const tacticId = tacticByKey(tacticKey);
      if (target && tacticId) {
        const wasSlacking = target.logic.state === 'slacking';
        applyTactic(target.logic, tacticId, target.archetype.rageSensitivity);
        target._lastKey = '';
        if (wasSlacking) g.combo += 1;
        if (g.diorama) g.diorama.pushIn(target.object3d, 1.2);
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

    const verdict = evaluate({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      crewRemaining: g.crewRemaining, crewCollapseThreshold: CONFIG.crewCollapseThreshold,
    });
    if (verdict !== 'playing') {
      g.status = verdict;
      menu.showResult(verdict);
    }
  };

  startBtn.addEventListener('click', () => {
    menuEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    game.status = 'playing';
    game.start();
  });

  console.log('[construction-game] ready');
}
