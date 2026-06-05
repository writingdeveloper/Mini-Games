# Tantrum Tower — Asset Credits

All committed 3D assets are CC0 (public domain) unless noted otherwise.

| File | Source | Author | License |
|------|--------|--------|---------|
| `worker.glb` | https://poly.pizza/m/Yg2bQZO6Hj | Quaternius | CC0 |
| `props/crane.glb` | https://poly.pizza/m/17aBNzIsVg | cg | CC0 (Public Domain) |
| `props/metal-fence.glb` | https://poly.pizza/m/qWKhREFj7H | Quaternius | CC0 (Public Domain) |
| `props/fence.glb` | https://poly.pizza/m/JfSPlkPhRD | Quaternius | CC0 (Public Domain) |
| `props/traffic-cone.glb` | https://poly.pizza/m/VGvQupNGtK | Quaternius | CC0 (Public Domain) |
| `props/barrier.glb` | https://poly.pizza/m/4mrO9ueiQr | Kenney | CC0 (Public Domain) |
| `props/cinder-block.glb` | https://poly.pizza/m/lLkVKoJsKm | Quaternius | CC0 (Public Domain) |
| `props/bulldozer.glb` | https://poly.pizza/m/ddxtaegI3HQ | Poly by Google | Public Domain (Poly by Google) |

The game loads 3D prop models from `assets/props/` to enrich the construction-site atmosphere.
All prop models are CC0 / Public Domain and were sourced from Poly Pizza (https://poly.pizza).
Audio is synthesised at runtime via the Web Audio API.

## Adding CC0 models (optional enhancement)
1. Export CC0 models to glTF binary and place them here, e.g. `worker.glb`, `foreman.glb`
   (Quaternius RPG/Universal characters are a good CC0 source: https://quaternius.com/).
2. Set the matching entries in `ASSET_URLS` inside `src/main.js`
   (e.g. `worker: './assets/worker.glb'`).
3. Record each file's author + license + source URL in the table above.

**License hygiene (public portfolio repo):** commit CC0 only. Never commit Mixamo raw
files or non-CC0 Sketchfab models (redistribution is restricted). If a model fails to load
at runtime, the game falls back to its primitive automatically.
