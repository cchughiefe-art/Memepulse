# MemePulse V4.1

Paper-only Solana memecoin simulation core.

V4.1 fixes the first live V4 findings:

- stop-loss re-entry cooldown (30 minutes by default)
- ordinary re-entry cooldown (15 minutes)
- explicit `reentry_cooldown` decisions with last exit reason/time
- `/api/state` exposes cash, equity, realized PnL, session times and return
- `/api/diagnostics` is compact and includes portfolio summary, cooldowns and rejection histogram
- historical closed positions do not permanently block a token
- active/pending duplicate protection remains
- fresh V4 state remains `data/state-v4-live.json`

This is simulation software, not a profit guarantee.
