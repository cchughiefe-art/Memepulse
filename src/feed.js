import { config } from "./config.js";

const n = x => Number(x || 0);

export async function fetchCandidates() {
  const r = await fetch(config.feedUrl, { headers: { accept:"application/json" }, signal:AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`feed_http_${r.status}`);
  const j = await r.json();
  const now=Date.now();
  return (j.data||[]).map(row=>{
    const a=row.attributes||{};
    const rel=row.relationships||{};
    const addr=rel.base_token?.data?.id?.split("_").pop() || row.id;
    const buys=n(a.transactions?.m5?.buys);
    const sells=n(a.transactions?.m5?.sells);
    const liq=n(a.reserve_in_usd);
    const vol=n(a.volume_usd?.m5);
    const created=Date.parse(a.pool_created_at||"");
    const ageMinutes=Number.isFinite(created)?(now-created)/60000:null;
    let score=0;
    if (liq>=3500) score+=25;
    if (vol>=500) score+=20;
    if (buys>=8) score+=20;
    if (buys/Math.max(1,sells)>=1.15) score+=20;
    if (ageMinutes!=null && ageMinutes<=240) score+=15;
    return {
      key:`solana:${addr}`,symbol:a.name?.split("/")[0]?.trim()||addr.slice(0,8),
      price:n(a.base_token_price_usd),liquidity:liq,volume5m:vol,buys5m:buys,
      sells5m:sells,buySellRatio:buys/Math.max(1,sells),ageMinutes,score
    };
  });
}
