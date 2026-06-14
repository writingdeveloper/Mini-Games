import * as THREE from 'three';
import { makeTrayMesh } from './fryMesh.js';
import { COLORS } from './materials.js';

// Lights + tray + a simple fast-food backdrop. A "system" with no update.
export class Stage {
  constructor(scene) {
    scene.background = new THREE.Color(COLORS.bg);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb98a4a, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.25);
    dir.position.set(5, 14, 8);
    scene.add(dir);

    scene.add(makeTrayMesh());

    // Backdrop counter plane.
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 24),
      new THREE.MeshToonMaterial({ color: 0xffcf6b })
    );
    back.position.set(0, 8, -8);
    scene.add(back);
  }
  update() {}
}
