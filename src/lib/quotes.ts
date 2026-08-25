import fs from "fs";
import path from "path";
import type { PairId } from "./pairs";

const QUOTES_FILE = path.join(process.cwd(), "data", "mt5-quotes.json");
const MT5_QUOTE_MAX_AGE_MS = 10_000;

function readMt5Quotes(): Partial<Record<PairId, number>> {
  try {
    if (!fs.existsSync(QUOTES_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(QUOTES_FILE, "utf8")) as {
      updatedAt?: string;
      quotes?: Record<string, { mid?: number; bid?: number; ask?: number }>;
    };
    const at = Date.parse(String(raw.updatedAt || ""));
    if (!Number.isFinite(at) || Date.now() - at > MT5_QUOTE_MAX_AGE_MS) return {};
    const out: Partial<Record<PairId, number>> = {};
    for (const [pair, row] of Object.entries(raw.quotes || {})) {
      const mid = Number(row.mid ?? ((Number(row.bid) + Number(row.ask)) / 2));
      if (Number.isFinite(mid) && mid > 0) out[pair as PairId] = mid;
    }
    return out;
  } catch {
    return {};
  }
}

const YAHOO: Record<PairId, string[]> = {
  USDJPY: ["USDJPY=X"],
  GBPJPY: ["GBPJPY=X"],
  // XAUUSD=X is delisted on Yahoo. GC=F is the futures contract and
  // sits tens of dollars away from Exness spot — do not use it here.
  XAUUSD: ["XAUUSD=X"],
  EURUSD: ["EURUSD=X"],
};

export type MinuteBar = { t: number; high: number; low: number; close: number };

const cache = new Map<string, { price: number; at: number }>();
const barCache = new Map<string, { bars: MinuteBar[]; at: number }>();
const CACHE_MS = 4000;

async function goldSpot(): Promise<number | null> {
  const hit = cache.get("XAUUSD");
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.price;
  try {
    const res = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 ExnessfxBot/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number };
    if (typeof data.price === "number" && data.price > 100) {
      cache.set("XAUUSD", { price: data.price, at: Date.now() });
      return data.price;
    }
  } catch {
    // fall through to Yahoo if this host is down
  }
  return null;
}

async function yahooPrice(symbol: string): Promise<number | null> {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(symbol) +
    "?interval=1m&range=1d";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 ExnessfxBot/1.0",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
  };
  const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === "number" && price > 0 ? price : null;
}

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> };
    }>;
  };
};

export async function fetchMinuteBars(pair: PairId, sinceMs: number): Promise<MinuteBar[]> {
  const key = pair + ":" + Math.floor(sinceMs / 60000);
  const hit = barCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.bars;

  for (const symbol of YAHOO[pair]) {
    try {
      const url =
        "https://query1.finance.yahoo.com/v8/finance/chart/" +
        encodeURIComponent(symbol) +
        "?interval=1m&range=1d";
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 ExnessfxBot/1.0",
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as YahooChart;
      const row = data.chart?.result?.[0];
      const ts = row?.timestamp || [];
      const q = row?.indicators?.quote?.[0];
      if (!ts.length || !q) continue;
      const bars: MinuteBar[] = [];
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i] * 1000;
        const high = q.high?.[i];
        const low = q.low?.[i];
        const close = q.close?.[i];
        if (t < sinceMs - 60000) continue;
        if (high == null || low == null || close == null) continue;
        bars.push({ t, high, low, close });
      }
      barCache.set(key, { bars, at: Date.now() });
      return bars;
    } catch {
      // next symbol
    }
  }
  return [];
}

export async function fetchLivePrices(): Promise<Partial<Record<PairId, number>>> {
  const ids = Object.keys(YAHOO) as PairId[];
  const out: Partial<Record<PairId, number>> = { ...readMt5Quotes() };

  await Promise.all(
    ids.map(async (id) => {
      if (out[id] != null) return;
      if (id === "XAUUSD") {
        const spot = await goldSpot();
        if (spot) {
          out[id] = spot;
          return;
        }
      }
      const hit = cache.get(id);
      if (hit && Date.now() - hit.at < CACHE_MS) {
        out[id] = hit.price;
        return;
      }
      for (const symbol of YAHOO[id]) {
        try {
          const price = await yahooPrice(symbol);
          if (price) {
            cache.set(id, { price, at: Date.now() });
            out[id] = price;
            return;
          }
        } catch {
          // try next symbol
        }
      }
    })
  );

  return out;
}
