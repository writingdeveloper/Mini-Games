import * as THREE from 'three';
import { makeValueNoise } from '../logic/noise.js';
import { withinRadius } from '../logic/discovery.js';
import { CONFIG } from '../logic/config.js';

export class Collectibles {
  constructor(terrain, onCollect) {
    this.terrain = terrain;
    this.onCollect = onCollect;
    this.object3d = new THREE.Group();
    this.items = [];
    const rng = makeValueNoise(CONFIG.seed + 11);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x1577aa, flatShading: true, roughness: 0.3 });
    const geo = new THREE.OctahedronGeometry(1.4);
    for (let i = 0; i < CONFIG.collectibles.count; i++) {
      const x = rng(i, 1) * (terrain.half - 60);
      const z = rng(i, 2) * (terrain.half - 60);
      const baseY = terrain.getHeightAt(x, z) + 2.2;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, baseY, z);
      this.object3d.add(m);
      this.items.push({ x, z, discovered: false, mesh: m, baseY, phase: rng(i, 3) * 6 });
    }
    this.t = 0;
  }

  get count() { return this.items.filter((i) => i.discovered).length; }

  update(dt, game) {
    this.t += dt;
    for (const it of this.items) {
      if (it.discovered) continue;
      it.mesh.rotation.y += dt * 1.5;
      it.mesh.position.y = it.baseY + Math.sin(this.t + it.phase) * 0.4;
    }
    for (const idx of withinRadius(game.car.state, this.items, CONFIG.collectibles.pickupRadius)) {
      const it = this.items[idx];
      it.discovered = true;
      it.mesh.visible = false;
      this.onCollect && this.onCollect(this.count);
    }
  }
}
