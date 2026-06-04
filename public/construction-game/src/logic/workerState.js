import { CONFIG } from './config.js';
import { getArchetype } from './archetypes.js';
import { decayRage, rageStage } from './rage.js';

export const STATES = ['working', 'slacking', 'sabotage', 'fleeing', 'riot'];

export function createWorker(id, archetypeId, rng) {
  const a = getArchetype(archetypeId);
  const slackTimer = a.slackMeanSeconds + (rng() * 2 - 1) * a.slackVariance;
  return {
    id,
    archetypeId,
    state: 'working',
    activity: 'working',
    rage: 0,
    slackTimer: Math.max(CONFIG.worker.minSlackSeconds, slackTimer),
    boostMul: 1,
    boostTimer: 0,
    escaped: false,
  };
}

export function deriveState(worker) {
  const stage = rageStage(worker.rage);
  if (stage !== 'calm') return stage;
  return worker.activity === 'working' ? 'working' : 'slacking';
}

export function stepWorker(worker, dt) {
  if (worker.boostTimer > 0) {
    worker.boostTimer = Math.max(0, worker.boostTimer - dt);
    if (worker.boostTimer === 0) worker.boostMul = 1;
  }
  decayRage(worker, dt);
  if (worker.activity === 'working') {
    worker.slackTimer -= dt;
    if (worker.slackTimer <= 0) worker.activity = 'slacking';
  }
  worker.state = deriveState(worker);
  return worker;
}

export function applySlackPressure(worker, dt, factor) {
  if (worker.activity === 'working') worker.slackTimer -= dt * factor;
  return worker;
}
