import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { spawnProps } from '../logic/spawn.js';

const PROP_GEO = {
  barrel: () => new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8),
  crate: () => new THREE.BoxGeometry(1, 1, 1),
  cone: () => new THREE.ConeGeometry(0.45, 1, 8),
  pipe: () => new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6),
  scaffold: () => new THREE.BoxGeometry(0.3, 3, 0.3),
};
const PROP_COLOR = { barrel: 0x9a6b3a, crate: 0xb59148, cone: 0xff7a2a, pipe: 0x8893a0, scaffold: 0xb0b6bd };

export class Site {
  constructor() {
    this.object3d = new THREE.Group();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.site.width, CONFIG.site.depth),
      new THREE.MeshLambertMaterial({ color: 0x8a8170 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.object3d.add(ground);

    const barMat = new THREE.MeshLambertMaterial({ color: 0xd8a93a });
    const w = CONFIG.site.width, d = CONFIG.site.depth;
    const edges = [
      [0, -d / 2, w, 0.4], [0, d / 2, w, 0.4],
      [-w / 2, 0, 0.4, d], [w / 2, 0, 0.4, d],
    ];
    for (const [x, z, sx, sz] of edges) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, 1, sz), barMat);
      bar.position.set(x, 0.5, z);
      this.object3d.add(bar);
    }

    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.1, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2ec16b })
    );
    gate.position.set(CONFIG.exit.x, 0.06, CONFIG.exit.z);
    this.object3d.add(gate);

    const props = spawnProps(CONFIG.seed, 16);
    const byKind = {};
    for (const p of props) (byKind[p.kind] ||= []).push(p);
    const m4 = new THREE.Matrix4();
    for (const kind of Object.keys(byKind)) {
      const list = byKind[kind];
      const mesh = new THREE.InstancedMesh(
        PROP_GEO[kind](),
        new THREE.MeshLambertMaterial({ color: PROP_COLOR[kind], flatShading: true }),
        list.length
      );
      list.forEach((p, i) => {
        m4.makeTranslation(p.x, 0.6, p.z);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.object3d.add(mesh);
    }
  }
}
