export const CONFIG = {
  round: { duration: 90 },                  // seconds per round
  fry: { length: 1.6, thickness: 0.18, mass: 0.2 },
  spawn: { y: 9, xRange: 2.4 },             // active fry hover height + max horizontal travel
  scoring: { perMeter: 100, stableBonus: 25, comboStep: 10, timeBonus: 2 },
  combo: { chargePerStable: 1, max: 10 },
  stability: { settleSpeed: 0.25, settleTime: 0.6 }, // body considered "stable" below this speed for this long
};
