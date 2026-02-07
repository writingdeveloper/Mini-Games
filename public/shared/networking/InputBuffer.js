/**
 * InputBuffer - Client-side input prediction and reconciliation
 * Stores input history for replaying against server corrections
 */
export class InputBuffer {
  constructor(maxSize = 120) {
    this.buffer = []; // { seq, input, predictedState, timestamp }
    this.maxSize = maxSize;
    this.sequence = 0;
  }

  /**
   * Record a new input and its predicted result
   * @returns {number} The sequence number for this input
   */
  push(input, predictedState) {
    const seq = ++this.sequence;
    this.buffer.push({
      seq,
      input: { ...input },
      predictedState: predictedState ? { ...predictedState } : null,
      timestamp: Date.now(),
    });

    // Trim old entries
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    return seq;
  }

  /**
   * Called when server acknowledges inputs up to a sequence number.
   * Removes acknowledged inputs and returns unacknowledged ones for replay.
   * @param {number} ackSeq - Last acknowledged sequence number
   * @param {object} serverState - The server's authoritative state at ackSeq
   * @returns {{ replayInputs: Array, correctedState: object }}
   */
  reconcile(ackSeq, serverState) {
    // Remove all acknowledged inputs
    const idx = this.buffer.findIndex(entry => entry.seq > ackSeq);

    if (idx === -1) {
      // All inputs have been acknowledged
      this.buffer = [];
      return { replayInputs: [], correctedState: serverState };
    }

    // Keep only unacknowledged inputs
    const replayInputs = this.buffer.slice(idx).map(entry => entry.input);
    this.buffer = this.buffer.slice(idx);

    return {
      replayInputs,
      correctedState: serverState,
    };
  }

  /**
   * Get the current sequence number
   */
  getSequence() {
    return this.sequence;
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = [];
    this.sequence = 0;
  }

  get size() {
    return this.buffer.length;
  }
}
