import { CONFIG } from './config.js';

export function createRound(cfg = CONFIG.round) {
  return { phase: 'playing', timeLeft: cfg.duration };
}

export function tickRound(r, dt) {
  if (r.phase !== 'playing') return r;
  const t = r.timeLeft - dt;
  if (t <= 0) return { phase: 'ended', timeLeft: 0 };
  return { phase: 'playing', timeLeft: t };
}

export function isOver(r) { return r.phase === 'ended'; }
