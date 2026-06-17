// Self-contained prize content for the 뽑기 claw game (V1 = fries).
// Ported from the fry-tower fryMesh variant system so /ppopgi has NO external deps.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const FRY = { length: 1.6, thickness: 0.18, mass: 0.2, variants: 7 };
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

let _variants = null, _fill = null, _outline = null, _grad = null;

function stepGrad() {
  if (_grad) return _grad;
  const data = new Uint8Array([60, 115, 175, 230]);
  _grad = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  _grad.needsUpdate = true;
  return _grad;
}

// Build ONE irregular fry geometry with vertex colours.
function buildVariant(rng) {
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

function assets() {
  if (_variants) return;
  let s = 0x9e3779b1 >>> 0;
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  _variants = [];
  for (let i = 0; i < FRY.variants; i++) _variants.push(buildVariant(rng));
  _fill = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: stepGrad() });
  _outline = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
}

// Returns a Group containing one of the varied fry meshes (random pick).
export function makePrizeMesh() {
  assets();
  const geo = _variants[(Math.random() * _variants.length) | 0];
  const g = new THREE.Group();
  const o = new THREE.Mesh(geo, _outline); o.scale.multiplyScalar(1.07);
  g.add(o);
  g.add(new THREE.Mesh(geo, _fill));
  return g;
}
