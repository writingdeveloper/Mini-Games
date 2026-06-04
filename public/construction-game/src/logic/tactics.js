import { CONFIG } from './config.js';
import { addRage } from './rage.js';

export const TACTICS = CONFIG.tactics;

export function tacticByKey(n) {
  for (const t of Object.values(TACTICS)) if (t.key === n) return t.id;
  return null;
}

export function applyTactic(worker, tacticId, sensitivity = 1) {
  const t = TACTICS[tacticId];
  if (!t) throw new Error(`unknown tactic: ${tacticId}`);
  addRage(worker, t.rageDelta, sensitivity);
  worker.activity = 'working';
  worker.slackTimer = 0;
  worker.boostMul = t.boost;
  worker.boostTimer = t.boostSeconds;
  return worker;
}
