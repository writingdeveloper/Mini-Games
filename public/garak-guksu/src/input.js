// Input adapter: keeps WASD state, fires onAction for E/click.
// Isolated so a network input source can replace it for co-op later.
export function createInput(onAction) {
  const keys = new Set();
  let touch = { x: 0, z: 0 };
  const MOVE = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
                 ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); onAction(); return; }
    if (MOVE[e.code]) { e.preventDefault(); keys.add(e.code); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  function getMoveDir() {
    let x = 0, z = 0;
    for (const k of keys) { const m = MOVE[k]; if (m) { x += m[0]; z += m[1]; } }
    // Merge touch direction with keyboard input
    if (touch.x || touch.z) { x += touch.x; z += touch.z; }
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }
  // setTouchDir: called from joystick handler in main.js.
  // Screen-x right → world +x (right). Screen-y up (dy<0) → world -z (forward, away from camera).
  // Camera sits at z=-7 looking +z, so screen-up should translate to -z in world space.
  // We pass (dx/len, dy/len) from the joystick; dy is negative when pushing up, so touch.z stays negative → chef moves -z (forward). Sign is correct without inversion.
  function setTouchDir(x, z) { touch = { x, z }; }
  return { getMoveDir, setTouchDir };
}
