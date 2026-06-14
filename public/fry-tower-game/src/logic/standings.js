// Pure ranking helpers over a { id: { name, height, score, roundWins } } map.
export function rankPlayers(players, key = 'height') {
  return Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
}

export function matchLeader(players) {
  const ranked = rankPlayers(players, 'roundWins');
  return ranked.length ? ranked[0].id : null;
}
