import { Session } from './Session.js';
import { HUD } from '../ui/HUD.js';
import { NetClient } from '../net/NetClient.js';
import { Opponents } from '../ui/Opponents.js';

// Drives server-authoritative best-of rounds: each round runs a local Session,
// reports height/score at 10Hz, and reports round_end when the local round finishes.
export function startMultiplayer({ game, input, fx, client }) {
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('opponents')?.classList.remove('hidden');

  const net = new NetClient(client);
  const opponents = new Opponents(client.playerId);
  let session = null;
  let hud = null;
  let latestPlayers = {};
  let startedRound = 0;

  function endRoundLocally() {
    if (!session) return;
    net.stopReporting();
    net.reportRoundEnd(session.height, session.score);
  }

  function startRound(roundNum) {
    if (roundNum <= startedRound) return; // de-dupe late/duplicate round_start
    startedRound = roundNum;
    opponents.hideResult();
    if (session) session.dispose();
    session = new Session(game.scene, { fx, onEnd: () => endRoundLocally() });
    if (!hud) {
      hud = new HUD(session);
    } else {
      hud.session = session;
    }
    net.startReporting(() => ({ height: session.height, score: session.score }));
    window.__fry = { get session() { return session; } };
  }

  // One driver system for the whole match.
  game.add({
    update: (dt) => {
      if (session) {
        session.update(dt, input);
        if (fx) fx.followHeight(session.height);
        if (hud) hud.update();
      }
    },
  });

  net.onState((data) => {
    latestPlayers = data.players || {};
    opponents.renderState(latestPlayers);
  });

  net.onEvent((ev) => {
    if (ev.type === 'round_start') startRound(ev.round ?? startedRound + 1);
    else if (ev.type === 'round_result') opponents.showRoundResult(ev);
  });

  net.onEnd((data) => {
    net.stopReporting();
    opponents.showMatchEnd(data, latestPlayers);
  });

  game.start();

  // The server broadcasts the first round_start inside onStart(), which runs BEFORE
  // GAME_START — the client only attaches listeners on gameStart, so it would miss it.
  // Start round 1 locally on match begin; rounds 2+ arrive via the round_start event.
  startRound(1);
}
