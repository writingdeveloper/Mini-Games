import * as THREE from 'three';
import { sunDirection, skyPalette, isNight } from '../logic/dayNight.js';
import { CONFIG } from '../logic/config.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.t = 0.18; // start in golden morning
    scene.fog = new THREE.Fog(0xd9a86a, 250, 900);
    this.bg = new THREE.Color();

    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.far = 1500;
    this.sun.shadow.camera.left = -300;
    this.sun.shadow.camera.right = 300;
    this.sun.shadow.camera.top = 300;
    this.sun.shadow.camera.bottom = -300;
    scene.add(this.sun, this.sun.target);

    this.ambient = new THREE.HemisphereLight(0xffe6c0, 0x4a3520, 0.6);
    scene.add(this.ambient);

    // stars (shown at night via opacity)
    const sg = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 600; i++) {
      pts.push((Math.random() - 0.5) * 3000, Math.random() * 800 + 200, (Math.random() - 0.5) * 3000);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0 }));
    scene.add(this.stars);
  }

  update(dt) {
    this.t = (this.t + dt / CONFIG.dayLengthSeconds) % 1;
    const d = sunDirection(this.t);
    this.sun.position.set(d.x * 400, d.y * 400, d.z * 400);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = Math.max(0.05, d.y) * 2.4;

    const p = skyPalette(this.t);
    this.bg.setRGB(p.top.r, p.top.g, p.top.b);
    this.scene.background = this.bg;
    this.scene.fog.color.setRGB(p.fog.r, p.fog.g, p.fog.b);
    this.ambient.intensity = 0.25 + Math.max(0, d.y) * 0.6;
    this.stars.material.opacity = isNight(this.t) ? 0.9 : 0;
  }
}
