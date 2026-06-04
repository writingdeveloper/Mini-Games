export const MANAGER_ARCHETYPES = {
  veteran: { id: 'veteran', label: '김 베테랑', icon: '🧓', tactic: 'soothe', radius: 7,   cooldown: 2.5, hireCost: 1200, salary: 6,  successRate: 1.0, passive: false, color: 0x8a8f96, helmet: 0xb0b6bd },
  drill:   { id: 'drill',   label: '박 군기',   icon: '🪖', tactic: 'bark',   radius: 4.5, cooldown: 2.0, hireCost: 2000, salary: 12, successRate: 1.0, passive: false, color: 0x9a4a3a, helmet: 0xc0392b },
  vibe:    { id: 'vibe',    label: '이 인싸',   icon: '😎', tactic: null,     radius: 8,   cooldown: 1.0, hireCost: 1000, salary: 5,  successRate: 1.0, passive: true,  color: 0x3a8a6a, helmet: 0x2ecc71 },
  intern:  { id: 'intern',  label: '최 인턴',   icon: '🧑‍🎓', tactic: 'soothe', radius: 4,   cooldown: 3.0, hireCost: 500,  salary: 3,  successRate: 0.7, passive: false, color: 0x9a8f5a, helmet: 0xd8c24a },
};

export const MANAGER_LIST = Object.values(MANAGER_ARCHETYPES);

export function getManagerArchetype(id) {
  const a = MANAGER_ARCHETYPES[id];
  if (!a) throw new Error(`unknown manager: ${id}`);
  return a;
}

// Nearest non-escaped slacking/sabotage worker within archetype.radius (inclusive); -1 if none.
export function pickManagerTarget(managerPos, archetype, workers) {
  let best = -1, bestD = archetype.radius * archetype.radius;
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    if (w.escaped) continue;
    if (w.state !== 'slacking' && w.state !== 'sabotage') continue;
    const dx = w.x - managerPos.x, dz = w.z - managerPos.z;
    const d = dx * dx + dz * dz;
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}
