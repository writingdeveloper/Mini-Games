import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { Stage } from './render/Stage.js';
import { Session } from './play/Session.js';
import { HUD } from './ui/HUD.js';
import { Fx } from './render/Fx.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const result = document.getElementById('result');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const resultDetail = document.getElementById('result-detail');

let game = null;
try {
  game = new Game(canvas);
} catch (err) {
  console.error('[fry-tower] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  game.add(new Stage(game.scene));
  const input = new Input();
  const fx = new Fx(game.scene, game.camera);
  game.add(fx);

  // ---- Solo (existing behavior) ----
  function startSolo() {
    menu.classList.add('hidden');
    result.classList.add('hidden');
    hud.classList.remove('hidden');
    const session = new Session(game.scene, {
      fx,
      onEnd: ({ height, score }) => {
        resultDetail.textContent = `높이 ${height.toFixed(1)}m · 점수 ${score}`;
        result.classList.remove('hidden');
      },
    });
    game.add({ update: (dt) => session.update(dt, input) });
    game.add(new HUD(session));
    game.start();
    window.__fry = { get session() { return session; } };
  }

  startBtn.addEventListener('click', startSolo);
  restartBtn.addEventListener('click', () => location.reload());

  // ---- Multiplayer bootstrap (mirrors escape-game) ----
  const params = new URLSearchParams(location.search);
  const serverUrl = params.get('server');
  if (params.get('mode') === 'multi' && serverUrl) {
    menu.classList.add('hidden');
    bootstrapMultiplayer(serverUrl);
  }

  function bootstrapMultiplayer(url) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/shared/lobby/LobbyUI.css';
    document.head.appendChild(css);
    const sio = document.createElement('script');
    sio.src = url + '/socket.io/socket.io.js';
    sio.onload = async () => {
      const { GameClient } = await import('/shared/networking/GameClient.js');
      const { LobbyUI } = await import('/shared/lobby/LobbyUI.js');
      const { startMultiplayer } = await import('./play/Multiplayer.js');
      const client = new GameClient(url);
      const lobby = new LobbyUI(client, {
        gameType: 'frytower',
        gameName: 'FRYFFEL TOWER',
        onSinglePlayer: () => startSolo(),
        onGameStart: () => startMultiplayer({ game, input, fx, client }),
      });
      lobby.show();
    };
    sio.onerror = () => { console.error('[fry-tower] failed to load socket.io-client'); menu.classList.remove('hidden'); };
    document.head.appendChild(sio);
  }

  game.renderOnce();
  console.log('[fry-tower] ready');
}
