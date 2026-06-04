import { CONFIG } from '../logic/config.js';
import { getArchetype } from '../logic/archetypes.js';

export class ConfrontationPrompt {
  constructor() {
    this.el = document.getElementById('confront');
    this.nameEl = document.getElementById('confront-name');
    this.fill = document.getElementById('confront-rage-fill');
    this.current = null;
  }

  nearest(foreman, workers) {
    let best = null, bestD = CONFIG.worker.confrontRadius ** 2;
    for (const w of workers) {
      if (w.logic.escaped) continue;
      const dx = w.position.x - foreman.position.x, dz = w.position.z - foreman.position.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) { bestD = d; best = w; }
    }
    return best;
  }

  update(foreman, workers) {
    const w = this.nearest(foreman, workers);
    this.current = w;
    if (!w) { this.el.classList.add('hidden'); return; }
    this.el.classList.remove('hidden');
    this.nameEl.textContent = getArchetype(w.logic.archetypeId).label;
    this.fill.style.width = `${(w.logic.rage / CONFIG.rage.max) * 100}%`;
  }
}
