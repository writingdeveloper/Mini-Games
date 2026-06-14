import * as THREE from 'three';

export const COLORS = { fry: 0xf7b330, tray: 0xe23434, bg: 0xffe39a, outline: 0x2a1b08 };

// Stepped gradient → cartoon toon shading.
let _grad = null;
function gradientMap() {
  if (_grad) return _grad;
  const data = new Uint8Array([80, 150, 220, 255]);
  _grad = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  _grad.needsUpdate = true;
  return _grad;
}

export function toonMaterial(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
}

// Inverted-hull outline: a slightly larger back-faced black shell.
export function outlineMesh(geometry, scale = 1.08) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: COLORS.outline, side: THREE.BackSide }));
  mesh.scale.multiplyScalar(scale);
  return mesh;
}
