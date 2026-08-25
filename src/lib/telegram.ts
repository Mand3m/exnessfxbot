import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { REGULAR_DELAY_MS } from "./constants";
import { formatPrice, getPair } from "./pairs";

export const TELEGRAM_CHANNEL = process.env.TELEGRAM_CHANNEL || "@TradeBossFx";
export const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001").replace(
  /\/$/,
  ""
);

export type TelegramJob = {
  id: string;
  signalId: string;
  pair: string;
  side: string;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  till: string;
  dueAt: string;
  revealAt: string;
  status: "queued" | "sending" | "sent" | "revealed" | "skipped" | "error";
  createdAt: string;
  message?: string;
  telegramId?: number;
  postedAs?: "photo" | "text";
};

type QueueFile = { jobs: TelegramJob[] };

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const QUEUE_PATH = path.join(DATA_DIR, "telegram-queue.json");
const PID_PATH = path.join(DATA_DIR, "telegram-poster.pid");
const LOG_PATH = path.join(DATA_DIR, "telegram-poster.log");
const SIGNALS_PATH = path.join(DATA_DIR, "signals.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadQueue(): QueueFile {
  try {
    if (!fs.existsSync(QUEUE_PATH)) return { jobs: [] };
    const raw = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8")) as QueueFile;
    return { jobs: Array.isArray(raw.jobs) ? raw.jobs : [] };
  } catch {
    return { jobs: [] };
  }
}

function saveQueue(queue: QueueFile) {
  ensureDir();
  const tmp = QUEUE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ jobs: queue.jobs.slice(-80) }, null, 2));
  fs.renameSync(tmp, QUEUE_PATH);
}

function signalStatus(id: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(SIGNALS_PATH, "utf8")) as {
      signals?: Array<{ id: string; status?: string }>;
    };
    return raw.signals?.find((s) => s.id === id)?.status || null;
  } catch {
    return null;
  }
}

export function signalCardUrl(signalId: string) {
  return `${SITE_URL}/signal/${signalId}`;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function levelText(real: string, hidden: boolean) {
  if (hidden) return `<tg-spoiler>${escapeHtml("••••••")}</tg-spoiler>`;
  return escapeHtml(real);
}

export function formatTelegramSignal(
  job: {
    id?: string;
    signalId?: string;
    pair: string;
    side: string;
    entry?: number;
    takeProfit?: number;
    stopLoss?: number;
    createdAt?: string;
  },
  hidden = true
) {
  const pair = getPair(job.pair);
  const label = pair?.label || job.pair;
  const when = new Date(job.createdAt || Date.now()).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Nairobi",
  });
  const url = signalCardUrl(String(job.signalId || job.id || ""));
  const side = job.side === "sell" ? "Sell" : "Buy";
  const entry = pair && job.entry != null ? formatPrice(pair, job.entry) : String(job.entry ?? "");
  const tp = pair && job.takeProfit != null ? formatPrice(pair, job.takeProfit) : String(job.takeProfit ?? "");
  const sl = pair && job.stopLoss != null ? formatPrice(pair, job.stopLoss) : String(job.stopLoss ?? "");
  return [
    `${escapeHtml(label)} Forex signal`,
    `${escapeHtml(when)} EAT`,
    "",
    levelText(side, hidden),
    `Entry: ${levelText(entry, hidden)}`,
    `Take profit: ${levelText(tp, hidden)}`,
    `Stop loss: ${levelText(sl, hidden)}`,
    "",
    escapeHtml(url),
    `WhatsApp: <a href="https://chat.whatsapp.com/JKk0CCbrjayKEFbNAGoEor">chat.whatsapp.com/JKk0CCbrjayKEFbNAGoEor</a>`,
    `Facebook: <a href="https://www.facebook.com/profile.php?id=61557381370313">facebook.com/profile.php?id=61557381370313</a>`,
  ].join("\n");
}

function pairCardPath(pair: string) {
  return path.join(process.cwd(), "public", "og", `${pair}.png`);
}

async function sendTelegram(
  text: string,
  pair?: string
): Promise<{ ok: boolean; id?: number; error?: string; postedAs?: "photo" | "text" }> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const channel = TELEGRAM_CHANNEL;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set" };

  const image = pair ? pairCardPath(pair) : "";
  if (image && fs.existsSync(image)) {
    const form = new FormData();
    form.append("chat_id", channel);
    form.append("caption", text);
    form.append("parse_mode", "HTML");
    form.append(
      "photo",
      new Blob([new Uint8Array(fs.readFileSync(image))], { type: "image/png" }),
      `${pair}.png`
    );
    const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
    });
    const photoJson = (await photoRes.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (photoJson.ok) return { ok: true, id: photoJson.result?.message_id, postedAs: "photo" };
    if (!photoJson.description) {
      return { ok: false, error: `HTTP ${photoRes.status}` };
    }
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: channel,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!json.ok) return { ok: false, error: json.description || `HTTP ${res.status}` };
  return { ok: true, id: json.result?.message_id, postedAs: "text" };
}

