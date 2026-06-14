import { CONFIG } from './config.js';

export function createCombo() { return { count: 0, charge: 0 }; }

// A stable placement extends the streak and charges sabotage (used in Phase 3).
export function onStablePlacement(c, cfg = CONFIG.combo) {
  return {
    count: Math.min(cfg.max, c.count + 1),
    charge: Math.min(cfg.max, c.charge + cfg.chargePerStable),
  };
}

// A collapse breaks the streak but does not drain stored charge.
export function onCollapse(c) {
  return { count: 0, charge: c.charge };
}
