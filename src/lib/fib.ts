import fs from "fs";
import path from "path";
import { PAIRS, type PairId } from "./pairs";

export type FibLevels = {
  at: string;
  ok?: boolean;
  reason?: string;
  symbol?: string;
  name?: string;
  pair?: PairId;
  source?: "fib" | "order";
  alreadyLive?: boolean;
  kind?: string;
  ticket?: number;
  level05: number;
  level1: number;
  entry: number;
  stopLoss: number;
  takeProfit?: number;
  side?: "buy" | "sell";
};

export type FibBook = {
  latest: FibLevels | null;
  pairs: Partial<Record<PairId, FibLevels>>;
  orders: Partial<Record<PairId, FibLevels>>;
  latestOrder: FibLevels | null;
};

export function deskPairFromSymbol(symbol?: string): PairId | null {
  if (!symbol) return null;
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const ids = [...PAIRS.map((p) => p.id)].sort((a, b) => b.length - a.length);
  return ids.find((id) => s.includes(id)) || null;
}

function readJson(file: string): FibLevels | null {
  try {
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    // Strip UTF-8 BOM if a Windows editor wrote one.
    const start = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
    const body = start ? buf.subarray(start) : buf;
    if (!body.length || body.every((b) => b === 0)) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
      return null;
    }
    const raw = JSON.parse(body.toString("utf8")) as Partial<FibLevels> & {
      ok?: boolean;
      reason?: string;
      name?: string;
      source?: string;
      alreadyLive?: boolean;
      kind?: string;
      ticket?: number;
    };
    const at = String(raw.at || new Date().toISOString());
    const pair = deskPairFromSymbol(raw.symbol) || undefined;
    if (raw.ok === false) {
      return {
        at,
        ok: false,
        reason: String(raw.reason || "no fibonacci on this chart"),
        symbol: raw.symbol ? String(raw.symbol) : undefined,
        pair,
        source: raw.source === "order" ? "order" : "fib",
        alreadyLive: Boolean(raw.alreadyLive),
        level05: 0,
        level1: 0,
        entry: 0,
        stopLoss: 0,
        takeProfit: 0,
      };
    }
    const level05 = Number(raw.level05 ?? raw.entry);
    const level1 = Number(raw.level1 ?? raw.stopLoss);
    if (!Number.isFinite(level05) || !Number.isFinite(level1)) return null;
    if (level05 <= 0 || level1 <= 0) return null;
    if (pair === "XAUUSD" && level05 < 500) return null;
    if ((pair === "USDJPY" || pair === "GBPJPY") && level05 < 50) return null;
    if (pair === "EURUSD" && (level05 < 0.5 || level05 > 5)) return null;
    const tpRaw = Number(raw.takeProfit);
    const takeProfit = Number.isFinite(tpRaw) && tpRaw > 0 ? tpRaw : level05 + 2.5 * (level05 - level1);
    const side = raw.side === "sell" || raw.side === "buy" ? raw.side : level1 > level05 ? "sell" : "buy";
    const source: "fib" | "order" = raw.source === "order" ? "order" : "fib";
    const ticket = Number(raw.ticket);
    return {
      at,
      ok: true,
      symbol: raw.symbol ? String(raw.symbol) : undefined,
      name: raw.name ? String(raw.name) : undefined,
      pair,
      side,
      source,
      alreadyLive: source === "order" || Boolean(raw.alreadyLive),
      kind: raw.kind ? String(raw.kind) : undefined,
      ticket: Number.isFinite(ticket) && ticket > 0 ? ticket : undefined,
      level05,
      level1,
      entry: level05,
      stopLoss: level1,
      takeProfit,
    };
  } catch {
    return null;
  }
}

function commonDir() {
  const appdata = process.env.APPDATA;
  if (!appdata) return null;
  return path.join(appdata, "MetaQuotes", "Terminal", "Common", "Files");
}

export function loadFibBook(): FibBook {
  const pairs: Partial<Record<PairId, FibLevels>> = {};
  const orders: Partial<Record<PairId, FibLevels>> = {};
  let latest: FibLevels | null = null;
  let latestOrder: FibLevels | null = null;
  const fibFiles: string[] = [];
  const orderFiles: string[] = [];
  const common = commonDir();
  if (common && fs.existsSync(common)) {
    try {
      for (const name of fs.readdirSync(common)) {
        const lower = name.toLowerCase();
        if (!lower.endsWith(".json")) continue;
        if (/^exnessfxbot-fib/i.test(name) && !/\.idle\.json$/i.test(name)) {
          fibFiles.push(path.join(/* turbopackIgnore: true */ common, name));
        }
        if (/^exnessfxbot-order/i.test(name) && !/\.idle\.json$/i.test(name)) {
          orderFiles.push(path.join(/* turbopackIgnore: true */ common, name));
        }
      }
    } catch {
      fibFiles.push(path.join(/* turbopackIgnore: true */ common, "exnessfxbot-fib.json"));
      orderFiles.push(path.join(/* turbopackIgnore: true */ common, "exnessfxbot-order.json"));
    }
  }
  fibFiles.push(path.join(process.cwd(), "data", "fib-levels.json"));

  for (const file of fibFiles) {
    const row = readJson(file);
    if (!row || row.ok === false) continue;
    if (row.source === "order") continue;
    if (row.pair) {
      const prev = pairs[row.pair];
      if (!prev || Date.parse(row.at) >= Date.parse(prev.at)) pairs[row.pair] = row;
    }
    if (!latest || Date.parse(row.at) >= Date.parse(latest.at)) latest = row;
  }

  for (const file of orderFiles) {
    const row = readJson(file);
    if (!row || row.ok === false) continue;
    const orderRow: FibLevels = { ...row, source: "order", alreadyLive: true };
    if (orderRow.pair) {
      const prev = orders[orderRow.pair];
      if (!prev || Date.parse(orderRow.at) >= Date.parse(prev.at)) orders[orderRow.pair] = orderRow;
    }
    if (!latestOrder || Date.parse(orderRow.at) >= Date.parse(latestOrder.at)) latestOrder = orderRow;
  }

  return { latest, pairs, orders, latestOrder };
}

export function loadFibLevels(): FibLevels | null {
  return loadFibBook().latest;
}

export function fibForPair(pair: PairId): FibLevels | null {
  const book = loadFibBook();
  const row = book.pairs[pair];
  if (row && row.ok !== false) return row;
  if (book.latest && book.latest.ok !== false && book.latest.pair === pair) return book.latest;
  return null;
}
