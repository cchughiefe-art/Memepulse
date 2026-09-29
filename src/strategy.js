import { config } from "./config.js";
import { openPositions, pendingBuys, cooldownInfo, equity } from "./portfolio.js";
import crypto from "node:crypto";

export function recordDecision(s, row) {
  s.decisions.unshift({ id: crypto.randomUUID(), at: Date.now(), ...row });
  if (s.decisions.length > 1000) s.decisions.length = 1000;
}

export function blockers(t) {
  const out = [];
  if (Number.isFinite(t.ageMinutes) && t.ageMinutes > config.maxPoolAgeMinutes) out.push("pool_age");
  if (!(t.liquidity >= config.minLiquidity)) out.push("liquidity");
  if (!(t.volume5m >= config.minVolume5m)) out.push("volume_5m");
  if (!(t.buys5m >= config.minBuys5m)) out.push("buys_5m");
  if (!(t.buySellRatio >= config.minBuySellRatio)) out.push("buy_sell_ratio");
  if (!(t.price > 0)) out.push("price");
  return out;
}

export function considerEntry(s, t, now = Date.now()) {
  const base = { key:t.key, symbol:t.symbol };
  if (now >= s.endsAt) {
    recordDecision(s,{...base,status:"rejected",reason:"session_ended"});
    return null;
  }
  if (openPositions(s).some(p => p.key === t.key)) {
    recordDecision(s,{...base,status:"rejected",reason:"position_already_open"});
    return null;
  }
  if (pendingBuys(s).some(o => o.key === t.key)) {
    recordDecision(s,{...base,status:"rejected",reason:"order_already_pending"});
    return null;
  }
  const cd = cooldownInfo(s,t.key,now,config);
  if (cd.active) {
    recordDecision(s,{...base,status:"rejected",reason:"reentry_cooldown",
      lastExitAt:cd.lastExitAt,lastExitReason:cd.lastExitReason,
      cooldownRemainingMs:cd.remainingMs,cooldownUntil:cd.until});
    return null;
  }
  const bad = blockers(t);
  if (bad.length) {
    recordDecision(s,{...base,status:"rejected",reason:bad.join(","),score:t.score});
    return null;
  }
  if ((t.score||0) < config.minScore) {
    recordDecision(s,{...base,status:"rejected",reason:"score",score:t.score});
    return null;
  }

  const c = s.candidates[t.key] ||= { confirmations:0 };
  c.confirmations = (c.confirmations || 0) + 1;
  c.last = t;
  if (c.confirmations < config.confirmationScans) {
    recordDecision(s,{...base,status:"watching",reason:"awaiting_confirmation",
      score:t.score,confirmed:c.confirmations});
    return null;
  }

  if (openPositions(s).length + pendingBuys(s).length >= config.maxPositions) {
    recordDecision(s,{...base,status:"rejected",reason:"max_positions"});
    return null;
  }

  const desired = equity(s) * config.positionPct / 100;
  const notional = Math.min(desired, s.cash);
  if (notional < config.minOrderUsd) {
    recordDecision(s,{...base,status:"rejected",reason:"insufficient_free_cash",notional});
    return null;
  }

  const order = {
    id:crypto.randomUUID(),key:t.key,symbol:t.symbol,side:"buy",status:"pending",
    createdAt:now,readyAt:now+3500,deadline:now+180000,notional,score:t.score
  };
  s.orders.unshift(order);
  c.confirmations = 0;
  recordDecision(s,{...base,status:"accepted",reason:"paper_entry_queued",
    orderId:order.id,notional});
  return order;
}
