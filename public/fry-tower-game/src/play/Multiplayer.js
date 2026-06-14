import { Session } from './Session.js';
import { HUD } from '../ui/HUD.js';
import { NetClient } from '../net/NetClient.js';
import { Opponents } from '../ui/Opponents.js';
import { CONFIG } from '../logic/config.js';
import { mulberry32 } from '../logic/rng.js';
import { shouldGrant, grantSabotage, sabotageByKey } from '../logic/sabotage.js';

// Tiny string -> uint32 hash (FNV-1a) so each player gets a distinct, stable rng seed.
function seedFromId(id) {
  let h = 0x811c9dc5;
  const s = String(id ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Drives server-authoritative best-of rounds: each round runs a local Session,
// reports height/score/charge at 10Hz, and reports round_end when the local round finishes.
// Sabotage (Phase 3b) is multiplayer-only and lives entirely here — solo is unaffected.
export function startMultiplayer({ game, input, fx, client, audio }) {
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('opponents')?.classList.remove('hidden');

  // Sabotage HUD is MP-only: reveal it here (solo never enters this module).
  const sabPanel = document.getElementById('sabotage-panel');
  const sabFill = document.getElementById('sabotage-fill');
  const sabHeld = document.getElementById('sabotage-held');
  const fireBtn = document.getElementById('fire-sabotage');
  const ketchupSplat = document.getElementById('ketchup-splat');
  if (sabPanel) sabPanel.classList.remove('hidden');

  const net = new NetClient(client);
  const opponents = new Opponents(client.playerId);
  const rng = mulberry32(seedFromId(client.playerId));
  let session = null;
  let hud = null;
  let latestPlayers = {};
  let startedRound = 0;
  let held = null;            // currently held sabotage key, or null
  let ketchupTimer = null;

  function refreshSabotageHud() {
    const charge = session ? session.combo.charge : 0;
    const cost = CONFIG.sabotage.grantCost;
    if (sabFill) sabFill.style.width = `${Math.min(100, (charge / cost) * 100)}%`;
    if (sabHeld) {
      if (held) {
        const info = sabotageByKey(held);
        sabHeld.textContent = info ? `${info.emoji} ${info.name}` : '';
        sabHeld.classList.remove('hidden');
      } else {
        sabHeld.textContent = '';
        sabHeld.classList.add('hidden');
      }
    }
    if (fireBtn) fireBtn.classList.toggle('hidden', !held);
  }

  // Pick the leading opponent (max height) and launch the held sabotage at them.
  function fire() {
    if (!held) return;
    let leaderId = null;
    let best = -Infinity;
    for (const [id, p] of Object.entries(latestPlayers)) {
      if (id === client.playerId) continue;
      const h = p?.height ?? 0;
      if (h > best) { best = h; leaderId = id; }
    }
    if (!leaderId) return; // no opponents yet
    client.sendAction('sabotage', { key: held, target: leaderId });
    if (audio) audio.sabotageFire();
    held = null;
    refreshSabotageHud();
  }

  // Apply an incoming sabotage to the local session.
  function applySabotage(key) {
    if (!session) return;
    if (audio) audio.sabotageHit();
    if (key === 'gust') session.applyGust();
    else if (key === 'seagull') session.nudgeRandomFry();
    else if (key === 'grease') session.greaseNextFry();
    else if (key === 'ketchup') {
      if (ketchupSplat) {
        ketchupSplat.classList.remove('hidden');
        if (ketchupTimer) clearTimeout(ketchupTimer);
        ketchupTimer = setTimeout(() => ketchupSplat.classList.add('hidden'), 2000);
      }
    }
  }

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
    session = new Session(game.scene, { fx, audio, onEnd: () => endRoundLocally() });
    held = null;
    if (!hud) {
      hud = new HUD(session);
    } else {
      hud.session = session;
    }
    net.startReporting(() => ({ height: session.height, score: session.score, charge: session.combo.charge }));
    refreshSabotageHud();
    window.__fry = { get session() { return session; } };
  }

  // One driver system for the whole match.
  game.add({
    update: (dt) => {
      if (session) {
        session.update(dt, input);
        if (fx) fx.followHeight(session.height);
        if (hud) hud.update();
        // Charge -> grant a sabotage when the threshold is reached and none is held.
        if (shouldGrant(session.combo.charge, held)) {
          held = grantSabotage(rng);
          session.combo.charge -= CONFIG.sabotage.grantCost;
          refreshSabotageHud();
        }
      }
    },
  });

  net.onState((data) => {
    latestPlayers = data.players || {};
    opponents.renderState(latestPlayers);
  });

  net.onEvent((ev) => {
    if (ev.type === 'round_start') startRound(ev.round ?? startedRound + 1);
    else if (ev.type === 'round_result') {
      if (audio) audio.roundEnd();
      opponents.showRoundResult(ev);
    } else if (ev.type === 'sabotage') {
      if (ev.target === client.playerId) applySabotage(ev.key);
    } else if (ev.type === 'forfeit' || ev.type === 'player_disconnected') {
      // Opponent left mid-match. The server ends a 1v1 as an explicit walkover
      // (forfeit + game:end). Show the result overlay clearly; player_disconnected
      // is the legacy signal and is treated the same so the player always sees it.
      net.stopReporting();
      if (audio) audio.matchEnd();
      opponents.showForfeit(ev, latestPlayers);
    }
  });

  net.onEnd((data) => {
    net.stopReporting();
    if (audio) audio.matchEnd();
    // A walkover end carries reason:'walkover' — keep the clear "부전승" message
    // instead of the generic match-end overlay.
    if (data && data.reason === 'walkover') opponents.showForfeit(data, latestPlayers);
    else opponents.showMatchEnd(data, latestPlayers);
  });

  // Fire on the F key (sabotage is MP-only, so this listener lives here, not in shared Input).
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') fire();
  });
  if (fireBtn) {
    fireBtn.addEventListener('click', fire);
    fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); fire(); }, { passive: false });
  }

  game.start();

  // The server broadcasts the first round_start inside onStart(), which runs BEFORE
  // GAME_START — the client only attaches listeners on gameStart, so it would miss it.
  // Start round 1 locally on match begin; rounds 2+ arrive via the round_start event.
  startRound(1);
}
