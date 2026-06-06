import * as THREE from 'three';
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { CONFIG } from './logic/config.js';
import { Site } from './world/Site.js';
import { Building } from './world/Building.js';
import { Buildings } from './world/Buildings.js';
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
import { applyRetro, applyRetroToObject, setReducedMotionForScene } from './render/retroMaterial.js';
import { AudioManager } from './audio/AudioManager.js';
import { SETTINGS, saveSettings } from './logic/settings.js';
import { applyDifficulty } from './logic/difficulty.js';
import { createEconomy, earn, tickEconomy, spend } from './logic/economy.js';
import { Manager } from './entities/Manager.js';
import { HireMenu } from './ui/HireMenu.js';
import { getManagerArchetype } from './logic/managers.js';
import { SITE_EVENTS, pickEventGuarded, applyEventEffects, tickEventMultipliers, initEventState } from './logic/events.js';
import { Fx } from './world/Fx.js';
import { AssetLoader } from './assets/AssetLoader.js';

// Optional animated worker model (hybrid, S7): the primitive hammer-rig is the guaranteed-visible
// default. To activate a CC0 animated worker, drop the glb at assets/chars/worker.glb and set this URL
// — AssetLoader now zeroes metalness so Kenney/Quaternius chars render bright. Left null so no 404 is
// logged while the asset is absent. See docs/superpowers/assets-acquisition.md.
const WORKER_MODEL_URL = null;

const canvas = document.getElementById('game');
const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');

// Two independent toast channels (event vs reward/system), each with its own queue so a
// burst within a channel shows sequentially instead of clobbering. Cross-channel messages
// are positioned to coexist on screen (see .toast / .toast.reward in style.css).
function makeToastChannel(el) {
  const queue = [];
  // Snapshot the element's authored className as the per-message base, so a per-message valence
  // class can be layered on cleanly and fully reset each message (no stale valence lingering).
  const baseClass = el.className;
  let timer = 0, showing = false;
  function next() {
    if (!queue.length) { showing = false; return; }
    showing = true;
    const { msg, hold, cls } = queue.shift();
    el.textContent = msg;
    el.className = baseClass + (cls ? ' ' + cls : ''); // reset to base, then add this message's valence class
    el.classList.remove('hidden');
    clearTimeout(timer);
    // track the inter-message gap timer too, so reset() can cancel it (full restart-safety)
    timer = setTimeout(() => { el.classList.add('hidden'); timer = setTimeout(next, 120); }, hold);
  }
  return {
    show(msg, hold = 2200, cls = '') { queue.push({ msg, hold, cls }); if (!showing) next(); },
    reset() { queue.length = 0; showing = false; clearTimeout(timer); el.className = baseClass; el.classList.add('hidden'); },
  };
}
const eventToastCh = makeToastChannel(document.getElementById('toast'));
const rewardToastCh = makeToastChannel(document.getElementById('reward-toast'));
// Default export stays the reward channel so AssetLoader load-warnings + any other importer keep working.
export function showToast(msg) { rewardToastCh.show(msg); }
// Redundant (colorblind-safe) valence coding: a shape marker + a CSS class (border color) per event kind.
// Single source of truth for both the toast (item 2) and the start-menu legend (item 1).
const VALENCE = {
  good:    { marker: '▲', cls: 'good' },
  bad:     { marker: '▼', cls: 'bad' },
  neutral: { marker: '◆', cls: 'neutral' },
};
export function showEventToast(msg, kind) {
  const v = VALENCE[kind] || VALENCE.neutral;
  eventToastCh.show(`${v.marker} ${msg}`, 2200, v.cls);
}
export function showRewardToast(msg) { rewardToastCh.show(msg); }

