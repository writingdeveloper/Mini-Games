# Korean foreman voice drop-in folder

Pre-generate short barks with an MIT-licensed local TTS (MeloTTS-Korean) and drop them here
(`bark_01..03.ogg`, `taunt_01..02.ogg`, `soothe_01..02.ogg`), then uncomment the matching lines in
`src/audio/AudioManager.js` `VOICE_MANIFEST`. `AudioManager.shout()` plays a random matching clip if
present, else the synth bark. See `docs/superpowers/assets-acquisition.md` for the exact pipeline + lines.
