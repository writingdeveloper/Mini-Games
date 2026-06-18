// Prize content for the 뽑기 claw game. Each PrizeSet = a themed machine (swappable).
// Self-contained (no fry-tower deps). One machine: JELLY CATCHER (procedural candy/jelly).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const OUTLINE = 0x2a1b08;

// Pairs a cannon body with a three group; sync() copies the transform.
export class Prize {
  constructor(body, mesh) { this.body = body; this.mesh = mesh; }
  sync() {
    const p = this.body.position, q = this.body.quaternion;
    this.mesh.position.set(p.x, p.y, p.z);
    this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }
}

let _grad = null;
function stepGrad() {
  if (_grad) return _grad;
  const data = new Uint8Array([70, 125, 180, 235]);
  _grad = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  _grad.needsUpdate = true;
  return _grad;
}

// ===================== candy / jelly (procedural) =====================
const CANDY_COLORS = [0xff5a7a, 0x5ab0ff, 0x6be08a, 0xffd44d, 0xff8ad0, 0xff9a4d, 0xb98cff, 0x4de0d0];
let _candyGeo = null, _candyOutline = null;
function candyAssets() {
  if (_candyGeo) return;
  _candyGeo = new RoundedBoxGeometry(0.74, 0.64, 0.74, 5, 0.26); // chubby rounded gummy
  _candyOutline = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
}
function makeCandyMesh() {
  candyAssets();
  const col = CANDY_COLORS[(Math.random() * CANDY_COLORS.length) | 0];
  const g = new THREE.Group();
  const o = new THREE.Mesh(_candyGeo, _candyOutline); o.scale.multiplyScalar(1.09); g.add(o);
  const fill = new THREE.MeshToonMaterial({ color: col, gradientMap: stepGrad() });
  fill.emissive = new THREE.Color(col); fill.emissiveIntensity = 0.18;   // glossy candy pop
  g.add(new THREE.Mesh(_candyGeo, fill));
  return g;
}

// ===================== PrizeSets (machines) =====================
// half = cannon box half-extents (visual/physics split). spawn = pile count.
// Single machine for now; PRIZE_SETS stays an array so more machines can be added later.
export const PRIZE_SETS = [
  { id: 'candy', name: 'JELLY CATCHER', sub: '젤리·캔디', emoji: '🍬',
    marqueeBg: '#10243a', marqueeFg: '#bff4ff', neon: 0x36e0ff, accent: 0x4ab8ff,
    spawn: 26, makeMesh: makeCandyMesh, half: { x: 0.36, y: 0.31, z: 0.36 } },
];
