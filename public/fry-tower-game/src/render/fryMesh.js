import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../logic/config.js';
import { toonMaterial, COLORS } from './materials.js';

// ---- Photo-based fry variant system ----
// Each variant is an irregular rounded-box geometry: unique length, thickness,
// banana droop, side curve, taper and surface wobble.  Vertex colours give the
// golden body, crispy top edge, pale cut ends and blotchy frying marks.
// Geometries are built once per page-load with a seeded LCG so the variety is
// stable across reloads.  Only lightweight Mesh/Group wrappers are created per fry.

let _fryVariants = null;
let _fryFill = null;
let _fryOutline = null;
let _grad = null;

function stepGrad() {
  if (_grad) return _grad;
  const data = new Uint8Array([60, 115, 175, 230]);
  _grad = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  _grad.needsUpdate = true;
  return _grad;
}

// Build ONE irregular fry geometry with vertex colours.
function buildFryVariant(rng) {
  const L = 1.42 + rng() * 0.46, T = 0.22 + rng() * 0.06, r = Math.min(0.08, T * 0.34), half = L / 2;
  const geo = new RoundedBoxGeometry(L, T, T, 4, r);
  const pos = geo.attributes.position;
  const banana = (rng() - 0.5) * 0.40;            // up/down curve
  const side = (rng() - 0.5) * 0.34;              // sideways curve
  const sAmp = rng() < 0.45 ? (rng() - 0.5) * 0.16 : 0; // occasional S-bend
  const taper = 0.12 + rng() * 0.20;
  const wob = 0.010 + rng() * 0.014;
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
    c.lerp(pale, THREE.MathUtils.smoothstep(Math.abs(t), 0.60, 1.0) * 0.65);  // pale cut ends
    if (v.y > 0) c.lerp(crisp, 0.42 * (v.y / (T / 2)));                        // crispy top
    const blot = 0.5 + 0.5 * Math.sin(v.x * freq + phase) * Math.cos(v.z * 6 + phase);
    c.lerp(crisp, blot * 0.22);                                               // uneven frying
    if (rng() < 0.06) c.lerp(deep, 0.55);                                     // crispy speck
    colors.push(c.r, c.g, c.b);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// Build and cache all variant geometries + shared materials.  Idempotent.
function fryAssets() {
  if (_fryVariants) return;
  let s = 0x9e3779b1 >>> 0;                         // tiny LCG: stable variety per load
  const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  _fryVariants = [];
  for (let i = 0; i < CONFIG.fry.variants; i++) _fryVariants.push(buildFryVariant(rng));
  _fryFill = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: stepGrad() });
  _fryOutline = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });
}

// ---- Tray shared pool ----

let _trayGeo = null;
let _trayFillMat = null;
let _trayOutlineMat = null;

function getTrayShared() {
  if (!_trayGeo) {
    _trayGeo = new THREE.BoxGeometry(6, 0.4, 6);
  }
  if (!_trayFillMat) {
    _trayFillMat = toonMaterial(COLORS.tray);
  }
  if (!_trayOutlineMat) {
    _trayOutlineMat = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });
  }
  return { geo: _trayGeo, fillMat: _trayFillMat, outlineMat: _trayOutlineMat };
}

// ---- Public factories ----

// Returns a Group containing one of 7 varied photo-based fry meshes (random pick).
// Ignores any argument — the variant system needs no external params.
export function makeFryMesh() {
  fryAssets();
  const geo = _fryVariants[(Math.random() * _fryVariants.length) | 0];
  const g = new THREE.Group();
  const o = new THREE.Mesh(geo, _fryOutline); o.scale.multiplyScalar(1.07);
  g.add(o);
  g.add(new THREE.Mesh(geo, _fryFill));
  return g;
}

export function makeTrayMesh() {
  const { geo, fillMat, outlineMat } = getTrayShared();
  const outline = new THREE.Mesh(geo, outlineMat);
  outline.scale.multiplyScalar(1.04);
  const group = new THREE.Group();
  group.add(outline);
  group.add(new THREE.Mesh(geo, fillMat));
  group.position.y = -0.2; // top surface at y = 0, matching the physics tray
  return group;
}
