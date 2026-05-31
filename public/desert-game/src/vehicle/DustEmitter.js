import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

const VERT = `
  attribute float aLife;
  attribute float aSize;
  varying float vLife;
  uniform float uScale;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = `
  precision mediump float;
  uniform vec3 uColor;
  varying float vLife;
  void main() {
    float r = length(gl_PointCoord - vec2(0.5));
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.05, r);
    float a = clamp(vLife, 0.0, 1.0) * soft * 0.34;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class DustEmitter {
  constructor(car, sky) {
    this.car = car;
    this.sky = sky;
    const max = CONFIG.dust.maxParticles;
    this.max = max;
    this.cursor = 0;
    this.positions = new Float32Array(max * 3);
    this.life = new Float32Array(max);     // normalized 0..1 (aLife attribute)
    this.invLife = new Float32Array(max);  // 1 / lifespan seconds
    this.size = new Float32Array(max);     // world-space puff radius (grows)
    this.vy = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xe7c79c) }, uScale: { value: 430 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    });
    this.object3d = new THREE.Points(geo, this.mat);
    this.object3d.frustumCulled = false;
    this.geo = geo;
    this._acc = 0;
    this._sand = new THREE.Color(0xe7c79c);
  }

  spawn(x, y, z) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.positions[i * 3] = x + (Math.random() - 0.5) * 1.4;
    this.positions[i * 3 + 1] = y + 0.4;
    this.positions[i * 3 + 2] = z + (Math.random() - 0.5) * 1.4;
    this.life[i] = 1;
    this.invLife[i] = 1 / (0.9 + Math.random() * 0.6);
    this.size[i] = 1.0 + Math.random() * 0.7;
    this.vy[i] = 1.0 + Math.random() * 1.4;
  }

  update(dt) {
    const s = this.car.state;
    const drift = Math.abs(s.heading - s.velHeading);
    const intensity = Math.abs(s.speed) / 12 + drift * 3;
    if (!s.airborne && intensity > 0.25) {
      this._acc += intensity * dt * 55;
      const rx = s.x - Math.cos(s.heading) * 1.7;
      const rz = s.z - Math.sin(s.heading) * 1.7;
      let budget = 10;
      while (this._acc >= 1 && budget-- > 0) { this.spawn(rx, s.y, rz); this._acc -= 1; }
    }
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt * this.invLife[i];
      this.positions[i * 3 + 1] += this.vy[i] * dt;
      this.size[i] += dt * 1.8;
    }
    if (this.sky && this.sky.scene.fog) {
      this.mat.uniforms.uColor.value.copy(this.sky.scene.fog.color).lerp(this._sand, 0.5);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}
