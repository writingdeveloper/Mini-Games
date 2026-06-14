// Tracks the keys the game cares about. Exposes a snapshot each frame.
export class Input {
  constructor(target = window) {
    this.state = { left: false, right: false, rotL: false, rotR: false };
    this.dropQueued = false;
    this._onKey = (e, down) => {
      switch (e.code) {
        case 'ArrowLeft': this.state.left = down; break;
        case 'ArrowRight': this.state.right = down; break;
        case 'KeyQ': this.state.rotL = down; break;
        case 'KeyE': this.state.rotR = down; break;
        case 'Space': if (down) this.dropQueued = true; e.preventDefault(); break;
        default: return;
      }
    };
    target.addEventListener('keydown', (e) => this._onKey(e, true));
    target.addEventListener('keyup', (e) => this._onKey(e, false));
  }
  // Consume a queued drop (true at most once per press).
  takeDrop() { const d = this.dropQueued; this.dropQueued = false; return d; }
}
