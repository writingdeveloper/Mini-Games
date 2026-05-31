import { timeLabel } from '../logic/dayNight.js';
import { CONFIG } from '../logic/config.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.speed = document.getElementById('speed-val');
    this.disc = document.getElementById('disc-val');
    this.collect = document.getElementById('collect-val');
    this.timeLabelEl = document.getElementById('time-label');
    this.pointer = document.getElementById('pointer-dist');
    document.getElementById('disc-total').textContent = CONFIG.landmarks.count;
    document.getElementById('collect-total').textContent = CONFIG.collectibles.count;
    this._acc = 0;
  }

  update(dt) {
    this._acc += dt;
    if (this._acc < 0.1) return; // ~10 Hz
    this._acc = 0;
    const g = this.game;
    this.speed.textContent = Math.round(Math.abs(g.car.state.speed) * 3.6);
    this.disc.textContent = g.landmarks.discoveredCount;
    this.collect.textContent = g.collectibles.count;
    this.timeLabelEl.textContent = timeLabel(g.sky.t);
    const near = g.landmarks.nearestPointer(g.car.state);
    this.pointer.textContent = near ? `${(near.distance / 100).toFixed(1)}km` : '전부 발견!';
  }
}
