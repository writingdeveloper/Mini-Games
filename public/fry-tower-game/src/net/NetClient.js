// Thin wrapper over the shared GameClient: throttled state reporting + typed subscriptions.
export class NetClient {
  constructor(gameClient) {
    this.client = gameClient;
    this.playerId = gameClient.playerId;
    this._reportTimer = null;
  }

  // Begin sending {height, score, charge} at 10 Hz from a getter the caller supplies.
  startReporting(getState) {
    this.stopReporting();
    this._reportTimer = setInterval(() => {
      const s = getState();
      if (s) this.client.sendInput({ height: s.height, score: s.score, charge: s.charge });
    }, 100);
  }

  stopReporting() {
    if (this._reportTimer) { clearInterval(this._reportTimer); this._reportTimer = null; }
  }

  reportRoundEnd(finalHeight, score) {
    this.client.sendAction('round_end', { finalHeight, score });
  }

  onState(cb) { this.client.on('gameState', cb); }
  onEvent(cb) { this.client.on('gameEvent', cb); }   // round_start / round_result
  onEnd(cb) { this.client.on('gameEnd', cb); }       // match end
}
