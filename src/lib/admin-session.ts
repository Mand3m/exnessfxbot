import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "exnessfx_desk";

function secret() {
  return process.env.ADMIN_SECRET || "exnessfxbot-admin";
}

function sign() {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ desk: true, exp })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDeskToken(token?: string | null) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      desk?: boolean;
      exp?: number;
    };
    return Boolean(data.desk && data.exp && data.exp > Date.now());
  } catch {
    return false;
  }
}

export async function isDeskUnlocked() {
  const jar = await cookies();
  return verifyDeskToken(jar.get(COOKIE)?.value);
}

export async function unlockDesk() {
  const jar = await cookies();
  jar.set(COOKIE, sign(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function lockDesk() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
