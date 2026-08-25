import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { randomBytes } from "crypto";
import { DEFAULT_RISK_PCT, RISK_TIERS } from "./calc";
import type { PairId, Side, Signal } from "./signals";

const EXECUTOR_STALE_MS = 25_000;
const JOB_WAIT_MS = 20_000;

export const MT5_MAX_ACCOUNTS = 5;

export type Mt5Account = {
  id: string;
  label: string;
  enabled: boolean;
  login: string;
  server: string;
  password: string;
  riskPct: number;
  deviation: number;
  magic: number;
  symbolSuffix: string;
  terminalPath: string;
};

export type Mt5Job = {
  id: string;
  action: "open" | "cancel" | "modify";
  accountId: string;
  signalId: string;
  pair: PairId;
  side: Side;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  lot: number;
  riskPct?: number;
  createdAt: string;
  status: "queued" | "sent" | "error" | "skipped";
  ticket?: number;
  message?: string;
  doneAt?: string;
};

export type Mt5AccountStatus = {
  id: string;
  label?: string;
  ok: boolean;
  connected: boolean;
  login?: number;
  server?: string;
  name?: string;
  balance?: number;
  equity?: number;
  message: string;
};

export type Mt5Status = {
  ok: boolean;
  connected: boolean;
  updatedAt: string;
  login?: number;
  server?: string;
  name?: string;
  balance?: number;
  equity?: number;
  message: string;
  accounts?: Mt5AccountStatus[];
};

type QueueFile = { jobs: Mt5Job[] };
type StoreFile = { accounts: Mt5Account[] };

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");

const CONFIG_PATH = path.join(DATA_DIR, "mt5.json");
const QUEUE_PATH = path.join(DATA_DIR, "mt5-queue.json");
const STATUS_PATH = path.join(DATA_DIR, "mt5-status.json");
const PNL_PATH = path.join(DATA_DIR, "mt5-pnl.json");
const PID_PATH = path.join(DATA_DIR, "mt5-executor.pid");
const EXEC_LOG = path.join(DATA_DIR, "mt5-executor.log");

