import { CONFIG } from './config.js';

export function clampRage(r) {
  return Math.max(0, Math.min(CONFIG.rage.max, r));
}

export function addRage(worker, delta, sensitivity = 1) {
  const scaled = delta > 0 ? delta * sensitivity : delta;
  worker.rage = clampRage(worker.rage + scaled);
  return worker;
}

export function decayRage(worker, dt) {
  worker.rage = Math.max(0, worker.rage - CONFIG.rage.decayPerSec * dt);
  return worker;
}

export function rageStage(rage) {
  const { sabotage, flee, riot } = CONFIG.rage;
  if (rage >= riot) return 'riot';
  if (rage >= flee) return 'fleeing';
  if (rage >= sabotage) return 'sabotage';
  return 'calm';
}
