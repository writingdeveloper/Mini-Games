# Tantrum Tower — Asset Acquisition Guide (S7)

The game now has the **infrastructure** to use real audio samples, an animated worker model, and Korean
foreman voice lines — everything falls back gracefully to the procedural synth / bright primitive when an
asset is absent, so the game always works. This guide lists the exact CC0/MIT assets to add and where to
drop them. **No code changes are needed** to add audio/voice; the worker model needs one line flipped.

These steps must be run **offline / on a dev machine** — they involve extracting asset zips and running a
local TTS model, which the build environment can't do. All picks are free-for-commercial-use (CC0 unless
noted), keeping the public repo clean.

## 1. Construction SFX → `public/construction-game/assets/sfx/`
Drop these filenames (any are optional; a missing one just uses the synth):

| File | Source (CC0) | Pick |
|---|---|---|
| `hammer.ogg` | OpenGameArt **"100 CC0 metal and wood SFX"** (rubberduck) — https://opengameart.org/content/100-cc0-metal-and-wood-sfx | a single short metal-hammer hit |
| `ambience.ogg` | OpenGameArt **"100 CC0 SFX #2"** (rubberduck) — https://opengameart.org/content/100-cc0-sfx-2 | the "construction site" / "machine" loop (set to loop-able) |
| `floor.ogg` | Kenney **Interface Sounds** (CC0) — https://kenney.nl/assets/interface-sounds | a positive confirmation sting |
| `building.ogg` | Kenney **Interface Sounds** (CC0) | a bigger success/fanfare sting |
| `alarm.ogg` | Kenney **Interface Sounds** (CC0) | an error/alert sting |

`AudioManager.loadPack()` fetches these on `init()`; present ones replace the synth, the rest fall back.
Keep each clip small (<200 KB) and prefer `.ogg` (decodes natively, smallest). Note the source in
`CREDITS.md` even though CC0 needs no attribution.

## 2. Korean foreman voice → `public/construction-game/assets/voice/`
There is **no ready-made CC0 *Korean* shout pack**, so pre-generate clips with an MIT-licensed local TTS
(its output carries no per-clip license). Recommended: **MeloTTS-Korean** (MIT) —
https://huggingface.co/myshell-ai/MeloTTS-Korean (lighter alt: Piper `neurlang/piper-onnx-kss-korean`).
**Avoid** edge-tts/Azure (TOS-restricted) and CC-BY-NC voices.

Generate 2–3 variants per tactic and export to `.ogg` (filenames the manifest already looks for):
`bark_01.ogg`..`bark_03.ogg`, `taunt_01.ogg`..`taunt_02.ogg`, `soothe_01.ogg`..`soothe_02.ogg`.

Suggested lines (comedic hot-tempered foreman):
- **윽박/bark:** "똑바로 안 해!?", "손이 발이야?!", "거기서 뭐 하는 거야!"
- **비꼬기/taunt:** "그게 최선이냐~", "아이고 잘~한다", "월급이 아깝다 아까워"
- **달래기/soothe:** "그래, 잘하고 있어", "한 박자 쉬어가자", "자, 다시 힘내보자고"

Example (MeloTTS Python, run locally):
```python
from melo.api import TTS
tts = TTS(language='KR', device='cpu')
sid = tts.hps.data.spk2id['KR']
tts.tts_to_file("똑바로 안 해!?", sid, "bark_01.wav", speed=1.1)
# ...repeat per line, then: ffmpeg -i bark_01.wav -ac 1 -ar 22050 bark_01.ogg
```
`AudioManager.shout()` plays a random matching clip if present, else the synth bark.

## 3. Animated worker model → `public/construction-game/assets/chars/worker.glb`
The "characters render black" problem is fixed (`AssetLoader` now zeroes `metalness`), so a CC0 animated
worker renders bright. Recommended: **Kenney "Mini Characters"** (CC0) — https://kenney.nl/assets/mini-characters
(flat single-material, safest), pull the hard-hat construction character `.glb`. Alt upgrade: **Quaternius
"Ultimate Modular Men"** Worker (CC0) — https://poly.pizza/m/Yg2bQZO6Hj.

To activate:
1. Put the file at `public/construction-game/assets/chars/worker.glb`.
2. In `public/construction-game/src/main.js`, set `WORKER_MODEL_URL = './assets/chars/worker.glb'`.

`Worker.setModel()` then swaps the primitive for the model (status sprites preserved) and plays its
idle/work animation. If the file is missing or fails, the bright primitive hammer-rig stays — no crash,
no console error. Verify it renders bright + correctly scaled, then commit the (small) binary.

## 4. Optional: more 3D props / city kit
- Kenney **Conveyor Kit** (CC0) — outside-fence industrial props; add rows to `Site.js` `REAL_PROP_TABLE`.
- Quaternius **Downtown City MegaKit** (CC0) — a richer backdrop skyline (heavier; current skyline is
  instanced primitives and needs no asset).

## Where the code already hooks in
- `AudioManager` `SFX_MANIFEST` / `VOICE_MANIFEST` → just drop files; `loadPack()` is called on `init()`.
- `AssetLoader._loadInner` → `metalness=0/roughness=1` applied to every loaded glTF material.
- `main.js` `WORKER_MODEL_URL` → flip to enable the worker model.
