// User accessibility settings, persisted to localStorage. THREE-free.
const KEY = 'tantrum-settings';
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
const saved = load();
export const SETTINGS = {
  reducedMotion: saved.reducedMotion ?? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches),
  muted: saved.muted ?? false,
};
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify({ reducedMotion: SETTINGS.reducedMotion, muted: SETTINGS.muted })); } catch (e) { /* ignore */ }
}
