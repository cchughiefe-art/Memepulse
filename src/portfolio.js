export const openPositions = s => s.positions.filter(p => p.quantity > 0 && !p.closedAt);
export const pendingBuys = s => s.orders.filter(o => o.side === "buy" && o.status === "pending");

export function markPrice(s, key) {
  return s.candidates?.[key]?.last?.price || 0;
}

export function equity(s) {
  const marked = openPositions(s).reduce((sum, p) => sum + p.quantity * markPrice(s, p.key), 0);
  return s.cash + marked;
}

export function drawdownPct(s) {
  const e = equity(s);
  s.equityPeak = Math.max(Number(s.equityPeak) || s.initialCash, e);
  return s.equityPeak > 0 ? ((s.equityPeak - e) / s.equityPeak) * 100 : 0;
}

export function lastExit(s, key) {
  const rows = s.trades.filter(t => t.key === key);
  return rows.length ? rows.reduce((a,b) => a.at > b.at ? a : b) : null;
}

export function cooldownInfo(s, key, now, config) {
  const exit = lastExit(s, key);
  if (!exit) return { active:false, remainingMs:0, lastExitAt:null, lastExitReason:null };
  const minutes = exit.reason === "stop_loss"
    ? config.stopLossReentryCooldownMinutes
    : config.normalReentryCooldownMinutes;
  const until = exit.at + minutes * 60000;
  return {
    active: now < until,
    remainingMs: Math.max(0, until - now),
    until,
    lastExitAt: exit.at,
    lastExitReason: exit.reason
  };
}
