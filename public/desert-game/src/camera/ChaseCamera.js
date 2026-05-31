import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera, car, input) {
    this.camera = camera;
    this.car = car;
    this.input = input;
    this.mode = 'chase';
    this._tmp = new THREE.Vector3();
  }

  update(dt) {
    if (this.input.state.cameraToggle) this.mode = this.mode === 'chase' ? 'aerial' : 'chase';
    const s = this.car.state;
    const speedT = Math.min(1, Math.abs(s.speed) / 40);
    let offX, offY, offZ, look = 2;
    if (this.mode === 'chase') {
      const back = 11 + speedT * 4;
      offX = -Math.cos(s.heading) * back;
      offZ = -Math.sin(s.heading) * back;
      offY = 5.5;
      this.camera.fov = 62 + speedT * 8;
    } else {
      offX = 0; offY = 70; offZ = 0.01; look = 0;
      this.camera.fov = 60;
    }
    this.camera.updateProjectionMatrix();
    const tx = s.x + offX, ty = s.y + offY, tz = s.z + offZ;
    const k = 1 - Math.pow(0.0015, dt); // frame-rate-independent smoothing
    this.camera.position.lerp(this._tmp.set(tx, ty, tz), k);
    this.camera.lookAt(s.x, s.y + look, s.z);
  }
}
