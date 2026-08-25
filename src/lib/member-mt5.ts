import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import fs from "fs";
import path from "path";
import { DEFAULT_RISK_PCT, RISK_TIERS } from "./calc";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "member-mt5.json");

const RISK_VALUES = new Set<number>(RISK_TIERS.map((t) => t.pct));
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_PER_USER_HOUR = 6;
const attempts = new Map<string, number[]>();

type EncBlob = { iv: string; tag: string; data: string };

export type MemberMt5Public = {
  id: string;
  userId: string;
  paymentId: string;
  label: string;
  login: string;
  server: string;
  hasPassword: boolean;
  riskPct: number;
  deviation: number;
  symbolSuffix: string;
  createdAt: string;
};

type MemberMt5Row = {
  id: string;
  userId: string;
  paymentId: string;
  label: string;
  login: string;
  server: string;
  password: EncBlob;
  riskPct: number;
  deviation: number;
  symbolSuffix: string;
  createdAt: string;
};

type TokenRow = {
  paymentId: string;
  userId: string;
  exp: number;
  used: boolean;
  nonce: string;
};

type Store = { records: MemberMt5Row[]; tokens: TokenRow[] };

function vaultSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_SECRET || "exnessfxbot-session";
}

function vaultKey() {
  return createHash("sha256").update("mt5-vault:" + vaultSecret(), "utf8").digest();
}

function load(): Store {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) return { records: [], tokens: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
    return {
      records: Array.isArray(raw.records) ? raw.records : [],
      tokens: Array.isArray(raw.tokens) ? raw.tokens : [],
    };
  } catch {
    return { records: [], tokens: [] };
  }
}

function save(store: Store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE_PATH + ".tmp";
  const payload = JSON.stringify(
    {
      records: store.records.slice(-200),
      tokens: store.tokens.filter((t) => t.exp > Date.now() - 86400000).slice(-200),
    },
    null,
    2
  );
  fs.writeFileSync(tmp, payload, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, STORE_PATH);
  try {
    fs.chmodSync(STORE_PATH, 0o600);
  } catch {
    /* Windows */
  }
}

function encryptSecret(plain: string): EncBlob {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

function toPublic(row: MemberMt5Row): MemberMt5Public {
  return {
    id: row.id,
    userId: row.userId,
    paymentId: row.paymentId,
    label: row.label,
    login: row.login,
    server: row.server,
    hasPassword: Boolean(row.password?.data),
    riskPct: row.riskPct,
    deviation: row.deviation,
    symbolSuffix: row.symbolSuffix,
    createdAt: row.createdAt,
  };
}

export function issueMt5LinkToken(userId: string, paymentId: string): string {
  const store = load();
  const nonce = randomBytes(16).toString("base64url");
  const exp = Date.now() + TOKEN_TTL_MS;
  store.tokens = store.tokens.filter((t) => t.paymentId !== paymentId || t.userId !== userId);
  store.tokens.push({ paymentId, userId, exp, used: false, nonce });
  save(store);
  const payload = Buffer.from(JSON.stringify({ uid: userId, pid: paymentId, exp, n: nonce })).toString(
    "base64url"
  );
  const sig = createHmac("sha256", vaultSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readMt5LinkToken(token: string): { uid: string; pid: string; nonce: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", vaultSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid: string;
      pid: string;
      exp: number;
      n: string;
    };
    if (!data.uid || !data.pid || !data.n || data.exp < Date.now()) return null;
    return { uid: data.uid, pid: data.pid, nonce: data.n };
  } catch {
    return null;
  }
}

export function mt5LinkTokenLive(userId: string, paymentId: string, nonce: string): boolean {
  const row = load().tokens.find(
    (t) => t.userId === userId && t.paymentId === paymentId && t.nonce === nonce
  );
  return Boolean(row && !row.used && row.exp > Date.now());
}

export function consumeMt5LinkToken(userId: string, paymentId: string, nonce: string): boolean {
  const store = load();
  const row = store.tokens.find(
    (t) => t.userId === userId && t.paymentId === paymentId && t.nonce === nonce
  );
  if (!row || row.used || row.exp < Date.now()) return false;
  row.used = true;
  save(store);
  return true;
}

export function allowMt5Attempt(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const prev = (attempts.get(userId) || []).filter((t) => now - t < windowMs);
  if (prev.length >= MAX_PER_USER_HOUR) {
    attempts.set(userId, prev);
    return false;
  }
  prev.push(now);
  attempts.set(userId, prev);
  return true;
}

export function requestSameOrigin(req: Request): boolean {
  const host = req.headers.get("host") || "";
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export function getMemberMt5ForPayment(paymentId: string): MemberMt5Public | null {
  const row = load().records.find((r) => r.paymentId === paymentId);
  return row ? toPublic(row) : null;
}

export function getMemberMt5ForUser(userId: string): MemberMt5Public | null {
  const rows = load().records.filter((r) => r.userId === userId);
  if (!rows.length) return null;
  return toPublic(rows[rows.length - 1]);
}

export function saveMemberMt5(input: {
  userId: string;
  paymentId: string;
  label: string;
  login: string;
  server: string;
  password: string;
  riskPct: unknown;
  deviation: unknown;
  symbolSuffix: string;
}): { ok: true; record: MemberMt5Public } | { ok: false; error: string } {
  const login = String(input.login || "").replace(/\s+/g, "");
  const server = String(input.server || "").trim();
  const password = String(input.password || "");
  const label = String(input.label || "").trim() || "Member account";
  const suffix = String(input.symbolSuffix || "").trim().slice(0, 12);
  const deviation = Math.max(0, Math.min(200, Math.round(Number(input.deviation) || 20)));
  const riskN = Number(input.riskPct);
  const riskPct = RISK_VALUES.has(riskN) ? riskN : DEFAULT_RISK_PCT;

  if (!/^\d{5,12}$/.test(login)) {
    return { ok: false, error: "MT5 login must be 5–12 digits." };
  }
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(server)) {
    return { ok: false, error: "Enter a valid MT5 server name." };
  }
  if (password.length < 6 || password.length > 64) {
    return { ok: false, error: "MT5 password must be 6–64 characters." };
  }
  if (/[\u0000-\u001f]/.test(password)) {
    return { ok: false, error: "Password contains invalid characters." };
  }
  if (label.length > 40) {
    return { ok: false, error: "Label is too long." };
  }

  const store = load();
  const row: MemberMt5Row = {
    id: randomBytes(6).toString("hex"),
    userId: input.userId,
    paymentId: input.paymentId,
    label,
    login,
    server,
    password: encryptSecret(password),
    riskPct,
    deviation,
    symbolSuffix: suffix,
    createdAt: new Date().toISOString(),
  };
  store.records = store.records.filter((r) => r.paymentId !== input.paymentId);
  store.records.push(row);
  save(store);
  return { ok: true, record: toPublic(row) };
}
