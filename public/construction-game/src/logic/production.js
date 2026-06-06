import { CONFIG } from './config.js';
import { getArchetype } from './archetypes.js';
import { STATION } from './site.js';

export function workerOutput(worker) {
  const a = getArchetype(worker.archetypeId);
  const base = CONFIG.production.baseRatePerWorker * a.workRate;
  if (worker.state === 'working') {
    // SCV coupling: a working worker still walking to its slot contributes the reduced "travel"
    // factor; on-station (or undefined, for back-compat/tests) it contributes full output.
    const station = worker.onStation === false ? STATION.enRouteFactor : 1;
    return base * worker.boostMul * station;
  }
  if (worker.state === 'sabotage') return base * CONFIG.production.sabotageRate;
  return 0;
}

export function crewOutputPerSecond(workers) {
  let sum = 0;
  for (const w of workers) sum += workerOutput(w);
  return sum;
}

export function advanceProgress(build, outputPerSec, dt) {
  const floorProgress = CONFIG.production.floorProgress;
  let progress = build.progress + outputPerSec * dt;
  let floorsBuilt = build.floorsBuilt;
  let floorsCompletedThisStep = 0;
  while (progress >= floorProgress) {
    progress -= floorProgress;
    floorsBuilt += 1;
    floorsCompletedThisStep += 1;
  }
  return { progress, floorsBuilt, floorsCompletedThisStep };
}
