export const DIFFICULTY_MODES = {
  easy:   { workerCount: 6,  shiftSeconds: 280, targetBuildings: 2, rageDecayPerSec: 5.2, slackMult: 1.25, startFunds: 6000, floorReward: 1000 },
  normal: { workerCount: 8,  shiftSeconds: 240, targetBuildings: 3, rageDecayPerSec: 4.0, slackMult: 1.0,  startFunds: 4000, floorReward: 800 },
  hard:   { workerCount: 10, shiftSeconds: 200, targetBuildings: 4, rageDecayPerSec: 3.2, slackMult: 0.8,  startFunds: 2500, floorReward: 600 },
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
  return config;
}
