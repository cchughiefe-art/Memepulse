import http from "node:http";
import { config } from "./config.js";
import { loadState, saveState } from "./store.js";
import { fetchCandidates } from "./feed.js";
import { considerEntry } from "./strategy.js";
import { processOrders, managePositions } from "./execution.js";
import { equity, drawdownPct, openPositions, pendingBuys, cooldownInfo } from "./portfolio.js";

const s=loadState();
let busy=false;

async function tick(){
  if(busy)return;
  busy=true;
  try{
    const tokens=await fetchCandidates();
    const now=Date.now();
    for(const t of tokens){
      const c=s.candidates[t.key] ||= {confirmations:0};
      c.last=t;c.lastSeenAt=now;
      considerEntry(s,t,now);
    }
    processOrders(s,now);
    managePositions(s,now);
    s.lastScan=now;
    drawdownPct(s);
    saveState(s);
  }catch(e){
    s.lastError={at:Date.now(),message:String(e?.message||e)};
    saveState(s);
  }finally{busy=false}
}

function summary(){
  const e=equity(s);
  return {
    build:s.build,version:s.version,startedAt:s.startedAt,endsAt:s.endsAt,
    initialCash:s.initialCash,cash:s.cash,equity:e,realizedPnl:s.realizedPnl,
    unrealizedPnl:e-s.cash-openPositions(s).reduce((z,p)=>z+p.remainingCost,0),
    returnPct:((e-s.initialCash)/s.initialCash)*100,
    drawdownPct:drawdownPct(s),lastScan:s.lastScan,busy,
    positions:s.positions,orders:s.orders,trades:s.trades
  };
}

function diagnostics(){
  const now=Date.now();
  const histogram={};
  for(const d of s.decisions) histogram[d.reason]=(histogram[d.reason]||0)+1;
  const cooldowns=s.trades.map(t=>({key:t.key,symbol:t.symbol,...cooldownInfo(s,t.key,now,config)}))
    .filter((x,i,a)=>a.findIndex(y=>y.key===x.key)===i && x.active);
  return {
    build:s.build,lastScan:s.lastScan,busy,
    portfolio:{
      initialCash:s.initialCash,cash:s.cash,equity:equity(s),realizedPnl:s.realizedPnl,
      openPositions:openPositions(s).length,pendingBuys:pendingBuys(s).length,
      startedAt:s.startedAt,endsAt:s.endsAt
    },
    cooldowns,
    rejectionHistogram:histogram,
    recentDecisions:s.decisions.slice(0,50),
    lastOrder:s.orders[0]||null,
    lastTrade:s.trades.at(-1)||null,
    lastError:s.lastError||null
  };
}

const server=http.createServer((req,res)=>{
  res.setHeader("content-type","application/json");
  if(req.url==="/api/state") return res.end(JSON.stringify(summary()));
  if(req.url==="/api/diagnostics") return res.end(JSON.stringify(diagnostics()));
  if(req.url==="/health") return res.end(JSON.stringify({ok:true,build:s.build,lastScan:s.lastScan}));
  res.statusCode=404;res.end(JSON.stringify({error:"not_found"}));
});
server.listen(config.port,"0.0.0.0",()=>console.log(`MemePulse ${s.build} PAPER ONLY on ${config.port}`));
tick();
setInterval(tick,config.scanSeconds*1000);
