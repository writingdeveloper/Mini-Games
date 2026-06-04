import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class Foreman {
  constructor(input) {
    this.input = input;
    this.object3d = new THREE.Group();
    this.speed = 12;

    const mat = new THREE.MeshLambertMaterial({ color: 0xffcc33, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.2, 3, 6), mat);
    body.position.y = 1.2;
    this.object3d.add(body);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xff7a2a, flatShading: true })
    );
    helmet.position.y = 2.0;
    this.object3d.add(helmet);

    this.position = this.object3d.position;
    this.position.set(0, 0, 8);
  }

  setModel(obj) {
    this.object3d.clear();
    obj.position.y = 0;
    this.object3d.add(obj);
  }

  update(dt) {
    const s = this.input.sample();
    const len = Math.hypot(s.moveX, s.moveZ);
    if (len > 0) {
      const nx = s.moveX / len, nz = s.moveZ / len;
      this.position.x += nx * this.speed * dt;
      this.position.z += nz * this.speed * dt;
      const halfW = CONFIG.site.width / 2 - 1, halfD = CONFIG.site.depth / 2 - 1;
      this.position.x = Math.max(-halfW, Math.min(halfW, this.position.x));
      this.position.z = Math.max(-halfD, Math.min(halfD, this.position.z));
      this.object3d.rotation.y = Math.atan2(nx, nz);
    }
  }
}
