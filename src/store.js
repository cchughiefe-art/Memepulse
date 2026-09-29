import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export const STATE_FILE = path.join(config.dataDir, "state-v4-live.json");

export function freshState(now = Date.now()) {
  return {
    version: 4.1,
    build: "v4.1-reentry-accounting",
    startedAt: now,
    endsAt: now + config.sessionDays * 86400000,
    initialCash: config.initialCash,
    cash: config.initialCash,
    realizedPnl: 0,
    equityPeak: config.initialCash,
    lastScan: null,
    candidates: {},
    positions: [],
    orders: [],
    trades: [],
    decisions: []
  };
}

export function loadState() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    const s = freshState();
    saveState(s);
    return s;
  }
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    // Preserve V4 live state while adding V4.1 fields.
    s.version = 4.1;
    s.build = "v4.1-reentry-accounting";
    if (!Number.isFinite(s.startedAt)) s.startedAt = Date.now();
    if (!Number.isFinite(s.endsAt)) s.endsAt = s.startedAt + config.sessionDays * 86400000;
    if (!Number.isFinite(s.initialCash)) s.initialCash = config.initialCash;
    if (!Number.isFinite(s.cash)) s.cash = config.initialCash;
    if (!Number.isFinite(s.realizedPnl)) s.realizedPnl = 0;
    s.candidates ||= {};
    s.positions ||= [];
    s.orders ||= [];
    s.trades ||= [];
    s.decisions ||= [];
    return s;
  } catch {
    const s = freshState();
    saveState(s);
    return s;
  }
}

export function saveState(s) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
