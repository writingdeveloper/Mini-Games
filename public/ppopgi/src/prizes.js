// Prize content for the 뽑기 claw game. Each PrizeSet = a themed machine (swappable).
// Self-contained (no fry-tower deps). V1 = fries, V2 = candy/jelly (procedural).
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

// ===================== V1 — fries =====================
const FRY_VARIANTS = 7;
let _fryVariants = null, _fryFill = null, _fryOutline = null;

function buildFryVariant(rng) {
  const L = 1.42 + rng() * 0.46, T = 0.22 + rng() * 0.06, r = Math.min(0.08, T * 0.34), half = L / 2;
  const geo = new RoundedBoxGeometry(L, T, T, 4, r);
  const pos = geo.attributes.position;
  const banana = (rng() - 0.5) * 0.40, side = (rng() - 0.5) * 0.34;
  const sAmp = rng() < 0.45 ? (rng() - 0.5) * 0.16 : 0;
  const taper = 0.12 + rng() * 0.20, wob = 0.010 + rng() * 0.014;
  const tone = new THREE.Color().lerpColors(new THREE.Color(0xdf9a22), new THREE.Color(0xb06c0d), rng());
  const pale = new THREE.Color(0xddb46a), crisp = new THREE.Color(0x8a4c08), deep = new THREE.Color(0x5d3304);
  const freq = 3.5 + rng() * 4, phase = rng() * 6.28;
  const v = new THREE.Vector3(), c = new THREE.Color();
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp(v.x / half, -1, 1);
    const tp = 1 - taper * t * t;
    let y = v.y * tp, z = v.z * tp;
    y += banana * (t * t - 0.33);
    z += side * (t * t) + sAmp * Math.sin(t * Math.PI);
    y += (rng() - 0.5) * wob; z += (rng() - 0.5) * wob;
    pos.setXYZ(i, v.x, y, z);
    c.copy(tone);
    c.lerp(pale, THREE.MathUtils.smoothstep(Math.abs(t), 0.60, 1.0) * 0.65);
    if (v.y > 0) c.lerp(crisp, 0.42 * (v.y / (T / 2)));
    const blot = 0.5 + 0.5 * Math.sin(v.x * freq + phase) * Math.cos(v.z * 6 + phase);
    c.lerp(crisp, blot * 0.22);
    if (rng() < 0.06) c.lerp(deep, 0.55);
    colors.push(c.r, c.g, c.b);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}
function fryAssets() {
  if (_fryVariants) return;
  let s = 0x9e3779b1 >>> 0;
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  _fryVariants = [];
  for (let i = 0; i < FRY_VARIANTS; i++) _fryVariants.push(buildFryVariant(rng));
  _fryFill = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: stepGrad() });
  _fryOutline = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
}
function makeFryMesh() {
  fryAssets();
  const geo = _fryVariants[(Math.random() * _fryVariants.length) | 0];
  const g = new THREE.Group();
  const o = new THREE.Mesh(geo, _fryOutline); o.scale.multiplyScalar(1.07); g.add(o);
  g.add(new THREE.Mesh(geo, _fryFill));
  return g;
}

// ===================== V2 — candy / jelly (procedural) =====================
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
export const PRIZE_SETS = [
  { id: 'fry', name: 'POTATO CATCHER', sub: '감자튀김', emoji: '🍟',
    marqueeBg: '#2a0a3a', marqueeFg: '#ffe14a', neon: 0xff2d8f, accent: 0xff3d7f,
    spawn: 22, makeMesh: makeFryMesh, half: { x: 0.8, y: 0.09, z: 0.09 } },
  { id: 'candy', name: 'JELLY CATCHER', sub: '젤리·캔디', emoji: '🍬',
    marqueeBg: '#10243a', marqueeFg: '#bff4ff', neon: 0x36e0ff, accent: 0x4ab8ff,
    spawn: 26, makeMesh: makeCandyMesh, half: { x: 0.36, y: 0.31, z: 0.36 } },
];
