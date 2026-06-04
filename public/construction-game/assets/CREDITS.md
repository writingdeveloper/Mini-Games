# Tantrum Tower — Asset Credits

All committed 3D assets are CC0 (public domain) unless noted otherwise.

| File | Source | Author | License |
|------|--------|--------|---------|
| `worker.glb` | https://poly.pizza/m/Yg2bQZO6Hj | Quaternius | CC0 |

The game currently renders entirely with Three.js primitives (boxes/capsules/cylinders)
and synthesises all audio at runtime via the Web Audio API — no external asset files are
required to play.

## Adding CC0 models (optional enhancement)
1. Export CC0 models to glTF binary and place them here, e.g. `worker.glb`, `foreman.glb`
   (Quaternius RPG/Universal characters are a good CC0 source: https://quaternius.com/).
2. Set the matching entries in `ASSET_URLS` inside `src/main.js`
   (e.g. `worker: './assets/worker.glb'`).
3. Record each file's author + license + source URL in the table above.

**License hygiene (public portfolio repo):** commit CC0 only. Never commit Mixamo raw
files or non-CC0 Sketchfab models (redistribution is restricted). If a model fails to load
at runtime, the game falls back to its primitive automatically.
