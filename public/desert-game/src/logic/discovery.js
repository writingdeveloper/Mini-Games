const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export function nearestUndiscovered(pos, items) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < items.length; i++) {
    if (items[i].discovered) continue;
    const d = dist2(pos, items[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best === null ? null : { index: best, distance: Math.sqrt(bestD) };
}

// Indices of items within `radius` that are not yet discovered/collected.
export function withinRadius(pos, items, radius) {
  const r2 = radius * radius, out = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].discovered) continue;
    if (dist2(pos, items[i]) <= r2) out.push(i);
  }
  return out;
}
