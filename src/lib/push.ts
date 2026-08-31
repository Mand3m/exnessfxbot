import fs from "fs";
import path from "path";
import { getPair } from "./pairs";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const HEAD_PATH = path.join(DATA_DIR, "push-head.json");
const FRESH_MS = 20 * 60 * 1000;

export type PushHead = {
  id: string;
  pair: string;
  label: string;
  publishedAt: string;
  kind?: "signal" | "manage";
  title?: string;
  body?: string;
};

export function readPushHead(): PushHead | null {
  try {
    const raw = JSON.parse(fs.readFileSync(HEAD_PATH, "utf8")) as PushHead;
    if (!raw?.id) return null;
    return raw;
  } catch {
    return null;
  }
}

function writePushHead(head: PushHead) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HEAD_PATH, JSON.stringify(head, null, 2), "utf8");
}

const MANAGE_HEAD_PATH = path.join(DATA_DIR, "push-manage.json");

export function readManageHead(): PushHead | null {
  try {
    const raw = JSON.parse(fs.readFileSync(MANAGE_HEAD_PATH, "utf8")) as PushHead;
    if (!raw?.id) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeManageHead(head: PushHead) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MANAGE_HEAD_PATH, JSON.stringify(head, null, 2), "utf8");
}

export function notifyNewSignals(
  previous: { id: string; status?: string }[],
  next: { id: string; pair: string; side: string; status?: string; publishedAt?: string }[]
) {
  const prevIds = new Set(previous.map((s) => s.id));
  const cutoff = Date.now() - FRESH_MS;
  const fresh = next.filter((s) => {
    if (s.status && s.status !== "active") return false;
    if (prevIds.has(s.id)) return false;
    const at = Date.parse(s.publishedAt || "");
    return Number.isFinite(at) && at >= cutoff;
  });
  const latest = fresh[fresh.length - 1];
  if (!latest) return;
  const pair = getPair(latest.pair);
  writePushHead({
    id: latest.id,
    pair: latest.pair,
    label: pair?.label || latest.pair,
    publishedAt: latest.publishedAt || new Date().toISOString(),
  });
}
