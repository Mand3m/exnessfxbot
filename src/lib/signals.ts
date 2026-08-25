import fs from "fs";
import path from "path";
import { timingSafeEqual, randomBytes } from "crypto";
import { PAIRS, getPair, pipsBetween, type PairId } from "./pairs";
import { fetchLivePrices, fetchMinuteBars, type MinuteBar } from "./quotes";
import { REGULAR_DELAY_MS } from "./constants";
import { eatStamp, formatEatDay } from "./time";
import { listPremiumUsers } from "./auth";
import { sendSignalAlert } from "./mail";
import { enqueueMt5Cancel, enqueueMt5Modify, enqueueMt5Open } from "./mt5";
import { enqueueTelegramSignal, flushTelegramDue } from "./telegram";
import { scheduleLivePush } from "./live-sync";
import { notifyNewSignals } from "./push";
import { isEntered } from "./signal-view";

export type { PairId };
export { REGULAR_DELAY_MS, isEntered };

export type Side = "buy" | "sell";
export type SignalStatus = "active" | "filled" | "cancelled";

export type LevelRevision = {
  stopLoss: number;
  takeProfit: number;
  at: string;
  reason?: string;
};

export type Signal = {
  id: string;
  pair: PairId;
  side: Side;
  status: SignalStatus;
  from: string;
  till: string;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  filledEntry?: number;
  filledExit?: number;
  pips?: number;
  note?: string;
  publishedAt: string;
  updatedAt: string;
  enteredAt?: string;
  levelRevisions?: LevelRevision[];
  levelsUpdatedAt?: string;
  levelsNotice?: boolean;
  levelsReason?: string;
  halfTaken?: boolean;
  halfExit?: number;
  mt5?: {
    status: string;
    message: string;
    ticket?: number;
    at: string;
    commissionUsd?: number;
    commissionNote?: string;
    commissionAt?: string;
  };
};

export type BoardCard = {
  pair: PairId;
  signal: Signal | null;
  pending: boolean;
  liveAt: string | null;
};

export type MonthlyRow = {
  key: string;
  label: string;
  totals: Record<string, number>;
};

export type RecentTrade = {
  id: string;
  pair: PairId;
  label: string;
  pips: number;
  /** Share of planned TP (profit) or SL (loss), −100 to 100. */
  pct: number;
};

export type RecentDay = {
  day: string;
  label: string;
  pairs: Record<string, number>;
  total: number;
  trades: RecentTrade[];
};

export type RecentResults = {
  days: RecentDay[];
  profit: number;
  loss: number;
};

export type PipFill = {
  signalId: string;
  pair: PairId;
  pips: number;
  at: string;
  eatDay: string;
  eatMonth: string;
};

type Store = {
  signals: Signal[];
  monthly: MonthlyRow[];
  pipLedger: PipFill[];
};

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "signals.json");

function ensureStore(): Store {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const seeded = seedStore();
    saveStore(seeded);
    return seeded;
  }
  const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
  data.signals = (data.signals || []).map((s) => {
    const publishedAt = s.publishedAt || s.updatedAt || new Date().toISOString();
    const levelRevisions =
      Array.isArray(s.levelRevisions) && s.levelRevisions.length
        ? s.levelRevisions
        : [{ stopLoss: s.stopLoss, takeProfit: s.takeProfit, at: publishedAt }];
    return { ...s, publishedAt, levelRevisions };
  });
  data.pipLedger = Array.isArray(data.pipLedger) ? data.pipLedger : [];
  if (data.pipLedger.length === 0) {
    data.signals.forEach((s) => {
      if (s.status === "filled" && typeof s.pips === "number") {
        const stamp = eatStamp(new Date(s.updatedAt));
        data.pipLedger.push({
          signalId: s.id,
          pair: s.pair,
          pips: s.pips,
          at: s.updatedAt,
          eatDay: stamp.day,
          eatMonth: stamp.month,
        });
      }
    });
  }
  return data;
}

