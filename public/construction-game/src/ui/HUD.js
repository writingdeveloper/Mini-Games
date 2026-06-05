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
    this.fundsWarn = document.getElementById('funds-warn');
    this.statusChips = document.getElementById('status-chips');
    this._acc = 0;
    // cached display state so we only touch the DOM when the rendered value changes
    this._chipText = null;
    this._fillState = null;
  }

  // progress-fill gradients per event state (penalty takes visual priority over boost)
  static FILL = {
    penalty: 'linear-gradient(90deg,#ff6b5a,#ff3a2e)',
    boost: 'linear-gradient(90deg,#7ec96f,#4caf50)',
    normal: 'linear-gradient(90deg,#ffd24a,#ff9d2e)',
  };

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
      const insolvent = f < 0;
      this.fundsBox.classList.toggle('warn', insolvent); // red color (kept)
      if (this.fundsWarn) this.fundsWarn.classList.toggle('hidden', !insolvent); // redundant text cue
      this.funds.textContent = Math.floor(f);
      this.payroll.textContent = Math.round((g.managers || []).reduce((s, m) => s + m.salary, 0));
    }
    this._updateEventStatus(g._eventState);
  }

  // Persistent indicator for active site-event effects (read-only consumer of _eventState).
  // Renders draining-countdown chips and tints the progress bar; both write the DOM only
  // when their displayed value changes (no per-tick churn). Pre-game (_eventState undefined):
  // no chips, default fill.
  _updateEventStatus(es) {
    let chips = '';
    let fill = 'normal';
    if (es) {
      if (es.prodMult < 1) {
        chips += `<span class="status-chip penalty">🔧 ${Math.round((es.prodMult - 1) * 100)}% ${Math.ceil(es.prodTimer)}s</span>`;
        fill = 'penalty';
      }
      if (es.boostMult > 1) {
        chips += `<span class="status-chip boost">⚡ +${Math.round((es.boostMult - 1) * 100)}% ${Math.ceil(es.boostTimer)}s</span>`;
        if (fill === 'normal') fill = 'boost'; // penalty keeps visual priority
      }
    }
    if (chips !== this._chipText) { this.statusChips.innerHTML = chips; this._chipText = chips; }
    if (fill !== this._fillState) { this.progressFill.style.background = HUD.FILL[fill]; this._fillState = fill; }
  }
}
