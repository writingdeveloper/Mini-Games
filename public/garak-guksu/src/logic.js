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
