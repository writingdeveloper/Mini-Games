import { CONFIG } from '../logic/config.js';
import { computeScore } from '../logic/scoring.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.time = document.getElementById('time-val');
    this.bld = document.getElementById('bld-val');
    this.bldTotal = document.getElementById('bld-total');
    this.floor = document.getElementById('floor-val');
    this.floorPb = document.getElementById('floor-pb');
    this.progressFill = document.getElementById('progress-fill');
    this.crew = document.getElementById('crew-val');
    this.score = document.getElementById('score-val');
    this.combo = document.getElementById('combo-val');
    this.comboBox = document.getElementById('hud-combo');
    this.funds = document.getElementById('funds-val');
    this.payroll = document.getElementById('payroll-val');
    this.fundsBox = document.getElementById('hud-funds');
    this._acc = 0;
  }

  update(dt) {
    this._acc += dt;
    if (this._acc < 0.1) return;
    this._acc = 0;
    const g = this.game;
    const remaining = Math.max(0, Math.ceil(CONFIG.shiftSeconds - g.elapsed));
    this.time.textContent = remaining;
    const F = CONFIG.production.floorsPerBuilding;
    this.bld.textContent = Math.floor(g.build.floorsBuilt / F);
    this.bldTotal.textContent = CONFIG.targetBuildings;
    this.floor.textContent = g.build.floorsBuilt % F;
    this.floorPb.textContent = F;
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
      const f = g.economy.funds;
      this.fundsBox.classList.toggle('warn', f < 0);
      this.funds.textContent = Math.floor(f);
      this.payroll.textContent = Math.round((g.managers || []).reduce((s, m) => s + m.salary, 0));
    }
  }
}
