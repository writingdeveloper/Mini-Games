import { CONFIG } from './config.js';

export function isWin(s) {
  return s.floorsBuilt >= s.targetFloors;
}

export function isDefeat(s) {
  const timedOut = s.elapsed >= s.shiftSeconds && s.floorsBuilt < s.targetFloors;
  const collapsed = s.crewRemaining < s.crewCollapseThreshold;
  return timedOut || collapsed;
}

export function evaluate(s) {
  if (isWin(s)) return 'win';
  if (isDefeat(s)) return 'defeat';
  return 'playing';
}

export function scoreMultiplier(combo) {
  return 1 + Math.max(0, combo) * CONFIG.scoring.comboStep;
}

export function computeScore(s) {
  const { floorPoints, timeBonusPerSec, noIncidentBonus } = CONFIG.scoring;
  const remaining = Math.max(0, Math.floor(s.shiftSeconds - s.elapsed));
  const base = s.floorsBuilt * floorPoints + remaining * timeBonusPerSec;
  const total = Math.round(base * scoreMultiplier(s.combo));
  return total + (s.incidents === 0 ? noIncidentBonus : 0);
}
