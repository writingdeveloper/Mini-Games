export class Input {
  constructor() {
    this.state = { moveX: 0, moveZ: 0, tactic: 0 };
    this.keys = new Set();
    this._tacticQueue = [];
    this._down = (e) => {
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Digit1', 'Digit2', 'Digit3'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Digit1') this._tacticQueue.push(1);
      if (e.code === 'Digit2') this._tacticQueue.push(2);
      if (e.code === 'Digit3') this._tacticQueue.push(3);
    };
    this._up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
  }

  sample() {
    const has = (c) => this.keys.has(c);
    const s = this.state;
    s.moveX = (has('ArrowRight') || has('KeyD') ? 1 : 0) - (has('ArrowLeft') || has('KeyA') ? 1 : 0);
    s.moveZ = (has('ArrowDown') || has('KeyS') ? 1 : 0) - (has('ArrowUp') || has('KeyW') ? 1 : 0);
    s.tactic = this._tacticQueue.shift() || 0;
    return s;
  }

  clearTactics() {
    this._tacticQueue.length = 0;
    this.state.tactic = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
  }
}
