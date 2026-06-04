import { CONFIG } from '../logic/config.js';
import { computeScore } from '../logic/scoring.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.time = document.getElementById('time-val');
    this.floor = document.getElementById('floor-val');
    this.progressFill = document.getElementById('progress-fill');
    this.crew = document.getElementById('crew-val');
    this.score = document.getElementById('score-val');
    this.combo = document.getElementById('combo-val');
    this.comboBox = document.getElementById('hud-combo');
    this.funds = document.getElementById('funds-val');
    this.payroll = document.getElementById('payroll-val');
    document.getElementById('floor-total').textContent = CONFIG.targetFloors;
    this._acc = 0;
  }

  update(dt) {
    this._acc += dt;
    if (this._acc < 0.1) return;
    this._acc = 0;
    const g = this.game;
    const remaining = Math.max(0, Math.ceil(CONFIG.shiftSeconds - g.elapsed));
    this.time.textContent = remaining;
    this.floor.textContent = g.build.floorsBuilt;
    this.progressFill.style.width = `${(g.build.progress / CONFIG.production.floorProgress) * 100}%`;
    this.crew.textContent = g.crewRemaining;
    this.score.textContent = computeScore({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      combo: g.combo, incidents: g.incidents,
    });
    if (g.combo >= 2) { this.comboBox.classList.remove('hidden'); this.combo.textContent = g.combo; }
    else this.comboBox.classList.add('hidden');
    if (g.economy) {
      this.funds.textContent = Math.max(0, Math.floor(g.economy.funds));
      this.payroll.textContent = Math.round((g.managers || []).reduce((s, m) => s + m.salary, 0));
    }
  }
}
