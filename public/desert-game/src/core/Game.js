import * as THREE from 'three';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 4000);
    this.camera.position.set(0, 12, 18);
    this.clock = new THREE.Clock();
    this.running = false;
    this.started = false; // becomes true on first start(), stays true through pause
    this.systems = []; // { update(dt, game) } objects

    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  add(system) {
    this.systems.push(system);
    if (system.object3d) this.scene.add(system.object3d);
    return system;
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
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
  dispose() { this.stop(); window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}
