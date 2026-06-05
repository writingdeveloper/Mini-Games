// Random site events (S6). THREE-free pure logic — deterministic, unit-tested.
export const SITE_EVENTS = [
  { id: 'snack',      label: '새참 타임!',     icon: '🍱', weight: 3, kind: 'good' },
  { id: 'supply',     label: '자재 보급 도착',  icon: '📦', weight: 3, kind: 'good' },
  { id: 'inspection', label: '안전 점검',       icon: '🛡️', weight: 2, kind: 'neutral' },
  { id: 'breakdown',  label: '장비 고장',       icon: '🔧', weight: 2, kind: 'bad' },
  { id: 'accident',   label: '낙하 사고!',      icon: '⚠️', weight: 2, kind: 'bad' },
];

// total weight = 12; good weight = 6 > bad weight = 4 (good-leaning, by design)

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
