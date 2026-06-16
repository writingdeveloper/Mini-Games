import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = CONFIG.camera.startYaw;
    this.target = new THREE.Vector3(0, CONFIG.camera.targetY, 0);
    this._riseY = 0;
    this._targetRise = 0;
    this._shake = 0;
  }
  orbit(delta) {
    this.yaw = THREE.MathUtils.clamp(
      this.yaw + delta,
      CONFIG.camera.yawMin,
      CONFIG.camera.yawMax
    );
  }
  followHeight(h) {
    this._targetRise = Math.min(h * 0.9, 18);
  }
  shake(a) {
    this._shake = Math.max(this._shake, a);
  }
  get azimuth() {
    return this.yaw;
  }
  update(dt) {
    this._riseY += (this._targetRise - this._riseY) * Math.min(1, 3 * dt);
    const R = CONFIG.camera.radius,
      H = CONFIG.camera.height;
    const ty = this.target.y + this._riseY;
    let px = Math.sin(this.yaw) * R,
      pz = Math.cos(this.yaw) * R,
      py = H + this._riseY;
    if (this._shake > 0.001) {
      px += (Math.random() - 0.5) * this._shake;
      py += (Math.random() - 0.5) * this._shake;
      this._shake *= Math.pow(0.001, dt);
    }
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(this.target.x, ty, this.target.z);
  }
}
