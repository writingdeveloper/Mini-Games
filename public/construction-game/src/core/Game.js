import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fb0bf);
    this.scene.fog = new THREE.Fog(0x9fb0bf, 48, 130);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 2000);
    this.camera.position.set(0, 24, 26);
    this.camera.lookAt(0, 4, 0);

    this.clock = new THREE.Clock();
    this.running = false;
    this.started = false;
    this.systems = [];
    this.pipeline = null;

    this.status = 'menu';
    this.elapsed = 0;
    this.build = { progress: 0, floorsBuilt: 0 };
    this.combo = 0;
    this.incidents = 0;
    this.crewRemaining = CONFIG.workerCount;
    this.step = null;

    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.pipeline) this.pipeline.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  add(system) {
    this.systems.push(system);
    if (system.object3d) this.scene.add(system.object3d);
    return system;
  }

  render() {
    if (this.pipeline) this.pipeline.render(this.renderer, this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  start() {
    this.started = true;
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      const dt = Math.min(0.05, this.clock.getDelta());
      for (const s of this.systems) s.update && s.update(dt, this);
      if (this.step) this.step(dt, this);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
  dispose() { this.stop(); window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}
