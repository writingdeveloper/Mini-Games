import * as THREE from 'three';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffe39a);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 6, 12);
    this.camera.lookAt(0, 4, 0);

    this.systems = [];
    this._running = false;
    this._last = 0;
    this._loop = this._loop.bind(this);
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  add(system) { this.systems.push(system); return system; }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  renderOnce() { this.renderer.render(this.scene, this.camera); }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    requestAnimationFrame(this._loop);
  }

  stop() { this._running = false; }

  _loop(t) {
    if (!this._running) return;
    const dt = Math.min(0.05, (t - this._last) / 1000);
    this._last = t;
    for (const s of this.systems) if (s.update) s.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}
