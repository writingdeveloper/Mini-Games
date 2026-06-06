// Manager archetypes + pure AI helpers (triage targeting, safe tactic choice, separation).
// `awareness` = how far an ACTIVE manager notices a problem worker (a zone, not the whole 44-wide
// lot — so manager count/placement matters). `radius` = the vibe manager's calming AURA. veteran is
// the widest/most-reliable; intern the shortest/cheapest. auraRageDecay names the vibe aura strength.
export const MANAGER_ARCHETYPES = {
  veteran: { id: 'veteran', label: '김 베테랑', icon: '🧓', tactic: 'soothe', radius: 7,   awareness: 16, cooldown: 2.5, hireCost: 1200, salary: 6,  successRate: 1.0, passive: false, color: 0x8a8f96, helmet: 0xb0b6bd, model: './assets/managers/veteran.glb' },
  drill:   { id: 'drill',   label: '박 군기',   icon: '🪖', tactic: 'bark',   radius: 4.5, awareness: 13, cooldown: 2.0, hireCost: 1400, salary: 8,  successRate: 1.0, passive: false, color: 0x9a4a3a, helmet: 0xc0392b, model: './assets/managers/drill.glb' },
  vibe:    { id: 'vibe',    label: '이 인싸',   icon: '😎', tactic: null,     radius: 8,   awareness: 12, cooldown: 1.0, hireCost: 1000, salary: 5,  successRate: 1.0, passive: true,  color: 0x3a8a6a, helmet: 0x2ecc71, auraRageDecay: 1.6, model: './assets/managers/vibe.glb' },
  intern:  { id: 'intern',  label: '최 인턴',   icon: '🧑‍🎓', tactic: 'soothe', radius: 4,   awareness: 10, cooldown: 3.0, hireCost: 500,  salary: 3,  successRate: 0.7, passive: false, color: 0x9a8f5a, helmet: 0xd8c24a, model: './assets/managers/intern.glb' },
};

export const MANAGER_LIST = Object.values(MANAGER_ARCHETYPES);

export function getManagerArchetype(id) {
  const a = MANAGER_ARCHETYPES[id];
  if (!a) throw new Error(`unknown manager: ${id}`);
  return a;
}

// --- triage tuning ---------------------------------------------------------
// Danger weighting: a crisis (riot/fleeing/sabotage) outranks mere slacking, so managers handle the
// workers about to be LOST before tidying loafers — the previous code did the opposite (it only ever
// chased slacking/sabotage and was blind to fleeing/riot, which is why "managing felt pointless").
const STATE_WEIGHT = { slacking: 1, sabotage: 2, fleeing: 3, riot: 4 };
const PREEMPT_MARGIN = 12; // act on a still-"working" worker once rage gets within this of flee
const LEAN = 0.5;          // sub-band nudge from archetype preference (kept < a full danger band)
const K_DIST = 0.15;       // distance is only a tiebreak WITHIN a danger band, never across one

// Urgency score for one worker from a given manager. -Infinity = ineligible (out of awareness,
// not a problem, or — for aggressive managers — penalised crisis state). Higher = handle sooner.
// worker view: { x, z, state, rage, escaped, sensitivity }.
export function scoreManagerTarget(managerPos, archetype, worker, rageCfg) {
  if (worker.escaped) return -Infinity;
  const aware = archetype.awareness ?? 12;
  const dx = worker.x - managerPos.x, dz = worker.z - managerPos.z;
  const distSq = dx * dx + dz * dz;
  if (distSq > aware * aware) return -Infinity;

  let weight = STATE_WEIGHT[worker.state] || 0;
  if (weight === 0) {
    // not in a problem state — only a pre-emptible (rising toward flee) worker is worth a look
    if (worker.rage >= rageCfg.flee - PREEMPT_MARGIN) weight = 0.5;
    else return -Infinity;
  }

  // archetype lean (sub-band): soothers value rescuing hot workers; aggressors avoid crises they'd worsen
  if (archetype.tactic === 'soothe') {
    weight += LEAN * (worker.rage / rageCfg.max);
  } else if (archetype.tactic === 'bark' || archetype.tactic === 'taunt') {
    if (worker.state === 'fleeing' || worker.state === 'riot') weight -= 3;
  }
  if (weight <= 0) return -Infinity;

  return weight * 100 - distSq * K_DIST;
}

// Which tactic this manager should apply to a worker — NEVER one that would shove the worker across
// the flee threshold (the old code let a drill bark a rage-70 worker straight into a riot). Soothe
// (rageDelta<=0) is always safe; an aggressor falls back bark->taunt, then declines (returns null) so
// it is never the one who triggers the flee/riot it was hired to prevent. addRage scales only positive
// deltas by sensitivity (see rage.js), so the projection mirrors that.
export function chooseTactic(archetype, worker, tactics, rageCfg) {
  const primary = archetype.tactic;
  if (!primary) return null; // passive (vibe) acts via its aura, not a walk-up tactic
  const safe = (id) => {
    const t = tactics[id];
    if (!t) return false;
    if (t.rageDelta <= 0) return true;
    return worker.rage + t.rageDelta * worker.sensitivity < rageCfg.flee;
  };
  if (safe(primary)) return primary;
  if (primary === 'bark' && safe('taunt')) return 'taunt';
  return null;
}

// Picker-consistent score used by BOTH the live Manager entity (for hysteresis) and pickManagerTarget,
// so the entity and the unit-tested logic can never diverge (the old pickManagerTarget was dead code
// that had already drifted from Manager.js on the search range). ctx = { tactics, rage }.
export function managerTargetScore(managerPos, archetype, worker, ctx) {
  const base = scoreManagerTarget(managerPos, archetype, worker, ctx.rage);
  if (base === -Infinity) return -Infinity;
  // an active manager that can't safely act on this worker shouldn't target it at all
  if (!archetype.passive && chooseTactic(archetype, worker, ctx.tactics, ctx.rage) === null) return -Infinity;
  return base;
}

// Highest-urgency eligible worker for this manager; -1 if none. workers = array of worker views.
export function pickManagerTarget(managerPos, archetype, workers, ctx) {
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < workers.length; i++) {
    const s = managerTargetScore(managerPos, archetype, workers[i], ctx);
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}

// separation lives in site.js (shared spatial helper used by both workers and managers); re-exported
// here so existing importers (Manager.js, managers.test.ts) keep their import path.
export { separation } from './site.js';
