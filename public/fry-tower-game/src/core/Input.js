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

    // --- Touch / pointer controls on the game canvas ---
    this._initPointer();
    this._initRotateButtons();
  }

  _initPointer() {
    const canvas = document.getElementById('game');
    if (!canvas) return;

    let active = false;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let totalMovement = 0;

    canvas.addEventListener('pointerdown', (e) => {
      active = true;
      startX = e.clientX;
      startY = e.clientY;
      startTime = Date.now();
      totalMovement = 0;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      totalMovement = Math.sqrt(dx * dx + dy * dy);

      // Only steer while dragging (past tiny dead-zone to avoid accidental drift on tap)
      if (totalMovement > 4) {
        if (dx < 0) {
          this.state.left = true;
          this.state.right = false;
        } else {
          this.state.right = true;
          this.state.left = false;
        }
      }
      e.preventDefault();
    }, { passive: false });

    const endDrag = (e) => {
      if (!active) return;
      active = false;
      // Clear directional flags
      this.state.left = false;
      this.state.right = false;

      // Tap-to-drop: small movement + short duration
      const duration = Date.now() - startTime;
      if (totalMovement < 10 && duration < 250) {
        this.dropQueued = true;
      }
      e.preventDefault();
    };

    canvas.addEventListener('pointerup', endDrag, { passive: false });
    canvas.addEventListener('pointercancel', (e) => {
      if (!active) return;
      active = false;
      this.state.left = false;
      this.state.right = false;
    });
  }

  _initRotateButtons() {
    const rotL = document.getElementById('rot-left');
    const rotR = document.getElementById('rot-right');

    if (rotL) {
      rotL.addEventListener('pointerdown', (e) => { this.state.rotL = true; e.preventDefault(); }, { passive: false });
      rotL.addEventListener('pointerup', () => { this.state.rotL = false; });
      rotL.addEventListener('pointerleave', () => { this.state.rotL = false; });
      rotL.addEventListener('pointercancel', () => { this.state.rotL = false; });
    }

    if (rotR) {
      rotR.addEventListener('pointerdown', (e) => { this.state.rotR = true; e.preventDefault(); }, { passive: false });
      rotR.addEventListener('pointerup', () => { this.state.rotR = false; });
      rotR.addEventListener('pointerleave', () => { this.state.rotR = false; });
      rotR.addEventListener('pointercancel', () => { this.state.rotR = false; });
    }
  }

  // Consume a queued drop (true at most once per press).
  takeDrop() { const d = this.dropQueued; this.dropQueued = false; return d; }
}
