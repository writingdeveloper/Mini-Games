import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { toonMaterial, outlineMesh, COLORS } from './materials.js';

// A fry = bold-outlined toon box. Returns a Group whose transform we sync to the physics body.
export function makeFryMesh(fry = CONFIG.fry) {
  const geo = new THREE.BoxGeometry(fry.length, fry.thickness, fry.thickness);
  const group = new THREE.Group();
  group.add(outlineMesh(geo));
  group.add(new THREE.Mesh(geo, toonMaterial(COLORS.fry)));
  return group;
}

export function makeTrayMesh() {
  const geo = new THREE.BoxGeometry(6, 0.4, 6);
  const group = new THREE.Group();
  group.add(outlineMesh(geo, 1.04));
  group.add(new THREE.Mesh(geo, toonMaterial(COLORS.tray)));
  group.position.y = -0.2; // top surface at y = 0, matching the physics tray
  return group;
}
