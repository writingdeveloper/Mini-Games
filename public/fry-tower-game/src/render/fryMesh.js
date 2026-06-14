import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { toonMaterial, COLORS } from './materials.js';

// ---- Shared (module-level) geometry and materials ----
// Allocated once; reused by every makeFryMesh() / makeTrayMesh() call so that
// creating fries never allocates new GPU buffers.  Only lightweight Mesh/Group
// wrappers are created per fry.

let _fryGeo = null;
let _fryFillMat = null;
let _fryOutlineMat = null;

function getFryShared(fry = CONFIG.fry) {
  if (!_fryGeo) {
    _fryGeo = new THREE.BoxGeometry(fry.length, fry.thickness, fry.thickness);
  }
  if (!_fryFillMat) {
    _fryFillMat = toonMaterial(COLORS.fry);
  }
  if (!_fryOutlineMat) {
    _fryOutlineMat = new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide });
  }
  return { geo: _fryGeo, fillMat: _fryFillMat, outlineMat: _fryOutlineMat };
}

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

// A fry = bold-outlined toon box. Returns a Group whose transform we sync to the physics body.
// Uses shared geometry + materials — no new GPU allocations per call.
export function makeFryMesh(fry = CONFIG.fry) {
  const { geo, fillMat, outlineMat } = getFryShared(fry);
  const outlineMesh = new THREE.Mesh(geo, outlineMat);
  outlineMesh.scale.multiplyScalar(1.08);
  const group = new THREE.Group();
  group.add(outlineMesh);
  group.add(new THREE.Mesh(geo, fillMat));
  return group;
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
