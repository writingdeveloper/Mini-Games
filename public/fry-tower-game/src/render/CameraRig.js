import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = CONFIG.camera.startYaw;
    this._targetYaw = this.yaw; // yaw smoothly approaches this (instant for desktop)
    // Tap-step view presets for the mobile 🔄 button (within the yaw clamp).
    this._viewPresets = [
      CONFIG.camera.yawMin + 0.2, // left
      CONFIG.camera.startYaw, // front (default 3/4)
      CONFIG.camera.yawMax - 0.2, // right
    ];
    this._viewIndex = 1; // start on the front preset
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
    this._targetYaw = this.yaw; // continuous desktop orbit: no lerp lag
  }
  // Mobile view button: advance to the next preset angle (smoothly approached in update()).
  orbitStep() {
    this._viewIndex = (this._viewIndex + 1) % this._viewPresets.length;
    this._targetYaw = THREE.MathUtils.clamp(
      this._viewPresets[this._viewIndex],
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
    // Smoothly approach the target yaw (no-op on desktop where yaw === _targetYaw).
    this.yaw += (this._targetYaw - this.yaw) * Math.min(1, 8 * dt);
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