let game = null;
try {
  game = new Game(canvas);
} catch (err) {
  console.error('[construction-game] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  // ---- static setup (once) ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7888, 1.5);
  game.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff0d0, 1.15);
  dir.position.set(20, 40, 10);
  game.scene.add(dir);

  game.pipeline = new RetroPipeline(480, 16); // render at 480p (window aspect), nearest-upscaled — crisper but still retro

  const input = new Input();
  game.input = input;

  game.add(new Site());
  game.fx = game.add(new Fx(game.scene)); // pooled floor-complete dust/spark (persists across restarts)

  // Optional worker model load (no-op while WORKER_MODEL_URL is null → no 404). Loads once; workers
  // built afterwards pick it up in buildWorld, else they keep the primitive hammer-rig.
  game._workerModel = null;
  if (WORKER_MODEL_URL) {
    game._charLoader = new AssetLoader(showRewardToast);
    game._charLoader.load(WORKER_MODEL_URL).then((e) => { game._workerModel = e; });
  }

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

  // Characters (workers + managers) use bright flat-shaded primitives — the downloaded glTF character
  // models rendered near-black (dark PBR + metalness, no env map) and were effectively invisible.
  // (Props still use glTF via Site.js, which renders fine.)

  // Apply a random site event (S6): delegate state mutation to the pure fn, keep side effects (toast/audio) here.
  // _eventState holds the 4 mult/timer fields; attach live workers/economy refs so the pure fn mutates in place.
  function applyEvent(ev, g) {
    const s = g._eventState;
    s.workers = g.workers; s.economy = g.economy;
    const res = applyEventEffects(s, ev, CONFIG.events, g._eventRng, CONFIG.rage.flee);
    showEventToast(`${ev.icon} ${ev.label}`, ev.kind);
    if (g.audio) { if (res.kind === 'bad') g.audio.alarm(); else g.audio.combo(); }
  }

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

  // Events legend (a11y onboarding): built once from SITE_EVENTS so it can't drift from the catalog.
  // Each row mirrors the toast's valence marker (▲/▼/◆), doubling as a key for the colorblind-safe coding.
  const legendEl = document.getElementById('events-legend');
  if (legendEl) {
    for (const ev of SITE_EVENTS) {
      const v = VALENCE[ev.kind] || VALENCE.neutral;
      const row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML =
        `<span class="legend-icon">${ev.icon}</span>` +
        `<span class="legend-label">${ev.label}</span>` +
        `<span class="legend-marker ${v.cls}">${v.marker}</span>`;
      legendEl.appendChild(row);
    }
  }

  // remove an entity from the scene + systems list, disposing its GPU resources
  function removeEntity(e) {
    if (e.object3d) {
      game.scene.remove(e.object3d);
      e.object3d.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          if (m.userData.shared) continue;
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
    }
    const i = game.systems.indexOf(e);
    if (i >= 0) game.systems.splice(i, 1);
  }

  // difficulty-dependent world, (re)built on start/restart
  let building = null, workers = [], placed = [];

  function buildWorld() {
    if (building) removeEntity(building);
    building = game.add(new Buildings(CONFIG.targetBuildings, CONFIG.production.floorsPerBuilding));
    game.building = building;
    for (const fm of building.floorMats) applyRetro(fm, { snap: 160, affine: false });

    for (const w of workers) removeEntity(w);
    for (const m of (game.managers || [])) removeEntity(m);
    game.managers = [];
    workers = [];
    placed = spawnWorkers(CONFIG.seed, CONFIG.workerCount);
    const rng = mulberry32(CONFIG.seed + 99);
    for (const p of placed) {
      const wk = game.add(new Worker(createWorker(p.id, p.archetypeId, rng), p.x, p.z, CONFIG.exit));
      if (game._workerModel && game._charLoader) wk.setModel(game._workerModel, game._charLoader);
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
    eventToastCh.reset();
    rewardToastCh.reset();
    if (game.fx) game.fx.reset(); // clear any in-flight FX sprites from a prior shift
    buildWorld();
    game._session = (game._session || 0) + 1; // bumped each playthrough; seeds the per-session event RNG below
    game.economy = createEconomy(CONFIG.economy.startFunds);
    // Per-session reseed: each playthrough gets a distinct (but fully deterministic) event sequence.
    // 2654435761 = Knuth's multiplicative hash; spreads consecutive session numbers into very different seeds.
    // >>> 0 keeps it a uint32 for mulberry32. No Math.random -> e2e stays deterministic.
    game._eventRng = mulberry32((CONFIG.seed + 777 + (game._session || 0) * 2654435761) >>> 0);
    game._eventTimer = CONFIG.events.firstDelaySec;
    // Test hook: ?eventDelay=<sec> fires the first event quickly so e2e can smoke the runtime
    // path (toast/audio/multipliers). Production default (firstDelaySec) is unchanged.
    try {
      const ed = parseFloat(new URLSearchParams(location.search).get('eventDelay'));
      if (isFinite(ed) && ed >= 0) game._eventTimer = ed;
    } catch (e) { /* no URL/search available — keep default */ }
    game._eventCtx = { firstEvent: true, lastKind: null }; // first event of a session is never bad
    game._eventState = initEventState(); // prod/boost multipliers + their countdown timers
    applyRetroToObject(game.scene, { snap: 160, affine: false });
    menuEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    hireMenu.show();
    hireMenu.refresh();
    game.start();
  }

  const menu = new Menu(game, () => startGame(game.difficulty || selectedMode));

  // ---- accessibility toggles (mute / reduced-motion), persisted via SETTINGS ----
  const muteToggle = document.getElementById('mute-toggle');
  const motionToggle = document.getElementById('motion-toggle');
  function refreshToggleUI() {
    if (muteToggle) {
      muteToggle.classList.toggle('active', SETTINGS.muted);
      muteToggle.setAttribute('aria-pressed', String(SETTINGS.muted));
      muteToggle.textContent = SETTINGS.muted ? '🔇 음소거: 켜짐' : '🔇 음소거: 꺼짐';
    }
    if (motionToggle) {
      motionToggle.classList.toggle('active', SETTINGS.reducedMotion);
      motionToggle.setAttribute('aria-pressed', String(SETTINGS.reducedMotion));
      motionToggle.textContent = SETTINGS.reducedMotion ? '🐢 모션 줄이기: 켜짐' : '🐢 모션 줄이기: 꺼짐';
    }
  }
  // Apply persisted settings at startup: body class for CSS, and mute is applied to audio after init().
  document.body.classList.toggle('reduced-motion', SETTINGS.reducedMotion);
  refreshToggleUI();
  if (muteToggle) muteToggle.addEventListener('click', () => {
    SETTINGS.muted = !SETTINGS.muted;
    audio.setMuted(SETTINGS.muted);
    saveSettings();
    refreshToggleUI();
  });
  if (motionToggle) motionToggle.addEventListener('click', () => {
    SETTINGS.reducedMotion = !SETTINGS.reducedMotion;
    document.body.classList.toggle('reduced-motion', SETTINGS.reducedMotion);
    // Best-effort live update of the vertex-jitter on already-built materials; otherwise it takes
    // effect on next restart (buildWorld recreates materials). Riot-bob/push-in read the flag live.
    if (game.scene) setReducedMotionForScene(game.scene, SETTINGS.reducedMotion);
    saveSettings();
    refreshToggleUI();
  });

  game.step = (dt, g) => {
    if (g.status !== 'playing') return;
    g.elapsed += dt;

    // --- site events (S6) ---
    tickEventMultipliers(g._eventState, dt);
    g._eventTimer -= dt;
    if (g._eventTimer <= 0) {
      const ev = pickEventGuarded(g._eventRng, g._eventCtx);
      g._eventCtx.firstEvent = false;
      g._eventCtx.lastKind = ev.kind;
      applyEvent(ev, g);
      const E = CONFIG.events;
      g._eventTimer = E.intervalSec + (g._eventRng() * 2 - 1) * E.intervalVariance;
    }

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
    const output = crewOutputPerSecond(active.map((w) => w.logic)) * g._eventState.prodMult * g._eventState.boostMult;
    const res = advanceProgress(g.build, output, dt);
    g.build = { progress: res.progress, floorsBuilt: res.floorsBuilt };
    g.building.sync(res.floorsBuilt, res.progress / CONFIG.production.floorProgress);
    // steady hammer rhythm while the crew is actually on-station building (self-throttled in AudioManager)
    if (g.audio && active.some((w) => w.logic.state === 'working' && w.logic.onStation)) g.audio.hammer();
    if (res.floorsCompletedThisStep > 0) {
      const F = CONFIG.production.floorsPerBuilding;
      const before = res.floorsBuilt - res.floorsCompletedThisStep;
      const buildingsDone = Math.floor(res.floorsBuilt / F) - Math.floor(before / F);
      if (g.economy) earn(g.economy, res.floorsCompletedThisStep * CONFIG.economy.floorReward + buildingsDone * CONFIG.economy.buildingBonus);
      if (g.audio) { g.audio.floorUp(); if (buildingsDone > 0) g.audio.buildingDone(); }
      if (buildingsDone > 0) showRewardToast(`🏢 건물 완공! +${buildingsDone * CONFIG.economy.buildingBonus}`);
      // S4 reaction FX: dust+spark burst at the just-finished floor + a tiered camera shake.
      if (g.fx && g.building.activeCenter) {
        const c = g.building.activeCenter;
        const floorsInActive = res.floorsBuilt - g.building.activeIndex * F;
        const y = 0.5 + Math.max(1, Math.min(F, floorsInActive)) * 2.4;
        g.fx.floorBurst(c.x, y, c.z);
      }
      if (g.diorama) g.diorama.shake(buildingsDone > 0 ? 0.6 : 0.3, buildingsDone > 0 ? 0.4 : 0.25);
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
        showRewardToast(`💸 적자 — ${fired.label} 해고`);
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
    audio.setMuted(SETTINGS.muted); // honor a persisted mute now that the master gain exists
    audio.resume();
    startGame(selectedMode);
  });

  console.log('[construction-game] ready');
}
