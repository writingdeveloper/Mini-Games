// Pure, dependency-free simulation for /garak-guksu (unit-testable; no DOM/three).
// Plan 1 = vertical slice: one cook station, one customer, single-step "make a bowl".

// The chef walks this floor plane (x = left/right, z = depth toward counter).
export const KITCHEN = { minX: -4, maxX: 4, minZ: -2.5, maxZ: 2.5 };

// Fixed Plan-1 positions.
export const COOK_STATION = { x: 2, z: -1.5 };       // back-right of the kitchen
export const CUSTOMER_SLOT = { x: 0, z: 3.2 };       // across the counter (beyond the kitchen)
export const REACH = 1.2;                            // how close counts as "at" a thing

export function createGame() {
  return {
    player: { x: 0, z: 0, holding: null }, // holding: null | 'bowl'
    customer: { present: true, served: false },
    score: 0,
  };
}

export const PLAYER_SPEED = 4.5; // units/second

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// dir = {x, z} (roughly unit length), dt = seconds. Mutates + returns state.
export function movePlayer(state, dir, dt) {
  const s = PLAYER_SPEED * dt;
  state.player.x = clamp(state.player.x + dir.x * s, KITCHEN.minX, KITCHEN.maxX);
  state.player.z = clamp(state.player.z + dir.z * s, KITCHEN.minZ, KITCHEN.maxZ);
  return state;
}

export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function near(ax, az, bx, bz, r = REACH) { return dist2(ax, az, bx, bz) <= r * r; }

// At the cook station with empty hands -> a finished bowl appears in hand.
// (Plan 2 replaces this single step with the 4-stage pipeline.)
export function interact(state) {
  const p = state.player;
  if (p.holding === null && near(p.x, p.z, COOK_STATION.x, COOK_STATION.z)) {
    p.holding = 'bowl';
    return true;
  }
  return false;
}

export const SERVE_POINTS = 100;

// At the customer, holding a bowl -> serve: clear hands, score, customer leaves.
export function serve(state) {
  const p = state.player, c = state.customer;
  if (p.holding === 'bowl' && c.present && !c.served &&
      near(p.x, p.z, CUSTOMER_SLOT.x, CUSTOMER_SLOT.z)) {
    p.holding = null;
    c.served = true;
    c.present = false;
    state.score += SERVE_POINTS;
    return true;
  }
  return false;
}
