/**
 * StateBuffer - Interpolation buffer for smooth remote player rendering
 * Holds states with timestamps and interpolates between them with a configurable delay
 */
export class StateBuffer {
  /**
   * @param {number} delayMs - Interpolation delay in milliseconds (default 100ms)
   */
  constructor(delayMs = 100) {
    this.delayMs = delayMs;
    this.buffer = []; // { state, timestamp }
    this.maxBufferSize = 30;
  }

  /**
   * Add a new state snapshot from the server
   */
  push(state, serverTimestamp) {
    this.buffer.push({
      state: { ...state },
      timestamp: serverTimestamp || Date.now(),
    });

    // Keep buffer size reasonable
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get the interpolated state at the current render time
   * Returns null if not enough data for interpolation
   */
  getInterpolatedState(now) {
    const renderTime = (now || Date.now()) - this.delayMs;

    // Need at least 2 states to interpolate
    if (this.buffer.length < 2) {
      return this.buffer.length === 1 ? { ...this.buffer[0].state } : null;
    }

    // Find the two states surrounding renderTime
    let before = null;
    let after = null;

    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime && this.buffer[i + 1].timestamp >= renderTime) {
        before = this.buffer[i];
        after = this.buffer[i + 1];
        break;
      }
    }

    // If render time is past all buffered states, use the latest
    if (!before && !after) {
      const latest = this.buffer[this.buffer.length - 1];
      if (latest.timestamp <= renderTime) {
        return { ...latest.state };
      }
      return null;
    }

    // Interpolate
    const range = after.timestamp - before.timestamp;
    const t = range > 0 ? (renderTime - before.timestamp) / range : 0;

    return this._interpolate(before.state, after.state, Math.max(0, Math.min(1, t)));
  }

  /**
   * Linear interpolation between two state objects
   * Interpolates all numeric values, takes latest for non-numeric
   */
  _interpolate(stateA, stateB, t) {
    const result = {};

    for (const key of Object.keys(stateB)) {
      const a = stateA[key];
      const b = stateB[key];

      if (typeof b === 'number' && typeof a === 'number') {
        // Special handling for angles (heading) - use shortest path
        if (key === 'heading' || key === 'rotation' || key === 'yaw') {
          result[key] = this._lerpAngle(a, b, t);
        } else {
          result[key] = a + (b - a) * t;
        }
      } else if (typeof b === 'object' && b !== null && typeof a === 'object' && a !== null) {
        // Recursively interpolate nested objects (position, rotation, etc.)
        result[key] = this._interpolate(a, b, t);
      } else {
        // Non-numeric values: take the latest
        result[key] = b;
      }
    }

    return result;
  }

  /**
   * Interpolate angles along the shortest path
   */
  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a + diff * t;
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = [];
  }

  get size() {
    return this.buffer.length;
  }
}
