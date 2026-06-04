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
import { addRage } from './logic/rage.js';
import { evaluate } from './logic/scoring.js';
import { RetroPipeline } from './render/RetroPipeline.js';
import { applyRetro, applyRetroToObject } from './render/retroMaterial.js';
import { AudioManager } from './audio/AudioManager.js';
import { applyDifficulty } from './logic/difficulty.js';
import { createEconomy, earn, tickEconomy, spend } from './logic/economy.js';
import { Manager } from './entities/Manager.js';
import { HireMenu } from './ui/HireMenu.js';
import { getManagerArchetype } from './logic/managers.js';

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
  // ---- static setup (once) ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.0);
  game.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff0d0, 0.7);
  dir.position.set(20, 40, 10);
  game.scene.add(dir);

  game.pipeline = new RetroPipeline(320, 240, 16);

  const input = new Input();
  game.input = input;

  game.add(new Site());

  const foreman = game.add(new Foreman(input));
  game.foreman = foreman;
  const diorama = new DioramaCamera(game.camera, foreman);
  game.systems.push(diorama);
  game.diorama = diorama;

  game.systems.push(new HUD(game));
  const prompt = new ConfrontationPrompt();

  const audio = new AudioManager();
  game.audio = audio;
  game.managers = [];

  const hireMenu = new HireMenu(game, (id) => {
    const a = getManagerArchetype(id);
    if (game.managers.length >= CONFIG.economy.managerCap || !game.economy || !spend(game.economy, a.hireCost)) return;
    const m = game.add(new Manager(id));
    game.managers.push(m);
    if (game.audio) game.audio.combo();
    hireMenu.refresh();
  });
  game.hireMenu = hireMenu;

  // difficulty selection on the menu
  let selectedMode = 'normal';
  document.querySelectorAll('#difficulty .diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#difficulty .diff-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMode = btn.getAttribute('data-mode');
    });
  });

  // remove an entity from the scene + systems list, disposing its GPU resources
  function removeEntity(e) {
    if (e.object3d) {
      game.scene.remove(e.object3d);
      e.object3d.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      });
    }
    const i = game.systems.indexOf(e);
    if (i >= 0) game.systems.splice(i, 1);
  }

  // difficulty-dependent world, (re)built on start/restart
  let building = null, workers = [], placed = [];

  function buildWorld() {
    if (building) removeEntity(building);
    building = game.add(new Building());
    game.building = building;
    applyRetro(game.building.floorMat, { snap: 160, affine: false });

    for (const w of workers) removeEntity(w);
    for (const m of (game.managers || [])) removeEntity(m);
    game.managers = [];
    workers = [];
    placed = spawnWorkers(CONFIG.seed, CONFIG.workerCount);
    const rng = mulberry32(CONFIG.seed + 99);
    for (const p of placed) {
      const wk = game.add(new Worker(createWorker(p.id, p.archetypeId, rng), p.x, p.z, CONFIG.exit));
      workers.push(wk);
    }
    game.workers = workers;
  }

  function startGame(mode) {
    applyDifficulty(CONFIG, mode);
    game.difficulty = mode;
    game.status = 'playing';
    game.elapsed = 0;
    game.build = { progress: 0, floorsBuilt: 0 };
    game.combo = 0;
    game.incidents = 0;
    game.crewRemaining = CONFIG.workerCount;
    if (game.diorama) { game.diorama.mode = 'overseer'; game.diorama.focus = null; }
    clearTimeout(toastTimer);
    toast.classList.add('hidden');
    buildWorld();
    game.economy = createEconomy(CONFIG.economy.startFunds);
    applyRetroToObject(game.scene, { snap: 160, affine: false });
    menuEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    hireMenu.show();
    hireMenu.refresh();
    game.start();
  }

  const menu = new Menu(game, () => startGame(game.difficulty || selectedMode));

  game.step = (dt, g) => {
    if (g.status !== 'playing') return;
    g.elapsed += dt;

    // chatter spread
    for (const cw of workers) {
      if (!cw.archetype.spreads || cw.logic.state !== 'slacking' || cw.logic.escaped) continue;
      for (const ow of workers) {
        if (ow === cw || ow.logic.escaped) continue;
        const dx = ow.position.x - cw.position.x, dz = ow.position.z - cw.position.z;
        if (dx * dx + dz * dz <= CONFIG.chatterSpreadRadius ** 2) applySlackPressure(ow.logic, dt, CONFIG.chatterSpreadFactor);
      }
    }

    // riot incitement
    for (const rw of workers) {
      if (rw.logic.state !== 'riot' || rw.logic.escaped) continue;
      for (const ow of workers) {
        if (ow === rw || ow.logic.escaped) continue;
        const dx = ow.position.x - rw.position.x, dz = ow.position.z - rw.position.z;
        if (dx * dx + dz * dz <= CONFIG.riotInciteRadius ** 2) addRage(ow.logic, CONFIG.riotIncitePerSec * dt, ow.archetype.rageSensitivity);
      }
    }

    // confrontation
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
        if (g.audio) { g.audio.shout(tacticId); if (wasSlacking && g.combo >= 2) g.audio.combo(); }
      }
    }

    // production
    const active = workers.filter((w) => !w.logic.escaped);
    const output = crewOutputPerSecond(active.map((w) => w.logic));
    const res = advanceProgress(g.build, output, dt);
    g.build = { progress: res.progress, floorsBuilt: res.floorsBuilt };
    g.building.sync(res.floorsBuilt, res.progress / CONFIG.production.floorProgress);
    if (res.floorsCompletedThisStep > 0) {
      if (g.economy) earn(g.economy, res.floorsCompletedThisStep * CONFIG.economy.floorReward);
      if (g.audio) g.audio.floorUp();
    }

    // incidents + combo reset
    for (const w of workers) {
      if (w.justEscaped) { w.justEscaped = false; g.incidents += 1; g.combo = 0; if (g.audio) g.audio.alarm(); }
      if (w.justRiotted) { w.justRiotted = false; g.incidents += 1; g.combo = 0; if (g.audio) g.audio.alarm(); }
    }
    if (active.some((w) => w.logic.state === 'sabotage' || w.logic.state === 'fleeing' || w.logic.state === 'riot')) g.combo = 0;
    g.crewRemaining = active.length;
    if (g.economy) {
      const fireIdx = tickEconomy(g.economy, g.managers, dt);
      if (fireIdx >= 0 && g.managers[fireIdx]) {
        const fired = g.managers.splice(fireIdx, 1)[0];
        removeEntity(fired);
        showToast(`💸 적자 — ${fired.label} 해고`);
      }
    }

    if (g.hireMenu && g.hireMenu.open) g.hireMenu.refresh();

    // win / lose
    const verdict = evaluate({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      crewRemaining: g.crewRemaining, crewCollapseThreshold: CONFIG.crewCollapseThreshold,
    });
    if (verdict !== 'playing') { g.status = verdict; if (g.hireMenu) g.hireMenu.hide(); menu.showResult(verdict); }
  };

  startBtn.addEventListener('click', () => {
    audio.init();
    audio.resume();
    startGame(selectedMode);
  });

  console.log('[construction-game] ready');
}
