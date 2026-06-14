// Reads the session and writes the HUD DOM each frame.
export class HUD {
  constructor(session) {
    this.session = session;
    this.height = document.getElementById('height-val');
    this.time = document.getElementById('time-val');
    this.score = document.getElementById('score-val');
    this.combo = document.getElementById('combo-val');
  }
  update() {
    const s = this.session;
    this.height.textContent = s.height.toFixed(1);
    this.time.textContent = Math.ceil(s.round.timeLeft);
    this.score.textContent = s.score;
    this.combo.textContent = s.combo.count;
  }
}
