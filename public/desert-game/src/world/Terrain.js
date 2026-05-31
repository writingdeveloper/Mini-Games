import * as THREE from 'three';
import { terrainHeight } from '../logic/noise.js';
import { CONFIG } from '../logic/config.js';

export class Terrain {
  constructor() {
    const { size, segments } = CONFIG.map;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2); // XZ ground plane
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z, CONFIG.seed));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: CONFIG.palette.sand, flatShading: true, roughness: 1, metalness: 0,
    });
    this.object3d = new THREE.Mesh(geo, mat);
    this.object3d.receiveShadow = true;
    this.material = mat;
    this.half = size / 2;
  }

  getHeightAt(x, z) { return terrainHeight(x, z, CONFIG.seed); }

  // soft boundary: clamp a position back inside the map
  clamp(p) {
    const m = this.half - 20;
    p.x = Math.max(-m, Math.min(m, p.x));
    p.z = Math.max(-m, Math.min(m, p.z));
  }

  update() {}
}
