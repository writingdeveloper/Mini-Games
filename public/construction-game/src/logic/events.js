// Random site events (S6). THREE-free pure logic — deterministic, unit-tested.
export const SITE_EVENTS = [
  { id: 'snack',      label: '새참 타임!',     icon: '🍱', weight: 3, kind: 'good' },
  { id: 'supply',     label: '자재 보급 도착',  icon: '📦', weight: 3, kind: 'good' },
  { id: 'inspection', label: '안전 점검',       icon: '🛡️', weight: 2, kind: 'neutral' },
  { id: 'breakdown',  label: '장비 고장',       icon: '🔧', weight: 2, kind: 'bad' },
  { id: 'accident',   label: '낙하 사고!',      icon: '⚠️', weight: 2, kind: 'bad' },
];

// Catalog leans good (good weight > bad weight) so events stay fun, not punishing.
// The invariant is asserted in events.test.ts so it can't silently regress.

/** Pick one event using weighted random selection. `rng` is a function returning [0,1). Deterministic. */
export function pickEvent(rng) {
  const total = SITE_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of SITE_EVENTS) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return SITE_EVENTS[SITE_EVENTS.length - 1]; // float-safety fallback
}

/** Neutral starting state for the event multiplier/timer channels. */
export function initEventState() {
  return { prodMult: 1, prodTimer: 0, boostMult: 1, boostTimer: 0 };
}

// Pure, THREE-free. Mutates `state` (workers' .logic, economy, the 4 mult/timer fields).
// `rng` returns [0,1). `helpers.addRage` is injected (rage.js) to keep this module THREE-free & import-light.
// Returns { id, kind } for the engine to drive toast/audio.
export function applyEventEffects(state, ev, E, rng, helpers) {
  const { addRage } = helpers;
  switch (ev.id) {
    case 'snack':
      for (const w of state.workers) { if (w.logic.escaped) continue; addRage(w.logic, -E.snackRageDrop, w.archetype.rageSensitivity); }
      state.boostMult = E.snackBoost; state.boostTimer = E.snackSec; break;
    case 'supply':
      if (state.economy) state.economy.funds += E.supplyBonus;
      state.boostMult = E.supplyBoost; state.boostTimer = E.supplySec; break;
    case 'inspection':
      if (state.economy) state.economy.funds += E.inspectionBonus; break;
    case 'breakdown':
      state.prodMult = E.breakdownProdMult; state.prodTimer = E.breakdownSec; break;
    case 'accident': {
      const victims = state.workers.filter((w) => !w.logic.escaped);
      if (victims.length) { const v = victims[Math.floor(rng() * victims.length)]; addRage(v.logic, E.accidentRageSpike, v.archetype.rageSensitivity); }
      break;
    }
  }
  return { id: ev.id, kind: ev.kind };
}

// Pure, THREE-free. Decays the boost/prod multiplier timers; restores each multiplier to 1 on expiry.
export function tickEventMultipliers(state, dt) {
  if (state.boostTimer > 0) { state.boostTimer -= dt; if (state.boostTimer <= 0) { state.boostTimer = 0; state.boostMult = 1; } }
  if (state.prodTimer > 0)  { state.prodTimer -= dt;  if (state.prodTimer <= 0)  { state.prodTimer = 0;  state.prodMult = 1; } }
}