const DEFAULT_ACCOUNT: Omit<Mt5Account, "id"> = {
  label: "Account 1",
  enabled: false,
  login: "",
  server: "",
  password: "",
  riskPct: DEFAULT_RISK_PCT,
  deviation: 20,
  magic: 260818,
  symbolSuffix: "",
  terminalPath: "",
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeJson(file: string, value: unknown) {
  ensureDir();
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function newId() {
  return randomBytes(4).toString("hex");
}

const RISK_VALUES = new Set<number>(RISK_TIERS.map((t) => t.pct));

function normalizeRiskPct(value: unknown) {
  const n = Number(value);
  if (RISK_VALUES.has(n)) return n;
  return DEFAULT_RISK_PCT;
}

function normalizeAccount(raw: Partial<Mt5Account>, index: number): Mt5Account {
  return {
    id: String(raw.id || newId()),
    label: String(raw.label || `Account ${index + 1}`).trim() || `Account ${index + 1}`,
    enabled: Boolean(raw.enabled),
    login: String(raw.login || "").trim(),
    server: String(raw.server || "").trim(),
    password: String(raw.password || ""),
    riskPct: normalizeRiskPct(raw.riskPct),
    deviation: Number(raw.deviation) > 0 ? Number(raw.deviation) : DEFAULT_ACCOUNT.deviation,
    magic: Number(raw.magic) > 0 ? Number(raw.magic) : DEFAULT_ACCOUNT.magic + index,
    symbolSuffix: String(raw.symbolSuffix || "").trim(),
    terminalPath: String(raw.terminalPath || "").trim(),
  };
}

export function emptyMt5Account(index = 0): Mt5Account {
  return normalizeAccount({ ...DEFAULT_ACCOUNT, label: `Account ${index + 1}` }, index);
}

export function loadMt5Accounts(): Mt5Account[] {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as StoreFile & Partial<Mt5Account>;
    if (Array.isArray(raw.accounts)) {
      return raw.accounts.slice(0, MT5_MAX_ACCOUNTS).map((row, i) => normalizeAccount(row, i));
    }
    if (raw.login || raw.server || raw.enabled) {
      return [normalizeAccount(raw, 0)];
    }
    return [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: Mt5Account[]) {
  writeJson(CONFIG_PATH, { accounts: accounts.slice(0, MT5_MAX_ACCOUNTS) });
}

export function enabledMt5Accounts() {
  return loadMt5Accounts().filter((a) => a.enabled);
}

export function loadMt5Config(): Mt5Account {
  return loadMt5Accounts()[0] || emptyMt5Account(0);
}

export function saveMt5Account(input: Partial<Mt5Account> & { password?: string }): Mt5Account {
  const accounts = loadMt5Accounts();
  const existing = input.id ? accounts.find((a) => a.id === input.id) : undefined;
  if (!existing && accounts.length >= MT5_MAX_ACCOUNTS) {
    throw new Error(`You can link at most ${MT5_MAX_ACCOUNTS} MT5 accounts.`);
  }
  const index = existing ? accounts.findIndex((a) => a.id === existing.id) : accounts.length;
  const merged = normalizeAccount(
    {
      ...(existing || emptyMt5Account(index)),
      ...input,
      password:
        input.password === undefined || input.password === ""
          ? existing?.password || ""
          : String(input.password),
    },
    index
  );
  if (existing) accounts[index] = merged;
  else accounts.push(merged);
  saveAccounts(accounts);
  return merged;
}

/** @deprecated single-account helper — writes slot 0 */
export function saveMt5Config(input: Partial<Mt5Account>): Mt5Account {
  const first = loadMt5Accounts()[0];
  return saveMt5Account({ ...(first || {}), ...input, id: first?.id });
}

export function deleteMt5Account(id: string): boolean {
  const accounts = loadMt5Accounts();
  const next = accounts.filter((a) => a.id !== id);
  if (next.length === accounts.length) return false;
  saveAccounts(next);
  return true;
}

export function publicMt5Account(account: Mt5Account) {
  return {
    ...account,
    password: account.password ? "********" : "",
    hasPassword: Boolean(account.password),
    linked: Boolean(account.login && account.server),
  };
}

export function loadMt5Queue(): QueueFile {
  try {
    if (!fs.existsSync(QUEUE_PATH)) return { jobs: [] };
    const data = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8")) as QueueFile;
    return { jobs: Array.isArray(data.jobs) ? data.jobs : [] };
  } catch {
    return { jobs: [] };
  }
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

function readExecutorPid() {
  try {
    if (!fs.existsSync(PID_PATH)) return 0;
    return Number(fs.readFileSync(PID_PATH, "utf8"));
  } catch {
    return 0;
  }
}

export function mt5ExecutorRunning() {
  return pidAlive(readExecutorPid());
}

function executorHeartbeatStale() {
  const status = loadMt5Status();
  if (!status?.updatedAt) return true;
  const at = Date.parse(status.updatedAt);
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > EXECUTOR_STALE_MS;
}

function killExecutorPid(pid: number) {
  if (!pid) return;
  try {
    process.kill(pid);
  } catch {
    // already gone
  }
  try {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch {
    // taskkill is Windows-only; ignore elsewhere
  }
}

function touchExecutorStatus(message: string, pid?: number) {
  const prev = loadMt5Status() || {
    ok: false,
    connected: false,
    message,
    updatedAt: new Date().toISOString(),
  };
  writeJson(STATUS_PATH, {
    ...prev,
    updatedAt: new Date().toISOString(),
    message,
    pid: pid || readExecutorPid() || undefined,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Start the MT5 worker if it is not already running. Restarts a hung copy when jobs are waiting. */
export function ensureMt5Executor(opts?: { restartIfStale?: boolean }) {
  if (process.env.VERCEL) return;
  if (!enabledMt5Accounts().length) return;
  const queued = loadMt5Queue().jobs.some((job) => job.status === "queued");
  const running = mt5ExecutorRunning();
  const stale = executorHeartbeatStale();
  if (running && !(opts?.restartIfStale !== false && queued && stale)) return;
  if (running) {
    killExecutorPid(readExecutorPid());
  }
  try {
    ensureDir();
    const script = path.join(process.cwd(), "scripts", "mt5_executor.py");
    const log = fs.openSync(EXEC_LOG, "a");
    const child = spawn("python", ["-u", script], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", log, log],
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    child.unref();
    if (child.pid) {
      fs.writeFileSync(PID_PATH, String(child.pid));
      touchExecutorStatus("Starting MT5 executor", child.pid);
    }
  } catch (err) {
    console.error("Could not start MT5 executor", err);
  }
}

export async function waitForMt5Jobs(jobIds: string[], timeoutMs = JOB_WAIT_MS): Promise<Mt5Job[]> {
  if (!jobIds.length) return [];
  const wanted = new Set(jobIds);
  const deadline = Date.now() + timeoutMs;
  let last: Mt5Job[] = [];
  while (Date.now() < deadline) {
    last = loadMt5Queue().jobs.filter((job) => wanted.has(job.id));
    if (last.length && last.every((job) => job.status !== "queued")) return last;
    ensureMt5Executor({ restartIfStale: true });
    await sleep(250);
  }
  last = loadMt5Queue().jobs.filter((job) => wanted.has(job.id));
  if (last.some((job) => job.status === "queued")) {
    ensureMt5Executor({ restartIfStale: true });
  }
  return last;
}

export function lastMt5JobForSignal(signalId: string): Mt5Job | null {
  const jobs = loadMt5Queue().jobs.filter((job) => job.signalId === signalId);
  return jobs.length ? jobs[jobs.length - 1] : null;
}

function saveMt5Queue(queue: QueueFile) {
  const jobs = queue.jobs.slice(-120);
  writeJson(QUEUE_PATH, { jobs });
  copyQueueToTerminal(jobs);
}

function copyQueueToTerminal(jobs: Mt5Job[]) {
  const appdata = process.env.APPDATA;
  if (!appdata) return;
  const common = path.join(appdata, "MetaQuotes", "Terminal", "Common", "Files");
  try {
    fs.mkdirSync(common, { recursive: true });
    const dest = path.join(common, "exnessfxbot-queue.json");
    const tmp = dest + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ jobs }, null, 2));
    fs.renameSync(tmp, dest);
  } catch {
    // Terminal Common folder is optional.
  }
}

export type Mt5PnlRow = {
  usd: number;
  closed: boolean;
  floating?: boolean;
  at?: string;
};

export type Mt5Pnl = {
  updatedAt: string;
  accountId: string;
  login?: number;
  currency?: string;
  rateNote?: string;
  openUsd: number;
  weekUsd: number;
  monthUsd: number;
  yearUsd: number;
  tickets: Record<string, Mt5PnlRow>;
  signals: Record<string, Mt5PnlRow>;
};

export function loadMt5Pnl(): Mt5Pnl | null {
  try {
    if (!fs.existsSync(PNL_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(PNL_PATH, "utf8")) as Mt5Pnl;
    if (!raw || typeof raw !== "object") return null;
    return {
      ...raw,
      tickets: raw.tickets || {},
      signals: raw.signals || {},
      weekUsd: Number(raw.weekUsd) || 0,
      monthUsd: Number(raw.monthUsd) || 0,
      yearUsd: Number(raw.yearUsd) || 0,
      openUsd: Number(raw.openUsd) || 0,
    };
  } catch {
    return null;
  }
}

function jobPnlUsd(job: Mt5Job, pnl: Mt5Pnl | null): number | null {
  if (!pnl) return null;
  if (job.accountId && pnl.accountId && job.accountId !== pnl.accountId) return null;
  if (job.ticket && pnl.tickets[String(job.ticket)]) return pnl.tickets[String(job.ticket)].usd;
  const sig = pnl.signals[job.signalId] || pnl.signals[job.signalId.slice(0, 12)];
  if (sig) return sig.usd;
  return null;
}

export function loadMt5Status(): Mt5Status | null {
  try {
    if (!fs.existsSync(STATUS_PATH)) return null;
    return JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as Mt5Status;
  } catch {
    return null;
  }
}

export function publicMt5State() {
  const accounts = loadMt5Accounts();
  const publicAccounts = accounts.map(publicMt5Account);
  const linkedCount = publicAccounts.filter((a) => a.linked).length;
  const enabledCount = publicAccounts.filter((a) => a.enabled).length;
  const jobs = loadMt5Queue().jobs;
  if (jobs.some((job) => job.status === "queued")) {
    ensureMt5Executor({ restartIfStale: true });
  }
  const pnl = loadMt5Pnl();
  const masterId = enabledMt5Accounts()[0]?.id;
  return {
    accounts: publicAccounts,
    config: publicAccounts[0] || publicMt5Account(emptyMt5Account(0)),
    status: loadMt5Status(),
    jobs: jobs
      .slice(-8)
      .reverse()
      .map((job) => ({
        ...job,
        pnlUsd: jobPnlUsd(job, pnl),
        pnlMaster: Boolean(masterId && job.accountId === masterId),
      })),
    pnl,
    linkedCount,
    enabledCount,
    maxAccounts: MT5_MAX_ACCOUNTS,
    executorRunning: mt5ExecutorRunning(),
    executorStale: mt5ExecutorRunning() && executorHeartbeatStale(),
  };
}

function pushJobsForAccounts(
  accounts: Mt5Account[],
  build: (account: Mt5Account) => Omit<Mt5Job, "id" | "createdAt" | "status">
): Mt5Job[] {
  if (!accounts.length) return [];
  const queue = loadMt5Queue();
  const created = accounts.map((account) => {
    const job: Mt5Job = {
      ...build(account),
      id: newId(),
      createdAt: new Date().toISOString(),
      status: "queued",
    };
    queue.jobs.push(job);
    return job;
  });
  saveMt5Queue(queue);
  ensureMt5Executor();
  return created;
}

export function enqueueMt5Open(signal: Signal, openOnMt5?: boolean): Mt5Job[] {
  if (openOnMt5 === false) return [];
  return pushJobsForAccounts(enabledMt5Accounts(), (account) => ({
    action: "open",
    accountId: account.id,
    signalId: signal.id,
    pair: signal.pair,
    side: signal.side,
    entry: signal.entry,
    takeProfit: signal.takeProfit,
    stopLoss: signal.stopLoss,
    lot: 0,
    riskPct: account.riskPct,
  }));
}

export function enqueueMt5Cancel(signalId: string): Mt5Job[] {
  if (!signalId) return [];
  return pushJobsForAccounts(enabledMt5Accounts(), (account) => ({
    action: "cancel",
    accountId: account.id,
    signalId,
    pair: "USDJPY",
    side: "buy",
    entry: 0,
    takeProfit: 0,
    stopLoss: 0,
    lot: 0,
  }));
}

export function enqueueMt5Modify(signal: Signal): Mt5Job[] {
  return pushJobsForAccounts(enabledMt5Accounts(), (account) => ({
    action: "modify",
    accountId: account.id,
    signalId: signal.id,
    pair: signal.pair,
    side: signal.side,
    entry: signal.entry,
    takeProfit: signal.takeProfit,
    stopLoss: signal.stopLoss,
    lot: 0,
  }));
}

export function mt5PublishNote(jobs: Mt5Job[] | Mt5Job | null, enabled: boolean | number): string {
  const count = typeof enabled === "number" ? enabled : enabled ? 1 : 0;
  const list = Array.isArray(jobs) ? jobs : jobs ? [jobs] : [];
  if (count <= 0) return "";
  if (!list.length) return " MT5 link is on but this submit skipped the trade.";
  return (
    " " +
    list
      .map((job) => {
        if (job.status === "sent") {
          return `MT5 opened ${job.pair}: ${job.message || "sent"}${job.ticket ? ` (ticket ${job.ticket})` : ""}.`;
        }
        if (job.status === "skipped") {
          return `MT5 did not open ${job.pair}: ${job.message || "skipped"}.`;
        }
        if (job.status === "error") {
          return `MT5 error on ${job.pair}: ${job.message || "order failed"}.`;
        }
        return `MT5 job for ${job.pair} is still queued. Leave MetaTrader open with Algo Trading on.`;
      })
      .join(" ")
  );
}
