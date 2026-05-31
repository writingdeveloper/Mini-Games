export class Input {
  constructor() {
    this.state = { throttle: 0, steer: 0, handbrake: false, cameraToggle: false, reset: false, pause: false };
    this.keys = new Set();
    this._down = (e) => {
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    this._prevC = false;
  }

  sample() {
    const has = (c) => this.keys.has(c);
    const s = this.state;
    s.throttle = (has('ArrowUp') || has('KeyW') ? 1 : 0) - (has('ArrowDown') || has('KeyS') ? 1 : 0);
    s.steer = (has('ArrowRight') || has('KeyD') ? 1 : 0) - (has('ArrowLeft') || has('KeyA') ? 1 : 0);
    s.handbrake = has('Space');
    const c = has('KeyC');
    s.cameraToggle = c && !this._prevC;
    this._prevC = c;
    s.reset = has('KeyR');
    return s;
  }

  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
  }
}