function saveStore(store: Store, opts?: { sync?: boolean }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let previous: Store["signals"] = [];
  try {
    previous = (JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store).signals || [];
  } catch {
    previous = [];
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  notifyNewSignals(previous, store.signals || []);
  if (opts?.sync !== false) scheduleLivePush(store);
}

export function applyLiveStore(incoming: {
  signals: unknown[];
  monthly: unknown[];
  pipLedger: unknown[];
}) {
  const current = ensureStore();
  const next: Store = {
    signals: (incoming.signals as Store["signals"]) || current.signals,
    monthly: (incoming.monthly as Store["monthly"]) || current.monthly,
    pipLedger: (incoming.pipLedger as Store["pipLedger"]) || current.pipLedger,
  };
  saveStore(next, { sync: false });
  return next.signals.length;
}

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || "exnessfxbot-admin";
}

export function verifyAdminPassword(password: string): boolean {
  const expected = String(getAdminSecret() || "").trim();
  const given = String(password || "").trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isoAt(hoursFromNow: number, minutes = 0): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes, 0, 0);
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

function seedStore(): Store {
  const refs: Record<PairId, number> = {
    USDJPY: 147.32,
    XAUUSD: 3348.6,
    EURUSD: 1.085,
    GBPJPY: 198.45,
  };

  const plan: Array<{
    pair: PairId;
    side: Side;
    status: SignalStatus;
    fromH: number;
    hours: number;
    slPips: number;
    tpPips: number;
    resultPips?: number;
  }> = [
    { pair: "USDJPY", side: "buy", status: "active", fromH: -1, hours: 6, slPips: 28, tpPips: 22 },
    { pair: "XAUUSD", side: "sell", status: "active", fromH: 0, hours: 5, slPips: 35, tpPips: 28 },
    { pair: "EURUSD", side: "buy", status: "filled", fromH: -5, hours: 4, slPips: 25, tpPips: 18, resultPips: 10 },
    { pair: "GBPJPY", side: "sell", status: "cancelled", fromH: -6, hours: 6, slPips: 32, tpPips: 24 },
  ];

  const signals: Signal[] = plan.map((row) => {
    const pair = getPair(row.pair)!;
    const mid = refs[row.pair];
    const dir = row.side === "buy" ? 1 : -1;
    const entry = mid;
    const takeProfit = entry + dir * row.tpPips * pair.pipSize;
    const stopLoss = entry - dir * row.slPips * pair.pipSize;
    const from = isoAt(row.fromH);
    const till = isoAt(row.fromH + row.hours);
    const base: Signal = {
      id: randomBytes(6).toString("hex"),
      pair: row.pair,
      side: row.side,
      status: row.status,
      from,
      till,
      entry: Number(entry.toFixed(pair.digits)),
      takeProfit: Number(takeProfit.toFixed(pair.digits)),
      stopLoss: Number(stopLoss.toFixed(pair.digits)),
      publishedAt: isoAt(-2),
      updatedAt: new Date().toISOString(),
      levelRevisions: [
        { stopLoss: Number(stopLoss.toFixed(pair.digits)), takeProfit: Number(takeProfit.toFixed(pair.digits)), at: isoAt(-2) },
      ],
    };
    if (row.status === "filled" && row.resultPips != null) {
      const exit = entry + dir * row.resultPips * pair.pipSize;
      base.filledEntry = base.entry;
      base.filledExit = Number(exit.toFixed(pair.digits));
      base.pips = row.resultPips;
    }
    return base;
  });

  const ledger: PipFill[] = [];
  signals.forEach((s) => {
    if (s.status === "filled" && typeof s.pips === "number") {
      const stamp = eatStamp(new Date(s.updatedAt));
      ledger.push({
        signalId: s.id,
        pair: s.pair,
        pips: s.pips,
        at: s.updatedAt,
        eatDay: stamp.day,
        eatMonth: stamp.month,
      });
    }
  });
  return { signals, monthly: monthlyFromLedger(ledger), pipLedger: ledger };
}

function versionsFor(pair: PairId, store = ensureStore()): Signal[] {
  return store.signals
    .filter((s) => s.pair === pair)
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.publishedAt || a.updatedAt).getTime();
      const tb = new Date(b.publishedAt || b.updatedAt).getTime();
      return tb - ta;
    });
}

export function listSignals(): Signal[] {
  return listBoard({ premium: true })
    .map((c) => c.signal)
    .filter((s): s is Signal => Boolean(s));
}

