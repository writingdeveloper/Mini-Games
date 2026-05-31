import * as THREE from 'three';
import { createCarState, stepCar } from '../logic/carPhysics.js';

export class Car {
  constructor(terrain, input) {
    this.terrain = terrain;
    this.input = input;
    this.state = createCarState(0, 0);

    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff6b3d, flatShading: true, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4), bodyMat);
    body.position.y = 1; body.castShadow = true;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.8, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x33241a, flatShading: true })
    );
    cabin.position.set(0, 1.7, -0.2); cabin.castShadow = true;
    g.add(body, cabin);

    this.wheels = [];
    const wMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true });
    const wGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10); wGeo.rotateZ(Math.PI / 2);
    for (const [dx, dz] of [[-1.1, 1.3], [1.1, 1.3], [-1.1, -1.3], [1.1, -1.3]]) {
      const w = new THREE.Mesh(wGeo, wMat); w.position.set(dx, 0.6, dz); w.castShadow = true;
      g.add(w); this.wheels.push(w);
    }
    this.object3d = g;
    this.group = g;
  }

  resetTo(x = 0, z = 0) { this.state = createCarState(x, z); }

  update(dt) {
    const inp = this.input.sample();
    if (inp.reset) this.resetTo(this.state.x, this.state.z);
    this.state = stepCar(this.state, inp, dt, (x, z) => this.terrain.getHeightAt(x, z));
    this.terrain.clamp(this.state); // soft boundary

    const s = this.state;
    this.group.position.set(s.x, s.y, s.z);
    this.group.rotation.y = -s.heading + Math.PI / 2;

    // slope tilt: sample neighbours along heading
    const hF = this.terrain.getHeightAt(s.x + Math.cos(s.heading), s.z + Math.sin(s.heading));
    const hB = this.terrain.getHeightAt(s.x - Math.cos(s.heading), s.z - Math.sin(s.heading));
    this.group.rotation.x = Math.atan2(hB - hF, 2) * (s.airborne ? 0.2 : 1);

    // drift body roll
    const drift = s.heading - s.velHeading;
    this.group.rotation.z = THREE.MathUtils.clamp(-drift * 0.4, -0.3, 0.3);

    // wheel spin
    const spin = s.speed * dt * 1.6;
    for (const w of this.wheels) w.rotation.x += spin;
  }
}
