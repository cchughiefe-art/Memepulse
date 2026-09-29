import path from "node:path";

const num = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: num("PORT", 3000),
  scanSeconds: Math.max(30, num("SCAN_SECONDS", 60)),
  dataDir: process.env.DATA_DIR || path.resolve("data"),
  initialCash: num("INITIAL_CASH_USD", 10),
  sessionDays: num("SESSION_DAYS", 5),
  minScore: num("MIN_SCORE", 74),
  positionPct: num("POSITION_PCT", 7),
  maxPositions: num("MAX_POSITIONS", 5),
  minOrderUsd: num("MIN_ORDER_USD", 0.10),
  stopLossPct: num("STOP_LOSS_PCT", 32),
  takePrincipalMultiple: num("TAKE_PRINCIPAL_MULTIPLE", 2),
  scaleMultiple: num("SCALE_MULTIPLE", 3),
  trailPct: num("RUNNER_TRAIL_PCT", 28),
  normalReentryCooldownMinutes: num("REENTRY_COOLDOWN_MINUTES", 15),
  stopLossReentryCooldownMinutes: num("STOP_REENTRY_COOLDOWN_MINUTES", 30),
  confirmationScans: Math.max(1, num("CONFIRMATION_SCANS", 2)),
  maxPoolAgeMinutes: num("MAX_POOL_AGE_MINUTES", 240),
  minLiquidity: num("MIN_LIQUIDITY_USD", 3500),
  minVolume5m: num("MIN_VOLUME_5M_USD", 500),
  minBuys5m: num("MIN_BUYS_5M", 8),
  minBuySellRatio: num("MIN_BUY_SELL_RATIO", 1.15),
  feedUrl: process.env.MEMEPULSE_FEED_URL || "https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1"
};
