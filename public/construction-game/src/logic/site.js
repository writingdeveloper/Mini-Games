// Shared site geometry + crowd-movement helpers — the SINGLE source of truth used by BOTH the
// renderer (Buildings.js positions floor meshes) and the gather logic (workers/managers target the
// active building), so render and simulation can never drift. All pure + deterministic (no THREE),
// so it's unit-tested and keeps Playwright crew-layout snapshots stable.

export const FOOTPRINT = 10;        // building floor-plan size (matches Building.js geometry)
export const SPACING = 12;          // gap between building centers (matches Buildings.js layout)
export const BUILDING_ROW_Z = -6;   // world z of the building row (Buildings group position)

// On-station output coupling: a productive worker still walking to its slot contributes less
// ("carrying / walking on site"), so migrating to the next building causes a brief, visible travel
// dip — then output ramps back as the crew arrives. enRouteFactor is a slow-down, not a full stop.
export const STATION = { arriveEps: 0.8, enRouteFactor: 0.35 };

export function activeBuildingIndex(floorsBuilt, floorsPerBuilding) {
  return Math.floor(floorsBuilt / floorsPerBuilding);
}

// World center {x,z} of building `index` (mirrors Buildings.js: local x = (i-(n-1)/2)*spacing,
// the group parented at z = groupZ).
export function buildingCenter(index, targetBuildings, spacing = SPACING, groupZ = BUILDING_ROW_Z) {
  return { x: (index - (targetBuildings - 1) / 2) * spacing, z: groupZ };
}

// `count` stable work-slot positions hugging the +Z (camera-facing) face of a building at `center`,
// staggered into two rows so the crew packs the face without all fighting for a single line. Pure
// function of (center, count) → deterministic.
export function workSlots(center, count, footprint = FOOTPRINT, ring = 1.2) {
  const out = [];
  const half = footprint / 2;
  const frontZ = center.z + half + ring;
  const span = footprint * 0.8;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    out.push({ x: center.x - span / 2 + t * span, z: frontZ + (i % 2) * 0.9 });
  }
  return out;
}

// World centers {x,z} of every building plot (not just the active one) — used to keep characters from
// standing inside any building footprint.
export function allBuildingCenters(targetBuildings) {
  const out = [];
  for (let i = 0; i < targetBuildings; i++) out.push(buildingCenter(i, targetBuildings));
  return out;
}

// Hard constraint: if `pos` sits inside any building footprint (half-extent + margin), shove it out to
// the nearest footprint edge so workers/managers never clip INTO a building (they gather just outside
// the near face, so this only catches walk-through paths and stray wander). Mutates + returns pos.
export function pushOutOfFootprints(pos, centers, half, margin = 0.6) {
  const r = half + margin;
  for (const c of centers) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    if (Math.abs(dx) < r && Math.abs(dz) < r) {
      // push along the axis of least penetration (slide around the building, not through it)
      if (r - Math.abs(dx) < r - Math.abs(dz)) pos.x = c.x + (dx < 0 ? -r : r);
      else pos.z = c.z + (dz < 0 ? -r : r);
    }
  }
  return pos;
}

// Repulsion from nearby peers within rsep — keeps bodies from stacking. Returns a {x,z} push vector
// (zero if clear). A coincident point (distSq≈0) contributes nothing, so passing the full entity list
// (including self) is safe. Shared by workers (SCV packing) and managers (flanking a target).
export function separation(selfPos, others, rsep) {
  let px = 0, pz = 0;
  const r2 = rsep * rsep;
  for (const o of others) {
    const dx = selfPos.x - o.x, dz = selfPos.z - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 1e-6 && d2 < r2) {
      const d = Math.sqrt(d2);
      const w = 1 - d / rsep; // stronger the closer they are
      px += (dx / d) * w;
      pz += (dz / d) * w;
    }
  }
  return { x: px, z: pz };
}