async function editTelegram(job: TelegramJob, caption: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token || !job.telegramId) return { ok: false, error: "missing telegram id" };
  const asText = job.postedAs === "text";
  const res = await fetch(
    `https://api.telegram.org/bot${token}/${asText ? "editMessageText" : "editMessageCaption"}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        asText
          ? {
              chat_id: TELEGRAM_CHANNEL,
              message_id: job.telegramId,
              text: caption,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }
          : {
              chat_id: TELEGRAM_CHANNEL,
              message_id: job.telegramId,
              caption,
              parse_mode: "HTML",
            }
      ),
    }
  );
  const json = (await res.json()) as { ok?: boolean; description?: string };
  if (!json.ok) return { ok: false, error: json.description || `HTTP ${res.status}` };
  return { ok: true };
}

function pidAlive(pid: number) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function telegramPosterRunning() {
  try {
    if (!fs.existsSync(PID_PATH)) return false;
    return pidAlive(Number(fs.readFileSync(PID_PATH, "utf8")));
  } catch {
    return false;
  }
}

export function ensureTelegramPoster() {
  if (process.env.VERCEL) return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  if (telegramPosterRunning()) return;
  try {
    ensureDir();
    const script = path.join(process.cwd(), "scripts", "telegram_poster.py");
    const log = fs.openSync(LOG_PATH, "a");
    const child = spawn("python", ["-u", script], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", log, log],
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    child.unref();
    if (child.pid) fs.writeFileSync(PID_PATH, String(child.pid));
  } catch (err) {
    console.error("Could not start Telegram poster", err);
  }
}

export function enqueueTelegramSignal(signal: {
  id: string;
  pair: string;
  side: string;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  till: string;
}) {
  const queue = loadQueue();
  const existing = queue.jobs.find(
    (j) =>
      j.signalId === signal.id &&
      (j.status === "queued" || j.status === "sending" || j.status === "sent" || j.status === "revealed")
  );
  if (existing) {
    ensureTelegramPoster();
    return existing;
  }
  const now = new Date();
  const job: TelegramJob = {
    id: randomBytes(4).toString("hex"),
    signalId: signal.id,
    pair: signal.pair,
    side: signal.side,
    entry: signal.entry,
    takeProfit: signal.takeProfit,
    stopLoss: signal.stopLoss,
    till: signal.till,
    dueAt: now.toISOString(),
    revealAt: new Date(now.getTime() + REGULAR_DELAY_MS).toISOString(),
    status: "queued",
    createdAt: now.toISOString(),
  };
  queue.jobs.push(job);
  saveQueue(queue);
  ensureTelegramPoster();
  return job;
}

export async function flushTelegramDue() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return [];
  ensureTelegramPoster();
  const queue = loadQueue();
  const now = Date.now();
  const changed: TelegramJob[] = [];

  // Local Windows uses the Python poster for first send. Node only reveals.
  if (process.env.VERCEL) {
    const due = queue.jobs.filter((j) => j.status === "queued" && Date.parse(j.dueAt) <= now);
    for (const job of due) job.status = "sending";
    if (due.length) saveQueue(queue);
    for (const job of due) {
      const status = signalStatus(job.signalId);
      if (status === "cancelled") {
        job.status = "skipped";
        job.message = "signal cancelled before the free-channel delay";
        changed.push(job);
        continue;
      }
      const sent = await sendTelegram(formatTelegramSignal(job, true), job.pair);
      if (sent.ok) {
        job.status = "sent";
        job.telegramId = sent.id;
        job.postedAs = sent.postedAs;
        job.message = `posted to ${TELEGRAM_CHANNEL}`;
      } else {
        job.status = "error";
        job.message = sent.error;
      }
      changed.push(job);
    }
  }

  const reveals = queue.jobs.filter(
    (j) =>
      j.status === "sent" &&
      j.telegramId &&
      j.revealAt &&
      Date.parse(j.revealAt) <= now
  );
  for (const job of reveals) {
    const opened = await editTelegram(job, formatTelegramSignal(job, false));
    if (opened.ok) {
      job.status = "revealed";
      job.message = `opened on ${TELEGRAM_CHANNEL}`;
    } else {
      job.message = opened.error;
    }
    changed.push(job);
  }

  if (changed.length) saveQueue(queue);
  return changed;
}

export function publicTelegramState() {
  const jobs = loadQueue().jobs;
  return {
    channel: TELEGRAM_CHANNEL,
    tokenSet: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    posterRunning: telegramPosterRunning(),
    queued: jobs.filter((j) => j.status === "queued").length,
    jobs: jobs.slice(-8).reverse(),
  };
}