function revisionsOf(signal: Signal): LevelRevision[] {
  if (Array.isArray(signal.levelRevisions) && signal.levelRevisions.length) {
    return signal.levelRevisions;
  }
  return [
    {
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      at: signal.publishedAt || signal.updatedAt,
    },
  ];
}

function viewSignal(signal: Signal, premium: boolean): Signal {
  const revs = revisionsOf(signal);
  const cutoff = premium ? Date.now() + 1 : Date.now() - REGULAR_DELAY_MS;
  const visible =
    [...revs].reverse().find((r) => new Date(r.at).getTime() <= cutoff) || revs[0];
  const latest = revs[revs.length - 1];
  const fresh =
    Date.now() - new Date(latest.at).getTime() < 30 * 60 * 1000 && revs.length > 1;
  return {
    ...signal,
    stopLoss: visible.stopLoss,
    takeProfit: visible.takeProfit,
    levelsUpdatedAt: visible.at,
    levelsNotice: Boolean(premium && fresh && visible.at === latest.at),
    levelsReason: latest.reason,
  };
}

export function listActiveSignals(): Signal[] {
  return listBoard({ premium: true })
    .map((c) => c.signal)
    .filter((s): s is Signal => s != null && s.status === "active");
}

export function getSignalById(id: string): Signal | null {
  if (!id) return null;
  return ensureStore().signals.find((s) => s.id === id) || null;
}

export function listBoard(opts: { premium: boolean }): BoardCard[] {
  const store = ensureStore();
  const cutoff = Date.now() - (opts.premium ? 0 : REGULAR_DELAY_MS);
  return PAIRS.map((pair) => {
    const versions = versionsFor(pair.id, store);
    const latest = versions[0] || null;
    const visible =
      versions.find((s) => new Date(s.publishedAt || s.updatedAt).getTime() <= cutoff) ||
      null;
    const pending = Boolean(latest && visible?.id !== latest.id);
    const latestAt = latest
      ? new Date(latest.publishedAt || latest.updatedAt).getTime()
      : 0;
    const waitingForRegulars =
      Boolean(latest) && Date.now() - latestAt < REGULAR_DELAY_MS;
    const liveAt = waitingForRegulars
      ? new Date(latestAt + REGULAR_DELAY_MS).toISOString()
      : pending && latest
        ? new Date(latestAt + REGULAR_DELAY_MS).toISOString()
        : null;
    return {
      pair: pair.id,
      signal: visible ? viewSignal(visible, opts.premium) : null,
      pending: pending || (opts.premium && waitingForRegulars),
      liveAt,
    };
  });
}

export function listMonthly(): MonthlyRow[] {
  const store = ensureStore();
  return monthlyFromLedger(store.pipLedger || []);
}

export function dayPipTotal(pair?: PairId): number {
  const today = eatStamp().day;
  return (ensureStore().pipLedger || [])
    .filter((x) => x.eatDay === today && (!pair || x.pair === pair))
    .reduce((sum, x) => sum + x.pips, 0);
}

export function monthPipTotal(pair?: PairId): number {
  const month = eatStamp().month;
  return (ensureStore().pipLedger || [])
    .filter((x) => x.eatMonth === month && (!pair || x.pair === pair))
    .reduce((sum, x) => sum + x.pips, 0);
}

function eatDayFromIso(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return eatStamp(d).day;
}

function resultPct(signal: Signal | undefined, pips: number): number {
  if (!pips) return 0;
  const pair = signal ? getPair(signal.pair) : undefined;
  if (!signal || !pair) return pips > 0 ? 100 : -100;
  if (pips > 0) {
    const target = pipsBetween(pair, signal.entry, signal.takeProfit);
    if (target <= 0) return 100;
    return Math.max(3, Math.min(100, Math.round((pips / target) * 100)));
  }
  const risk = pipsBetween(pair, signal.entry, signal.stopLoss);
  if (risk <= 0) return -100;
  return -Math.max(3, Math.min(100, Math.round((Math.abs(pips) / risk) * 100)));
}

