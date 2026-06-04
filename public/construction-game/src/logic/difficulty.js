export const DIFFICULTY_MODES = {
  easy:   { workerCount: 6,  shiftSeconds: 240, targetFloors: 4, rageDecayPerSec: 5.2, slackMult: 1.25, startFunds: 6000, floorReward: 1500 },
  normal: { workerCount: 8,  shiftSeconds: 180, targetFloors: 5, rageDecayPerSec: 4.0, slackMult: 1.0,  startFunds: 4000, floorReward: 1000 },
  hard:   { workerCount: 10, shiftSeconds: 150, targetFloors: 6, rageDecayPerSec: 3.2, slackMult: 0.8,  startFunds: 2500, floorReward: 700 },
};

export function applyDifficulty(config, mode) {
  const d = DIFFICULTY_MODES[mode];
  if (!d) throw new Error(`unknown difficulty: ${mode}`);
  config.workerCount = d.workerCount;
  config.shiftSeconds = d.shiftSeconds;
  config.targetFloors = d.targetFloors;
  config.rage.decayPerSec = d.rageDecayPerSec;
  config.slackMult = d.slackMult;
  config.economy.startFunds = d.startFunds;
  config.economy.floorReward = d.floorReward;
  return config;
}
