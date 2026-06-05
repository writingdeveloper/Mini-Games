export const CONFIG = {
  seed: 7777,
  shiftSeconds: 180,
  targetFloors: 5,
  workerCount: 8,
  site: { width: 44, depth: 44 },
  exit: { x: 0, z: 22 },
  rage: { max: 100, sabotage: 60, flee: 80, riot: 95, decayPerSec: 4 },
  tactics: {
    bark:   { id: 'bark',   key: 1, label: '윽박', icon: '💢', rageDelta: 28,  boost: 2.0, boostSeconds: 5 },
    taunt:  { id: 'taunt',  key: 2, label: '비꼬기', icon: '😏', rageDelta: 15, boost: 1.6, boostSeconds: 5 },
    soothe: { id: 'soothe', key: 3, label: '달래기', icon: '🤝', rageDelta: -25, boost: 1.3, boostSeconds: 5 },
  },
  production: { baseRatePerWorker: 1.0, floorProgress: 100, sabotageRate: 0.2, floorsPerBuilding: 3 },
  worker: { confrontRadius: 4.5, wanderRadius: 2.2, moveSpeed: 3.2, fleeSpeed: 6, minSlackSeconds: 2 },
  crewCollapseThreshold: 2,
  chatterSpreadRadius: 6,
  chatterSpreadFactor: 2.0,
  riotInciteRadius: 7,
  riotIncitePerSec: 10,
  scoring: { floorPoints: 1000, timeBonusPerSec: 10, comboStep: 0.1, noIncidentBonus: 2000 },
  slackMult: 1.0,
  economy: {
    startFunds: 4000,
    floorReward: 1000,
    buildingBonus: 2000, // awarded per completed building (S4 multi-building)
    fireCooldownSec: 3,
    managerCap: 6,
  },
  events: {
    intervalSec: 30,        // base seconds between site events
    intervalVariance: 12,   // +/- random jitter on the interval
    firstDelaySec: 18,      // grace period before the very first event
    snackRageDrop: 22,      // 새참: rage subtracted from every worker
    snackBoost: 1.4,        // 새참: production multiplier while active
    snackSec: 8,            // 새참: duration
    supplyBonus: 600,       // 자재 보급: funds granted
    supplyBoost: 1.3,       // 자재 보급: production multiplier while active
    supplySec: 8,           // 자재 보급: duration
    inspectionBonus: 800,   // 안전 점검: funds granted (neutral/good)
    breakdownProdMult: 0.5, // 장비 고장: production multiplier while active
    breakdownSec: 9,        // 장비 고장: duration
    accidentRageSpike: 35,  // 낙하 사고: rage added to one random worker
    badMult: 1,             // per-difficulty scaler for bad-event magnitude/duration (overwritten by applyDifficulty)
    goodMult: 1,            // per-difficulty scaler for good-event magnitude (overwritten by applyDifficulty)
  },
};