export function listRecentResults(): RecentResults {
  const store = ensureStore();
  const ledger = store.pipLedger || [];
  const byDay = new Map<string, RecentDay>();
  const byId = new Map((store.signals || []).map((s) => [s.id, s]));
  const emptyPairs = () => {
    const pairs: Record<string, number> = {};
    PAIRS.forEach((p) => {
      pairs[p.id] = 0;
    });
    return pairs;
  };

  const ensureDay = (day: string): RecentDay => {
    let row = byDay.get(day);
    if (!row) {
      row = { day, label: formatEatDay(day), pairs: emptyPairs(), total: 0, trades: [] };
      byDay.set(day, row);
    }
    return row;
  };

  const addTrade = (day: string, pairId: PairId, pips: number, id: string, signal?: Signal) => {
    if (!pips) return;
    const row = ensureDay(day);
    row.pairs[pairId] = (row.pairs[pairId] || 0) + pips;
    row.total += pips;
    const pair = getPair(pairId);
    row.trades.push({
      id,
      pair: pairId,
      label: pair?.label || pairId,
      pips,
      pct: resultPct(signal, pips),
    });
  };

  const seen = new Set<string>();
  ledger.forEach((x, i) => {
    if (x.signalId) seen.add(x.signalId);
    if (!x.eatDay || !x.pair) return;
    const pips = Number(x.pips) || 0;
    addTrade(x.eatDay, x.pair, pips, x.signalId || `ledger-${x.eatDay}-${i}`, byId.get(x.signalId));
  });

  for (const s of store.signals || []) {
    if (s.status !== "filled" || typeof s.pips !== "number") continue;
    if (seen.has(s.id)) continue;
    const day = eatDayFromIso(s.updatedAt) || eatDayFromIso(s.publishedAt);
    if (!day || !s.pair) continue;
    addTrade(day, s.pair, s.pips, s.id, s);
  }

  const selected = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

  let profit = 0;
  let loss = 0;
  selected.forEach((day) => {
    Object.values(day.pairs).forEach((pips) => {
      if (pips > 0) profit += pips;
      else if (pips < 0) loss += pips;
    });
  });
  return { days: selected, profit, loss };
}

function monthlyFromLedger(ledger: PipFill[]): MonthlyRow[] {
  const now = eatStamp();
  const months = new Map<string, Record<string, number>>();
  const empty = () => {
    const totals: Record<string, number> = { ALL: 0 };
    PAIRS.forEach((p) => {
      totals[p.id] = 0;
    });
    return totals;
  };
  months.set(now.month, empty());
  ledger.forEach((row) => {
    if (!months.has(row.eatMonth)) months.set(row.eatMonth, empty());
    const totals = months.get(row.eatMonth)!;
    totals[row.pair] = (totals[row.pair] || 0) + row.pips;
    totals.ALL += row.pips;
  });
  return Array.from(months.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, totals]) => {
      const label =
        key === now.month
          ? "Month-to-date · " + now.monthLabel
          : new Date(key + "-02T00:00:00Z").toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            });
      return { key, label, totals };
    });
}

export function publishSignal(input: {
  pair: PairId;
  side: Side;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  openOnMt5?: boolean;
}): Signal {
  const created = upsertSignal({
    pair: input.pair,
    side: input.side,
    status: "active",
    entry: input.entry,
    takeProfit: input.takeProfit,
    stopLoss: input.stopLoss,
  });
  enqueueMt5Open(created, input.openOnMt5);
  enqueueTelegramSignal(created);
  const snapshot = {
    pair: created.pair,
    side: created.side,
    entry: created.entry,
    takeProfit: created.takeProfit,
    stopLoss: created.stopLoss,
  };
  void Promise.all(
    listPremiumUsers().map((user) => sendSignalAlert(user.email, snapshot).catch(() => null))
  );
  return created;
}

export function upsertSignal(input: Partial<Signal> & { pair: PairId; side: Side }): Signal {
  const store = ensureStore();
  const now = new Date().toISOString();
  const created: Signal = {
    id: randomBytes(6).toString("hex"),
    pair: input.pair,
    side: input.side,
    status: input.status || "active",
    from: input.from || now,
    till: input.till || isoAt(6),
    entry: Number(input.entry || 0),
    takeProfit: Number(input.takeProfit || 0),
    stopLoss: Number(input.stopLoss || 0),
    filledEntry: input.filledEntry,
    filledExit: input.filledExit,
    pips: input.pips,
    note: input.note,
    publishedAt: now,
    updatedAt: now,
    levelRevisions: [
      {
        stopLoss: Number(input.stopLoss || 0),
        takeProfit: Number(input.takeProfit || 0),
        at: now,
      },
    ],
  };
  store.signals.push(created);
  const keepLive = 8;
  const extras = versionsFor(created.pair, store).filter((s) => s.status === "active").slice(keepLive);
  if (extras.length) {
    const drop = new Set(extras.map((s) => s.id));
    store.signals = store.signals.filter((s) => !drop.has(s.id));
  }
  saveStore(store);
  return created;
}

