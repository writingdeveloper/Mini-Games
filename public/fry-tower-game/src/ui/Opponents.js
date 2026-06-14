import { rankPlayers, matchLeader } from '../logic/standings.js';

// Renders opponent height bars into #opponents and round/match overlays into #result.
export class Opponents {
  constructor(myId) {
    this.myId = myId;
    this.el = document.getElementById('opponents');
    this.result = document.getElementById('result');
    this.resultTitle = document.getElementById('result-title');
    this.resultDetail = document.getElementById('result-detail');
  }

  renderState(players) {
    if (!this.el) return;
    const others = rankPlayers(players, 'height').filter((p) => p.id !== this.myId);
    this.el.innerHTML = others.map((p) =>
      `<div class="opp"><span class="opp-name">${p.name ?? p.id.slice(0, 4)}</span>` +
      `<span class="opp-bar"><i style="height:${Math.min(100, (p.height || 0) * 20)}%"></i></span>` +
      `<span class="opp-h">${(p.height || 0).toFixed(1)}m · ${p.roundWins ?? 0}승</span></div>`
    ).join('');
  }

  showRoundResult(ev) {
    const win = ev.standings?.find((s) => s.id === ev.winnerId);
    this.resultTitle.textContent = `${ev.round}라운드 종료`;
    this.resultDetail.textContent = win
      ? `${win.name} 승리 (${win.finalHeight.toFixed(1)}m)`
      : '무승부';
    this.result.classList.remove('hidden');
  }

  showMatchEnd(data, players) {
    const id = data.matchWinnerId ?? matchLeader(players);
    const w = (data.totals || []).find((t) => t.id === id);
    this.resultTitle.textContent = '경기 종료!';
    this.resultDetail.textContent = w ? `우승: ${w.name} (${w.roundWins}승)` : '경기 종료';
    this.result.classList.remove('hidden');
  }

  // Opponent left mid-match → the remaining player wins by walkover (부전승).
  // Accepts either a forfeit game:event ({ winnerId }) or the game:end payload
  // ({ matchWinnerId, reason:'walkover' }).
  showForfeit(ev, players) {
    const id = ev.winnerId ?? ev.matchWinnerId ?? matchLeader(players);
    const won = id === this.myId;
    const name = players?.[id]?.name;
    this.resultTitle.textContent = won ? '부전승!' : '경기 종료';
    this.resultDetail.textContent = won
      ? '상대가 나갔습니다 — 부전승!'
      : (name ? `${name} 부전승` : '상대가 나갔습니다');
    this.result.classList.remove('hidden');
  }

  hideResult() { this.result.classList.add('hidden'); }
}
