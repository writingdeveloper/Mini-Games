import { CONFIG } from '../logic/config.js';
import { computeScore } from '../logic/scoring.js';

export class Menu {
  constructor(game, onRestart) {
    this.game = game;
    this.onRestart = onRestart;
    this.pauseEl = document.getElementById('pause');
    this.resultEl = document.getElementById('result');
    this.resultTitle = document.getElementById('result-title');
    this.resultDetail = document.getElementById('result-detail');
    this.paused = false;

    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause(false));
    document.getElementById('restart-btn').addEventListener('click', () => this._restart());
    document.getElementById('result-restart').addEventListener('click', () => this._restart());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.game.status === 'playing') this.togglePause(!this.paused);
      if (e.code === 'KeyR' && (this.game.status === 'win' || this.game.status === 'defeat')) this._restart();
    });
  }

  _restart() {
    this.pauseEl.classList.add('hidden');
    this.resultEl.classList.add('hidden');
    this.paused = false;
    this.onRestart();
  }

  togglePause(on) {
    this.paused = on;
    this.pauseEl.classList.toggle('hidden', !on);
    if (on) {
      this.game.stop();
      if (this.game.input) this.game.input.clearTactics();
      if (this.game.hireMenu) this.game.hireMenu.setOpen(false);
    } else {
      this.game.start();
    }
  }

  showResult(status) {
    const g = this.game;
    const score = computeScore({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      combo: g.combo, incidents: g.incidents,
    });
    this.resultTitle.textContent = status === 'win' ? '🏆 완공!' : '💥 현장 붕괴';
    this.resultDetail.textContent =
      `${g.build.floorsBuilt}/${CONFIG.targetFloors}층 · 사고 ${g.incidents}회 · 점수 ${score}`;
    this.resultEl.classList.remove('hidden');
    this.game.stop();
  }
}