function applyFill(store: Store, row: Signal, exitPrice: number) {
  const pair = getPair(row.pair);
  row.status = "filled";
  const entry = Number(row.filledEntry ?? row.entry);
  row.filledEntry = entry;
  row.filledExit = Number(exitPrice);
  row.updatedAt = new Date().toISOString();
  if (pair) {
    const raw = pipsBetween(pair, entry, exitPrice);
    const dir = row.side === "buy" ? 1 : -1;
    row.pips = dir * Math.sign(Number(exitPrice) - entry) * raw;
  }
  if (typeof row.pips === "number") {
    const stamp = eatStamp(new Date(row.updatedAt));
    if (!store.pipLedger.some((x) => x.signalId === row.id)) {
      store.pipLedger.push({
        signalId: row.id,
        pair: row.pair,
        pips: row.pips,
        at: row.updatedAt,
        eatDay: stamp.day,
        eatMonth: stamp.month,
      });
    }
  }
}

/**
 * SL/TP that were live at `atMs`. A trailed SL (BE / 1R) only applies
 * after it was written — older bars must not count as hitting it.
 */
function slTpAt(row: Signal, atMs: number): { sl: number; tp: number } {
  const revs = revisionsOf(row);
  let sl = revs[0]?.stopLoss ?? row.stopLoss;
  let tp = revs[0]?.takeProfit ?? row.takeProfit;
  for (const rev of revs) {
    if (new Date(rev.at).getTime() < atMs) {
      sl = rev.stopLoss;
      tp = rev.takeProfit;
    }
  }
  return { sl, tp };
}

function priceFeedMatches(row: Signal, price: number): boolean {
  const risk = Math.max(
    Math.abs(row.entry - row.stopLoss),
    Math.abs(row.takeProfit - row.entry),
    0.01
  );
  const lo = Math.min(row.entry, row.stopLoss, row.takeProfit) - 2 * risk;
  const hi = Math.max(row.entry, row.stopLoss, row.takeProfit) + 2 * risk;
  return price >= lo && price <= hi;
}

function barsConfirmEntry(row: Signal, bars: MinuteBar[]): boolean {
  return bars.some((bar) => bar.low <= row.entry && bar.high >= row.entry);
}

/** Live last print only. New SL closes only if price is there now. */
function hitFromLastPrice(
  row: Signal,
  price: number,
  entered: boolean
): "tp" | "sl" | "cancel" | null {
  const slHit = row.side === "buy" ? price <= row.stopLoss : price >= row.stopLoss;
  const tpHit = row.side === "buy" ? price >= row.takeProfit : price <= row.takeProfit;
  if (!entered) {
    if (tpHit) return "cancel";
    return null;
  }
  if (tpHit) return "tp";
  if (slHit) return "sl";
  return null;
}

function firstHitFromBars(row: Signal, bars: MinuteBar[]): "tp" | "sl" | "cancel" | null {
  let entered = false;
  for (const bar of bars) {
    const { sl, tp } = slTpAt(row, bar.t);
    const tradedEntry = bar.low <= row.entry && bar.high >= row.entry;
    const slHit = row.side === "buy" ? bar.low <= sl : bar.high >= sl;
    const tpHit = row.side === "buy" ? bar.high >= tp : bar.low <= tp;

    if (!entered) {
      if (tpHit && !tradedEntry) return "cancel";
      if (!tradedEntry) continue;
      entered = true;
    }
    if (slHit) return "sl";
    if (tpHit) return "tp";
  }
  return null;
}

