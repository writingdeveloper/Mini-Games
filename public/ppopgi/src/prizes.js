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

// ===================== plush bear (procedural) — a cute doll silhouette =====================
const PLUSH_COLORS = [0xffb3c7, 0xc3a3ff, 0x9fd8ff, 0xffd98a, 0xa6ecc4, 0xff9ec9];
let _plushBody = null, _plushEar = null, _plushSnout = null, _softOutline = null;
function plushAssets() {
  if (_plushBody) return;
  _plushBody = new THREE.SphereGeometry(0.34, 16, 14);
  _plushEar = new THREE.SphereGeometry(0.13, 10, 9);
  _plushSnout = new THREE.SphereGeometry(0.12, 10, 9);
  _softOutline = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
}
function makePlushMesh() {
  plushAssets();
  const col = PLUSH_COLORS[(Math.random() * PLUSH_COLORS.length) | 0];
  const g = new THREE.Group();
  const fill = new THREE.MeshToonMaterial({ color: col, gradientMap: stepGrad() });
  fill.emissive = new THREE.Color(col); fill.emissiveIntensity = 0.13;
  const o = new THREE.Mesh(_plushBody, _softOutline); o.scale.multiplyScalar(1.1); g.add(o); // outline shell
  g.add(new THREE.Mesh(_plushBody, fill));
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(_plushEar, fill); ear.position.set(sx * 0.22, 0.27, 0.02); g.add(ear); }
  const snout = new THREE.Mesh(_plushSnout, new THREE.MeshToonMaterial({ color: 0xfff2e4, gradientMap: stepGrad() }));
  snout.position.set(0, -0.05, 0.29); g.add(snout);
  return g;
}

// ===================== gumball / ball (procedural) — a glossy sphere =====================
const BALL_COLORS = [0xff5a5a, 0x4db0ff, 0x5fe07a, 0xffd23d, 0xff8ad0, 0xb98cff, 0x4de0d0, 0xff9a4d];
let _ballGeo = null;
function ballAssets() {
  if (_ballGeo) return;
  _ballGeo = new THREE.SphereGeometry(0.34, 18, 16);
  if (!_softOutline) _softOutline = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
}
function makeBallMesh() {
  ballAssets();
  const col = BALL_COLORS[(Math.random() * BALL_COLORS.length) | 0];
  const g = new THREE.Group();
  const o = new THREE.Mesh(_ballGeo, _softOutline); o.scale.multiplyScalar(1.08); g.add(o);
  const fill = new THREE.MeshToonMaterial({ color: col, gradientMap: stepGrad() });
  fill.emissive = new THREE.Color(col); fill.emissiveIntensity = 0.16;
  g.add(new THREE.Mesh(_ballGeo, fill));
  return g;
}

// ===================== PrizeSets (machines) =====================
// half = cannon box half-extents (visual/physics split). spawn = pile count.
// blob/emoji/sub power the selectable side-machine previews + the payment title.
// Pick a machine in-world by clicking a side cabinet (main.js raycast → loadMachine).
export const PRIZE_SETS = [
  { id: 'candy', name: 'JELLY CATCHER', sub: '젤리·캔디', emoji: '🍬',
    marqueeBg: '#10243a', marqueeFg: '#bff4ff', blob: 0x5ab0ff,
    spawn: 20, makeMesh: makeCandyMesh, half: { x: 0.36, y: 0.31, z: 0.36 } },
  { id: 'plush', name: 'PLUSH PARADISE', sub: '인형·곰돌이', emoji: '🧸',
    marqueeBg: '#3a1a08', marqueeFg: '#ffd9a8', blob: 0xffb3c7,
    spawn: 16, makeMesh: makePlushMesh, half: { x: 0.34, y: 0.4, z: 0.34 } },
  { id: 'ball', name: 'BALL POOL', sub: '볼·공', emoji: '⚽',
    marqueeBg: '#0a323a', marqueeFg: '#bff4ff', blob: 0x5fe07a,
    spawn: 22, makeMesh: makeBallMesh, half: { x: 0.34, y: 0.34, z: 0.34 } },
];
