// Tracks the keys and pointer gestures the game cares about.
// Exposes a held-flags `state` object plus one-shot `take*` actions.
export class Input {
  constructor(target = window) {
    this.state = {
      left: false, right: false,         // X move      (ArrowLeft / ArrowRight ; pointer drag X)
      fwd: false, back: false,           // Z depth move (ArrowUp / ArrowDown ; pointer drag Y)
      yawL: false, yawR: false,          // yaw spin     (KeyQ / KeyE ; touch #rot-left/#rot-right)
      tiltUp: false, tiltDown: false,    // tilt pitch   (KeyZ / KeyX)  [advanced]
      up: false, down: false,            // height nudge (KeyW / KeyS)   [advanced]
      orbitL: false, orbitR: false,      // camera orbit (BracketLeft '[' / BracketRight ']')
    };

    // One-shot queues — read and cleared by take*() methods.
    this._dropQueued = false;
    this._assistQueued = false;
    this._resetQueued = false;

    this._onKey = (e, down) => {
      switch (e.code) {
        case 'ArrowLeft':    this.state.left      = down; break;
        case 'ArrowRight':   this.state.right     = down; break;
        case 'ArrowUp':      this.state.fwd       = down; break;
        case 'ArrowDown':    this.state.back      = down; break;
        case 'KeyQ':         this.state.yawL      = down; break;
        case 'KeyE':         this.state.yawR      = down; break;
        case 'KeyZ':         this.state.tiltUp    = down; break;
        case 'KeyX':         this.state.tiltDown  = down; break;
        case 'KeyW':         this.state.up        = down; break;
        case 'KeyS':         this.state.down      = down; break;
        case 'BracketLeft':  this.state.orbitL    = down; break;
        case 'BracketRight': this.state.orbitR    = down; break;
        case 'Space':
          if (down) this._dropQueued = true;
          e.preventDefault();
          break;
        case 'KeyA':
          if (down) this._assistQueued = true;
          break;
        case 'KeyR':
          if (down) this._resetQueued = true;
          break;
        default: return;
      }
    };

    target.addEventListener('keydown', (e) => this._onKey(e, true));
    target.addEventListener('keyup',   (e) => this._onKey(e, false));

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

      // Only steer while dragging (past tiny dead-zone to avoid accidental drift on tap).
      if (totalMovement > 4) {
        // Horizontal: left / right
        if (dx < 0) {
          this.state.left  = true;
          this.state.right = false;
        } else {
          this.state.right = true;
          this.state.left  = false;
        }
        // Vertical: drag up (dy < 0) → fwd (push away); drag down (dy > 0) → back.
        if (dy < 0) {
          this.state.fwd  = true;
          this.state.back = false;
        } else {
          this.state.back = true;
          this.state.fwd  = false;
        }
      }
      e.preventDefault();
    }, { passive: false });

    const endDrag = (e) => {
      if (!active) return;
      active = false;

      // Clear all directional flags set by the drag.
      this.state.left  = false;
      this.state.right = false;
      this.state.fwd   = false;
      this.state.back  = false;

      // Tap-to-drop: small movement + short duration.
      const duration = Date.now() - startTime;
      if (totalMovement < 10 && duration < 250) {
        this._dropQueued = true;
      }
      e.preventDefault();
    };

    canvas.addEventListener('pointerup',     endDrag, { passive: false });
    canvas.addEventListener('pointercancel', (e) => {
      if (!active) return;
      active = false;
      this.state.left  = false;
      this.state.right = false;
      this.state.fwd   = false;
      this.state.back  = false;
    });
  }

  _initRotateButtons() {
    // #rot-left / #rot-right drive YAW (repurposed from the old rotL/rotR scheme).
    const rotL = document.getElementById('rot-left');
    const rotR = document.getElementById('rot-right');

    if (rotL) {
      rotL.addEventListener('pointerdown',  (e) => { this.state.yawL = true;  e.preventDefault(); }, { passive: false });
      rotL.addEventListener('pointerup',    ()  => { this.state.yawL = false; });
      rotL.addEventListener('pointerleave', ()  => { this.state.yawL = false; });
      rotL.addEventListener('pointercancel',()  => { this.state.yawL = false; });
    }

    if (rotR) {
      rotR.addEventListener('pointerdown',  (e) => { this.state.yawR = true;  e.preventDefault(); }, { passive: false });
      rotR.addEventListener('pointerup',    ()  => { this.state.yawR = false; });
      rotR.addEventListener('pointerleave', ()  => { this.state.yawR = false; });
      rotR.addEventListener('pointercancel',()  => { this.state.yawR = false; });
    }
  }

  // Consume a queued drop (Space key OR canvas tap). Returns true at most once per trigger.
  takeDrop() { const d = this._dropQueued; this._dropQueued = false; return d; }

  // Consume a queued assist-toggle (KeyA). Returns true at most once per trigger.
  takeAssistToggle() { const d = this._assistQueued; this._assistQueued = false; return d; }

  // Consume a queued reset (KeyR). Returns true at most once per trigger.
  takeReset() { const d = this._resetQueued; this._resetQueued = false; return d; }
}
