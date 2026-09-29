import test from "node:test";
import assert from "node:assert/strict";
import { freshState } from "../src/store.js";
import { considerEntry } from "../src/strategy.js";
import { cooldownInfo } from "../src/portfolio.js";
import { config } from "../src/config.js";

const good=(key="solana:X")=>({key,symbol:"TEST",price:0.001,liquidity:10000,volume5m:5000,buys5m:30,sells5m:10,buySellRatio:3,ageMinutes:10,score:100});

test("stop-loss blocks immediate re-entry",()=>{
  const now=Date.now(),s=freshState(now-1000);
  s.trades.push({key:"solana:X",symbol:"TEST",reason:"stop_loss",at:now-60000,pnl:-.2});
  const out=considerEntry(s,good(),now);
  assert.equal(out,null);
  assert.equal(s.decisions[0].reason,"reentry_cooldown");
  assert.equal(s.decisions[0].lastExitReason,"stop_loss");
  assert.ok(s.decisions[0].cooldownRemainingMs>0);
});

test("stop-loss cooldown expires",()=>{
  const now=Date.now(),s=freshState(now-1000);
  s.trades.push({key:"solana:X",symbol:"TEST",reason:"stop_loss",
    at:now-(config.stopLossReentryCooldownMinutes+1)*60000,pnl:-.2});
  considerEntry(s,good(),now);
  const out=considerEntry(s,good(),now+1000);
  assert.ok(out);
  assert.equal(out.status,"pending");
});

test("closed historical position alone does not permanently block token",()=>{
  const now=Date.now(),s=freshState(now-1000);
  s.positions.push({key:"solana:X",symbol:"TEST",quantity:0,closedAt:now-999999});
  considerEntry(s,good(),now);
  const out=considerEntry(s,good(),now+1000);
  assert.ok(out);
});

test("open position still blocks duplicate",()=>{
  const now=Date.now(),s=freshState(now-1000);
  s.positions.push({key:"solana:X",symbol:"TEST",quantity:10,openedAt:now-100});
  assert.equal(considerEntry(s,good(),now),null);
  assert.equal(s.decisions[0].reason,"position_already_open");
});

test("cooldown exposes reason and remaining time",()=>{
  const now=Date.now(),s=freshState(now-1000);
  s.trades.push({key:"solana:X",symbol:"TEST",reason:"stop_loss",at:now-1000});
  const cd=cooldownInfo(s,"solana:X",now,config);
  assert.equal(cd.active,true);
  assert.equal(cd.lastExitReason,"stop_loss");
  assert.ok(cd.remainingMs>0);
});

test("fresh state exposes portfolio summary primitives",()=>{
  const now=Date.now(),s=freshState(now);
  assert.equal(s.cash,10);
  assert.equal(s.initialCash,10);
  assert.equal(s.realizedPnl,0);
  assert.equal(s.startedAt,now);
  assert.ok(s.endsAt>now);
});
