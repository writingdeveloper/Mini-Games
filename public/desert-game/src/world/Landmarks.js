import * as THREE from 'three';
import { makeValueNoise } from '../logic/noise.js';
import { withinRadius, nearestUndiscovered } from '../logic/discovery.js';
import { CONFIG } from '../logic/config.js';

export class Landmarks {
  constructor(terrain, onDiscover) {
    this.terrain = terrain;
    this.onDiscover = onDiscover;
    this.object3d = new THREE.Group();
    this.items = [];
    const rng = makeValueNoise(CONFIG.seed + 5);
    const n = CONFIG.landmarks.count;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng(i, 0);
      const r = 150 + Math.abs(rng(i, 7)) * (terrain.half - 230); // keep inside the map
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = terrain.getHeightAt(x, z);
      const mesh = this._makeMonument(i);
      mesh.position.set(x, y, z);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 120, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffe28c, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.set(x, y + 60, z);
      this.object3d.add(mesh, beam);
      this.items.push({ x, z, discovered: false, mesh, beam });
    }
  }

  _makeMonument(i) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xcaa15a, flatShading: true, roughness: 0.9, emissive: 0x000000 });
    const shapes = [
      () => new THREE.ConeGeometry(8, 34, 4),
      () => new THREE.TorusGeometry(10, 2.4, 6, 12),
      () => new THREE.BoxGeometry(6, 30, 6),
      () => new THREE.DodecahedronGeometry(9),
    ];
    const m = new THREE.Mesh(shapes[i % shapes.length](), mat);
    m.position.y = 14;
    m.castShadow = true;
    const grp = new THREE.Group();
    grp.add(m);
    grp.userData.mat = mat;
    return grp;
  }

  get discoveredCount() { return this.items.filter((i) => i.discovered).length; }
  nearestPointer(pos) { return nearestUndiscovered(pos, this.items); }

  update(_dt, game) {
    const pos = game.car.state;
    for (const idx of withinRadius(pos, this.items, CONFIG.landmarks.discoverRadius)) {
      const it = this.items[idx];
      it.discovered = true;
      it.beam.visible = false;
      it.mesh.userData.mat.emissive.setHex(0x5a3a10);
      this.onDiscover && this.onDiscover(it, this.discoveredCount);
    }
  }
}