/** Mark live orders filled, or cancelled if TP prints before entry. */
export async function settleLiveOrders(): Promise<number> {
  await flushTelegramDue().catch(() => []);
  const store = ensureStore();
  if (!store.pipLedger) store.pipLedger = [];
  const prices = await fetchLivePrices();
  let changed = 0;
  for (const pair of PAIRS) {
    const latest = versionsFor(pair.id, store)[0];
    if (!latest || latest.status !== "active") continue;
    const since = new Date(latest.publishedAt || latest.from).getTime();
    const bars = await fetchMinuteBars(pair.id, since);
    if (!latest.enteredAt && barsConfirmEntry(latest, bars)) {
      latest.enteredAt = new Date().toISOString();
      latest.updatedAt = latest.enteredAt;
      changed += 1;
    }
    const hit = firstHitFromBars(latest, bars);
    if (hit === "cancel") {
      latest.status = "cancelled";
      latest.updatedAt = new Date().toISOString();
      latest.note = "Cancelled: TP was tapped before entry.";
      enqueueMt5Cancel(latest.id);
      changed += 1;
      continue;
    }
    if (hit === "tp" || hit === "sl") {
      applyFill(store, latest, hit === "tp" ? latest.takeProfit : latest.stopLoss);
      enqueueMt5Cancel(latest.id);
      changed += 1;
      continue;
    }
    const price = prices[pair.id];
    if (price != null && priceFeedMatches(latest, price)) {
      const fromLast = hitFromLastPrice(latest, price, barsConfirmEntry(latest, bars));
      if (fromLast === "cancel") {
        latest.status = "cancelled";
        latest.updatedAt = new Date().toISOString();
        latest.note = "Cancelled: TP was tapped before entry.";
        enqueueMt5Cancel(latest.id);
        changed += 1;
      } else if (fromLast === "tp" || fromLast === "sl") {
        applyFill(store, latest, fromLast === "tp" ? latest.takeProfit : latest.stopLoss);
        enqueueMt5Cancel(latest.id);
        changed += 1;
      }
    }
  }
  if (changed) {
    store.monthly = monthlyFromLedger(store.pipLedger);
    saveStore(store);
  }
  return changed;
}

export function reviseLevels(
  id: string,
  stopLoss: number,
  takeProfit: number
): Signal | null {
  const store = ensureStore();
  let row = store.signals.find((s) => s.id === id);
  if (!row) return null;
  const latest = versionsFor(row.pair, store)[0];
  if (latest) row = latest;
  if (row.status !== "active") return null;
  if (![stopLoss, takeProfit].every((n) => Number.isFinite(n) && n > 0)) return null;
  const now = new Date().toISOString();
  const revs = revisionsOf(row);
  revs.push({ stopLoss, takeProfit, at: now });
  row.levelRevisions = revs;
  row.stopLoss = stopLoss;
  row.takeProfit = takeProfit;
  row.updatedAt = now;
  saveStore(store);
  enqueueMt5Modify(row);
  return row;
}

export function resolveSignal(
  id: string,
  status: "filled" | "cancelled",
  filledExit?: number,
  note?: string
): Signal | null {
  const store = ensureStore();
  let row = store.signals.find((s) => s.id === id);
  if (!row) return null;
  const latest = versionsFor(row.pair, store)[0];
  if (latest) row = latest;
  if (row.status !== "active") return row;
  const pending = !isEntered(row);
  if (status === "cancelled" && !pending) {
    applyFill(store, row, filledExit ?? row.entry);
    row.note = note || "Filled at market.";
    store.monthly = monthlyFromLedger(store.pipLedger);
    enqueueMt5Cancel(row.id);
    saveStore(store);
    return row;
  }
  if (status === "filled") {
    applyFill(store, row, filledExit ?? row.takeProfit);
    store.monthly = monthlyFromLedger(store.pipLedger);
  } else {
    row.status = "cancelled";
    row.updatedAt = new Date().toISOString();
    row.note = note || "Cancelled";
    enqueueMt5Cancel(row.id);
  }
  saveStore(store);
  return row;
}

export function deleteSignal(id: string): boolean {
  const store = ensureStore();
  const next = store.signals.filter((s) => s.id !== id);
  if (next.length === store.signals.length) return false;
  store.signals = next;
  saveStore(store);
  enqueueMt5Cancel(id);
  return true;
}

export function resetDemo(): Store {
  const seeded = seedStore();
  saveStore(seeded);
  return seeded;
}
