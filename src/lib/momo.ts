import { randomUUID } from "crypto";

const TOKEN_TTL_MS = 50 * 60 * 1000;

type TokenCache = { token: string; until: number };
let tokenCache: TokenCache | null = null;
let currencyBlockedUntil = 0;

export function momoConfigured(): boolean {
  return Boolean(
    process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY &&
      process.env.MOMO_API_USER &&
      process.env.MOMO_API_KEY
  );
}

/** Sandbox Collections rejects UGX. Skip the prompt until that result expires or the process restarts on production. */
export function momoUgxBlocked(): boolean {
  return Date.now() < currencyBlockedUntil;
}

export function noteMomoCurrencyBlocked() {
  currencyBlockedUntil = Date.now() + 60 * 60 * 1000;
}

export function momoPartyId(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^256\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `256${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `256${digits}`;
  if (/^\d{11,15}$/.test(digits)) return digits;
  return null;
}

export function newMomoReference(): string {
  return randomUUID();
}

export async function requestToPay(input: {
  referenceId: string;
  amount: number;
  partyId: string;
  externalId: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; code: string; error: string }> {
  const token = await accessToken();
  const referenceId = input.referenceId;
  const status = await momoFetch(`/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": targetEnvironment(),
      "X-Reference-Id": referenceId,
      "X-Callback-Url": "https://forextradingconsultants.com/api/payments/momo/callback",
    },
    body: JSON.stringify({
      amount: String(input.amount),
      currency: "UGX",
      externalId: input.externalId,
      payer: { partyIdType: "MSISDN", partyId: input.partyId },
      payerMessage: input.message.slice(0, 140),
      payeeNote: input.message.slice(0, 140),
    }),
  });
  if (status.code === 202) return { ok: true };
  const parsed = parseMomoError(status.body, status.code);
  if (parsed.code === "INVALID_CURRENCY") noteMomoCurrencyBlocked();
  return { ok: false, code: parsed.code, error: parsed.error };
}

export async function collectionStatus(referenceId: string): Promise<string> {
  const token = await accessToken();
  const status = await momoFetch(`/collection/v1_0/requesttopay/${referenceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": targetEnvironment(),
    },
  });
  if (status.code !== 200) {
    const parsed = parseMomoError(status.body, status.code);
    throw new Error(parsed.error);
  }
  const body = JSON.parse(status.body) as { status?: string };
  return body.status || "PENDING";
}

function targetEnvironment(): string {
  return process.env.MOMO_TARGET_ENVIRONMENT || "sandbox";
}

function baseUrl(): string {
  return (process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com").replace(/\/$/, "");
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.until > Date.now()) return tokenCache.token;
  const user = process.env.MOMO_API_USER || "";
  const apiKey = process.env.MOMO_API_KEY || "";
  const basic = Buffer.from(`${user}:${apiKey}`).toString("base64");
  const status = await momoFetch("/collection/token/", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    body: "{}",
  });
  if (status.code !== 200) {
    const parsed = parseMomoError(status.body, status.code);
    throw new Error(parsed.error);
  }
  const body = JSON.parse(status.body) as { access_token?: string };
  if (!body.access_token) throw new Error("MTN did not return an access token.");
  tokenCache = { token: body.access_token, until: Date.now() + TOKEN_TTL_MS };
  return body.access_token;
}

async function momoFetch(
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: string }
): Promise<{ code: number; body: string }> {
  const subscription = process.env.MOMO_COLLECTION_SUBSCRIPTION_KEY || "";
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      "Ocp-Apim-Subscription-Key": subscription,
      "Content-Type": "application/json",
      ...init.headers,
    },
    body: init.body,
    cache: "no-store",
  });
  return { code: response.status, body: await response.text() };
}

function parseMomoError(raw: string, code: number): { code: string; error: string } {
  try {
    const body = JSON.parse(raw) as { code?: string; message?: string };
    return {
      code: body.code || String(code),
      error: body.message || `MTN returned ${code}.`,
    };
  } catch {
    return { code: String(code), error: `MTN returned ${code}.` };
  }
}
