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
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<FibLevels> & {
      ok?: boolean;
      reason?: string;
      name?: string;
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
    const tpRaw = Number(raw.takeProfit);
    const takeProfit = Number.isFinite(tpRaw) && tpRaw > 0 ? tpRaw : level05 + 2.5 * (level05 - level1);
    const side = raw.side === "sell" || raw.side === "buy" ? raw.side : level1 > level05 ? "sell" : "buy";
    return {
      at,
      ok: true,
      symbol: raw.symbol ? String(raw.symbol) : undefined,
      name: raw.name ? String(raw.name) : undefined,
      pair,
      side,
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
  let latest: FibLevels | null = null;
  const files: string[] = [];
  const common = commonDir();
  if (common && fs.existsSync(common)) {
    try {
      for (const name of fs.readdirSync(common)) {
        if (!/^exnessfxbot-fib/i.test(name) || !name.toLowerCase().endsWith(".json")) continue;
        files.push(path.join(/* turbopackIgnore: true */ common, name));
      }
    } catch {
      files.push(path.join(/* turbopackIgnore: true */ common, "exnessfxbot-fib.json"));
    }
  }
  files.push(path.join(process.cwd(), "data", "fib-levels.json"));

  for (const file of files) {
    const row = readJson(file);
    if (!row) continue;
    if (row.ok !== false && row.pair) {
      const prev = pairs[row.pair];
      if (!prev || Date.parse(row.at) >= Date.parse(prev.at)) pairs[row.pair] = row;
    }
    if (!latest || Date.parse(row.at) >= Date.parse(latest.at)) latest = row;
  }
  return { latest, pairs };
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
