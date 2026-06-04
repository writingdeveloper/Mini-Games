import { MANAGER_LIST } from '../logic/managers.js';
import { CONFIG } from '../logic/config.js';
import { canAfford } from '../logic/economy.js';

export class HireMenu {
  constructor(game, onHire) {
    this.game = game;
    this.onHire = onHire;
    this.toggle = document.getElementById('hire-toggle');
    this.panel = document.getElementById('hire-panel');
    this.fundsEl = document.getElementById('hire-funds');
    this.listEl = document.getElementById('hire-list');
    this.open = false;

    this._renderList();
    this.toggle.addEventListener('click', () => { if (!this.game.running) return; this.setOpen(!this.open); });
    document.getElementById('hire-close').addEventListener('click', () => this.setOpen(false));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && this.game.running) this.setOpen(!this.open);
    });
  }

  _renderList() {
    this.listEl.innerHTML = '';
    for (const a of MANAGER_LIST) {
      const card = document.createElement('div');
      card.className = 'hire-card';
      card.innerHTML =
        `<h4>${a.icon} ${a.label}</h4>` +
        `<p>${describe(a)}<br>고용비 💰${a.hireCost} · 월급 ${a.salary}/s</p>` +
        `<button data-id="${a.id}">고용</button>`;
      card.querySelector('button').addEventListener('click', () => this.onHire(a.id));
      this.listEl.appendChild(card);
    }
  }

  setOpen(on) {
    this.open = on;
    this.panel.classList.toggle('hidden', !on);
    if (on) this.refresh();
  }

  refresh() {
    const econ = this.game.economy;
    const cap = (this.game.managers || []).length >= CONFIG.economy.managerCap;
    this.fundsEl.textContent = econ ? Math.max(0, Math.floor(econ.funds)) : 0;
    this.listEl.querySelectorAll('button[data-id]').forEach((btn) => {
      const a = MANAGER_LIST.find((m) => m.id === btn.getAttribute('data-id'));
      btn.disabled = cap || !econ || !canAfford(econ, a.hireCost);
    });
  }

  show() { this.toggle.classList.remove('hidden'); }
  hide() { this.toggle.classList.add('hidden'); this.setOpen(false); }
}

function describe(a) {
  if (a.id === 'veteran') return '순찰 + 자동 달래기(넓은 반경), 빡침 억제';
  if (a.id === 'drill') return '자동 윽박, 생산성↑↑·빡침↑ (다혈질 주의)';
  if (a.id === 'vibe') return '반경 내 빡침 감소 가속 + 농땡이 지연(패시브)';
  return '저렴·느림, 가끔 실수 (가성비)';
}
