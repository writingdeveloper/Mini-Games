import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { Stage } from './render/Stage.js';
import { Session } from './play/Session.js';
import { HUD } from './ui/HUD.js';

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
  let session = null;

  function startGame() {
    menu.classList.add('hidden');
    result.classList.add('hidden');
    hud.classList.remove('hidden');
    session = new Session(game.scene, {
      onEnd: ({ height, score }) => {
        resultDetail.textContent = `높이 ${height.toFixed(1)}m · 점수 ${score}`;
        result.classList.remove('hidden');
      },
    });
    // Drive the session + HUD from the game loop.
    const hudView = new HUD(session);
    game.add({ update: (dt) => session.update(dt, input) });
    game.add(hudView);
    game.start();
    // expose for e2e
    window.__fry = { get session() { return session; } };
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => location.reload());

  game.renderOnce();
  console.log('[fry-tower] ready');
}
