import { CONFIG } from './config.js';

export function createEconomy(startFunds) {
  return { funds: startFunds, fireCooldown: 0 };
}

export function earn(econ, amount) { econ.funds += amount; return econ; }

export function canAfford(econ, cost) { return econ.funds >= cost; }

export function spend(econ, cost) {
  if (econ.funds < cost) return false;
  econ.funds -= cost;
  return true;
}

export function payrollPerSec(managers) {
  let sum = 0;
  for (const m of managers) sum += m.salary;
  return sum;
}

export function tickEconomy(econ, managers, dt) {
  econ.funds -= payrollPerSec(managers) * dt;
  if (econ.fireCooldown > 0) econ.fireCooldown = Math.max(0, econ.fireCooldown - dt);
  if (econ.funds < 0 && econ.fireCooldown === 0 && managers.length > 0) {
    let best = 0;
    for (let i = 1; i < managers.length; i++) {
      if (managers[i].salary > managers[best].salary) best = i;
    }
    econ.fireCooldown = CONFIG.economy.fireCooldownSec;
    return best;
  }
  return -1;
}
