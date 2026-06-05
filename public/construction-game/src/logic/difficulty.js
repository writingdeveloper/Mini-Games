// Pacing note: rageDecayPerSec (how fast workers self-calm) and slackMult (higher = work longer
// before slacking) are tuned toward a more relaxed loop — workers need less constant soothing, so
// hiring managers genuinely lets you delegate and watch rather than micromanage every worker.
export const DIFFICULTY_MODES = {
  easy:   { workerCount: 6,  shiftSeconds: 280, targetBuildings: 2, rageDecayPerSec: 6.8, slackMult: 1.5,  startFunds: 6000, floorReward: 1000, eventBadMult: 0.6, eventGoodMult: 1.2 },
  normal: { workerCount: 8,  shiftSeconds: 240, targetBuildings: 3, rageDecayPerSec: 5.4, slackMult: 1.3,  startFunds: 4000, floorReward: 800,  eventBadMult: 1.0, eventGoodMult: 1.0 },
  hard:   { workerCount: 10, shiftSeconds: 200, targetBuildings: 4, rageDecayPerSec: 4.4, slackMult: 1.05, startFunds: 2500, floorReward: 600,  eventBadMult: 1.3, eventGoodMult: 0.9 },
};

/** Mutates `config` in place (modules read the live CONFIG singleton) and returns it. */
export function applyDifficulty(config, mode) {
  const d = DIFFICULTY_MODES[mode];
  if (!d) throw new Error(`unknown difficulty: ${mode}`);
  config.workerCount = d.workerCount;
  config.shiftSeconds = d.shiftSeconds;
  config.targetBuildings = d.targetBuildings;
  config.targetFloors = d.targetBuildings * config.production.floorsPerBuilding;
  config.rage.decayPerSec = d.rageDecayPerSec;
  config.slackMult = d.slackMult;
  config.economy.startFunds = d.startFunds;
  config.economy.floorReward = d.floorReward;
  config.events.badMult = d.eventBadMult;
  config.events.goodMult = d.eventGoodMult;
  return config;
}
