import crypto from "node:crypto";
import { config } from "./config.js";
import { recordDecision, blockers } from "./strategy.js";

const FEE_RATE = 0.0225; // conservative paper execution friction

export function processOrders(s, now = Date.now()) {
  for (const o of s.orders.filter(x => x.status === "pending" && x.readyAt <= now)) {
    const t = s.candidates?.[o.key]?.last;
    if (!t || now > o.deadline) {
      o.status="cancelled"; o.reason="stale_revalidation";
      recordDecision(s,{key:o.key,symbol:o.symbol,status:"rejected",reason:o.reason,orderId:o.id});
      continue;
    }
    const bad = blockers(t);
    if (bad.length || !(t.price > 0)) {
      o.status="cancelled"; o.reason="failed_fill_revalidation";
      recordDecision(s,{key:o.key,symbol:o.symbol,status:"rejected",reason:o.reason,orderId:o.id});
      continue;
    }
    const totalCost = o.notional * (1 + FEE_RATE);
    if (s.cash < totalCost) {
      o.status="cancelled"; o.reason="insufficient_free_cash_at_fill";
      recordDecision(s,{key:o.key,symbol:o.symbol,status:"rejected",reason:o.reason,orderId:o.id});
      continue;
    }
    const qty = o.notional / t.price;
    s.cash -= totalCost;
    const p = {
      id:crypto.randomUUID(),key:o.key,symbol:o.symbol,quantity:qty,initialQuantity:qty,
      entryPrice:t.price,entryCost:totalCost,remainingCost:totalCost,openedAt:now,
      peakPrice:t.price,principalTaken:false,scaled:false
    };
    s.positions.push(p);
    o.status="filled"; o.filledAt=now; o.positionId=p.id;
    recordDecision(s,{key:o.key,symbol:o.symbol,status:"filled",
      reason:"paper_entry_filled",positionId:p.id});
  }
}

function closeQty(s,p,qty,price,reason,now) {
  qty = Math.min(qty,p.quantity);
  if (!(qty > 0) || !(price > 0)) return;
  const fraction = qty / p.quantity;
  const cost = p.remainingCost * fraction;
  const gross = qty * price;
  const proceeds = gross * (1 - FEE_RATE);
  const pnl = proceeds - cost;
  p.quantity -= qty;
  p.remainingCost -= cost;
  s.cash += proceeds;
  s.realizedPnl += pnl;
  s.trades.push({id:crypto.randomUUID(),positionId:p.id,key:p.key,symbol:p.symbol,
    quantity:qty,proceeds,cost,pnl,reason,at:now});
  if (p.quantity <= 1e-12) {
    p.quantity=0;p.remainingCost=0;p.closedAt=now;p.realized=(p.realized||0)+pnl;
  }
}

export function managePositions(s, now = Date.now()) {
  for (const p of s.positions.filter(x => x.quantity > 0 && !x.closedAt)) {
    const t=s.candidates?.[p.key]?.last;
    if (!t?.price) continue;
    const price=t.price;
    p.peakPrice=Math.max(p.peakPrice||p.entryPrice,price);
    const multiple=price/p.entryPrice;

    if (price <= p.entryPrice*(1-config.stopLossPct/100)) {
      closeQty(s,p,p.quantity,price,"stop_loss",now);
      continue;
    }
    if (!p.principalTaken && multiple >= config.takePrincipalMultiple) {
      const desiredGross=p.entryCost/(1-FEE_RATE);
      closeQty(s,p,Math.min(p.quantity,desiredGross/price),price,"principal_recovery",now);
      p.principalTaken=true;
      continue;
    }
    if (!p.scaled && multiple >= config.scaleMultiple) {
      closeQty(s,p,p.quantity*0.35,price,"runner_scale",now);
      p.scaled=true;
      continue;
    }
    if (p.principalTaken && price <= p.peakPrice*(1-config.trailPct/100)) {
      closeQty(s,p,p.quantity,price,"protected_runner_exit",now);
    }
  }
}
