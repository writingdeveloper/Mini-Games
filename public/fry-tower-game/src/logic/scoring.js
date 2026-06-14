import { CONFIG } from './config.js';

// Pure scoring. All inputs clamped to >= 0; result is an integer.
export function roundScore({ height = 0, combo = 0, stableCount = 0, secondsLeft = 0 } = {}, cfg = CONFIG.scoring) {
  const h = Math.max(0, height) * cfg.perMeter;
  const stable = Math.max(0, stableCount) * cfg.stableBonus;
  const comboBonus = Math.max(0, combo) * cfg.comboStep;
  const time = Math.max(0, secondsLeft) * cfg.timeBonus;
  return Math.round(h + stable + comboBonus + time);
}
