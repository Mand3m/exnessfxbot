import { createHash, timingSafeEqual } from "crypto";

export function liveSyncSecret() {
  return (process.env.LIVE_SYNC_SECRET || "").trim();
}

export function liveSiteUrl() {
  return (process.env.LIVE_SITE_URL || "").trim().replace(/\/$/, "");
}

export function liveSyncConfigured() {
  return Boolean(liveSiteUrl() && liveSyncSecret());
}

export function verifyLiveSyncSecret(given: string) {
  const expected = liveSyncSecret();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function publicLiveSyncState() {
  const url = liveSiteUrl();
  let host = "";
  try {
    host = url ? new URL(url).host : "";
  } catch {
    host = url;
  }
  return {
    pushEnabled: liveSyncConfigured(),
    target: host,
  };
}

type LiveStore = {
  signals: unknown[];
  monthly: unknown[];
  pipLedger: unknown[];
};

let timer: ReturnType<typeof setTimeout> | null = null;
let lastHash = "";
let pending: LiveStore | null = null;

function storeHash(store: LiveStore) {
  return createHash("sha1").update(JSON.stringify(store)).digest("hex");
}

async function postLive(store: LiveStore) {
  const base = liveSiteUrl();
  const secret = liveSyncSecret();
  if (!base || !secret) return;
  const hash = storeHash(store);
  if (hash === lastHash) return;
  try {
    const res = await fetch(`${base}/api/sync/live`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + secret,
      },
      body: JSON.stringify(store),
    });
    if (res.ok) lastHash = hash;
    else console.error("Live sync failed:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("Live sync error:", err);
  }
}

export function scheduleLivePush(store: LiveStore) {
  if (!liveSyncConfigured()) return;
  pending = {
    signals: store.signals || [],
    monthly: store.monthly || [],
    pipLedger: store.pipLedger || [],
  };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const body = pending;
    pending = null;
    if (body) void postLive(body);
  }, 400);
}
