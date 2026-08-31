import fs from "fs";
import path from "path";
import { listPremiumUsers } from "./auth";
import { sendTradeManageAlert } from "./mail";
import { liveSyncConfigured } from "./live-sync";
import { formatPrice, getPair, type PairId } from "./pairs";
import { writeManageHead } from "./push";

export type NoticeKind = "be" | "lock1r";

export type TradeNotice = {
  id: string;
  signalId: string;
  pair: PairId;
  side: string;
  kind: NoticeKind;
  title: string;
  body: string;
  at: string;
};

type Store = {
  notices: TradeNotice[];
  reads: Record<string, string>;
};

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "notices.json");
const KEEP = 200;
const MAIL_FRESH_MS = 20 * 60 * 1000;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

function empty(): Store {
  return { notices: [], reads: {} };
}

function load(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
    return {
      notices: Array.isArray(raw.notices) ? raw.notices : [],
      reads: raw.reads && typeof raw.reads === "object" ? raw.reads : {},
    };
  } catch {
    return empty();
  }
}

function save(store: Store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function copyFor(kind: NoticeKind, pairLabel: string, slText: string) {
  if (kind === "be") {
    return {
      title: `${pairLabel}: move stop to break-even`,
      body: `Do this now: move your ${pairLabel} stop loss to entry (break-even). New SL is ${slText}. The card already shows the new stop.`,
      push: `${pairLabel}: move your stop to break-even now. Open the app.`,
    };
  }
  return {
    title: `${pairLabel}: take half off, lock 1R`,
    body: `Do this now: close half of ${pairLabel} at market, then move the remaining stop to 1R. New SL is ${slText}. The card already shows the new stop.`,
    push: `${pairLabel}: close half and lock the rest at 1R. Open the app.`,
  };
}

export function listNotices(): TradeNotice[] {
  return load().notices.slice().sort((a, b) => b.at.localeCompare(a.at));
}

export function unreadCount(userId: string): number {
  const store = load();
  const last = store.reads[userId] || "";
  return store.notices.filter((n) => n.at > last).length;
}

export function markNoticesRead(userId: string) {
  const store = load();
  store.reads[userId] = new Date().toISOString();
  save(store);
}

export function latestManageHead() {
  const latest = listNotices()[0];
  if (!latest) return null;
  const pair = getPair(latest.pair);
  const copy = copyFor(latest.kind, pair?.label || latest.pair, "");
  return {
    id: latest.id,
    pair: latest.pair,
    label: pair?.label || latest.pair,
    publishedAt: latest.at,
    kind: "manage" as const,
    title: latest.title,
    body: copy.push,
  };
}

type SignalLite = {
  id: string;
  pair: PairId;
  side?: string;
  stopLoss?: number;
  levelRevisions?: Array<{ stopLoss: number; takeProfit?: number; at: string; reason?: string }>;
};

export function captureTradeNotices(signals: SignalLite[], opts?: { alert?: boolean }) {
  const alert = opts?.alert ?? !liveSyncConfigured();
  const store = load();
  const known = new Set(store.notices.map((n) => n.id));
  const now = Date.now();
  let added: TradeNotice[] = [];

  for (const signal of signals || []) {
    const pair = getPair(signal.pair);
    const label = pair?.label || signal.pair;
    for (const rev of signal.levelRevisions || []) {
      const kind = rev.reason === "be" || rev.reason === "lock1r" ? rev.reason : null;
      if (!kind) continue;
      const at = rev.at || "";
      const age = now - Date.parse(at);
      if (!Number.isFinite(age) || age > KEEP_MS) continue;
      const id = `${signal.id}:${kind}:${at}`;
      if (known.has(id)) continue;
      const slText = pair ? formatPrice(pair, Number(rev.stopLoss)) : String(rev.stopLoss);
      const copy = copyFor(kind, label, slText);
      const notice: TradeNotice = {
        id,
        signalId: signal.id,
        pair: signal.pair,
        side: signal.side || "",
        kind,
        title: copy.title,
        body: copy.body,
        at,
      };
      store.notices.push(notice);
      known.add(id);
      added.push(notice);
    }
  }

  if (!added.length) return 0;
  store.notices = store.notices
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-KEEP);
  save(store);

  const fresh = added.filter((n) => now - Date.parse(n.at) <= MAIL_FRESH_MS);
  const last = fresh[fresh.length - 1];
  if (last) {
    const pair = getPair(last.pair);
    const copy = copyFor(last.kind, pair?.label || last.pair, "");
    writeManageHead({
      id: last.id,
      pair: last.pair,
      label: pair?.label || last.pair,
      publishedAt: last.at,
      kind: "manage",
      title: last.title,
      body: copy.push,
    });
  }

  if (alert && fresh.length) {
    const users = listPremiumUsers();
    for (const notice of fresh) {
      void Promise.all(
        users.map((user) =>
          sendTradeManageAlert(user.email, {
            title: notice.title,
            body: notice.body,
          }).catch(() => null)
        )
      );
    }
  }
  return added.length;
}
