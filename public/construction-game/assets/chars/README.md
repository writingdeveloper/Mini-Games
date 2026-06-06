# Animated worker model drop-in folder

Drop a CC0 animated worker `worker.glb` here (Kenney "Mini Characters" hard-hat worker, or Quaternius
"Ultimate Modular Men" Worker), then set `WORKER_MODEL_URL = './assets/chars/worker.glb'` in `src/main.js`.
`AssetLoader` now zeroes `metalness` so the model renders bright; `Worker.setModel()` swaps the primitive
for it (status sprites preserved) and plays its idle/work animation, with the bright primitive hammer-rig
as the guaranteed fallback. See `docs/superpowers/assets-acquisition.md`.
