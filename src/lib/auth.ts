import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

export type Plan = "regular" | "premium";

export type User = {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  passwordHash: string;
  createdAt: string;
  emailVerified?: boolean;
  verifyToken?: string | null;
  verifyTokenExp?: number | null;
  resetToken?: string | null;
  resetTokenExp?: number | null;
  premiumUntil?: string | null;
};

type UserStore = { users: User[] };

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "users.json");
export const SESSION_COOKIE = "exnessfx_session";
const COOKIE = SESSION_COOKIE;

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_SECRET || "exnessfxbot-session";
}

function ensureUsers(): UserStore {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const empty: UserStore = { users: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as UserStore;
}

function saveUsers(store: UserStore) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function hashPassword(password: string, salt?: string) {
  const useSalt = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(password, useSalt, 32).toString("hex");
  return `${useSalt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function signSession(userId: string) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSessionToken(token?: string | null): { uid: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid: string;
      exp: number;
    };
    if (!data.uid || data.exp < Date.now()) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

export function isEmailVerified(user: User) {
  return user.emailVerified !== false;
}

export function effectivePlan(user: User): Plan {
  if (user.plan !== "premium") return "regular";
  if (user.premiumUntil && Date.parse(user.premiumUntil) < Date.now()) return "regular";
  return "premium";
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: effectivePlan(user),
    emailVerified: isEmailVerified(user),
    premiumUntil: user.premiumUntil || null,
  };
}

export function findUserByEmail(email: string) {
  return ensureUsers().users.find((u) => u.email === email.trim().toLowerCase()) || null;
}

export function findUserById(id: string) {
  return ensureUsers().users.find((u) => u.id === id) || null;
}

export function registerUser(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a name and a valid email." };
  }
  if (password.length < 6) {
    return { ok: false as const, error: "Password must be at least 6 characters." };
  }
  const store = ensureUsers();
  if (store.users.some((u) => u.email === email)) {
    return { ok: false as const, error: "That email already has an account." };
  }
  const user: User = {
    id: randomBytes(8).toString("hex"),
    email,
    name,
    plan: "regular",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    emailVerified: false,
    verifyToken: randomBytes(24).toString("hex"),
    verifyTokenExp: Date.now() + 24 * 60 * 60 * 1000,
  };
  store.users.push(user);
  saveUsers(store);
  return { ok: true as const, user };
}

export function issueVerifyToken(email: string) {
  const store = ensureUsers();
  const user = store.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) return { ok: false as const, error: "No account with that email." };
  if (isEmailVerified(user)) return { ok: false as const, error: "That email is already verified." };
  user.verifyToken = randomBytes(24).toString("hex");
  user.verifyTokenExp = Date.now() + 24 * 60 * 60 * 1000;
  saveUsers(store);
  return { ok: true as const, user };
}

export function verifyEmailToken(token: string) {
  const store = ensureUsers();
  const user = store.users.find((u) => u.verifyToken && u.verifyToken === token);
  if (!user) return { ok: false as const, error: "This verification link is not valid." };
  if (user.verifyTokenExp && user.verifyTokenExp < Date.now()) {
    return { ok: false as const, error: "This verification link has expired. Request a new one." };
  }
  user.emailVerified = true;
  user.verifyToken = null;
  user.verifyTokenExp = null;
  saveUsers(store);
  return { ok: true as const, user };
}

export function issueResetToken(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false as const, error: "Enter a valid email." };
  }
  const store = ensureUsers();
  const user = store.users.find((u) => u.email === trimmed);
  if (!user) return { ok: true as const, user: null };
  user.resetToken = randomBytes(24).toString("hex");
  user.resetTokenExp = Date.now() + 24 * 60 * 60 * 1000;
  saveUsers(store);
  return { ok: true as const, user };
}

export function peekResetToken(token: string) {
  if (!token) return { ok: false as const, error: "This reset link is not valid." };
  const user = ensureUsers().users.find((u) => u.resetToken && u.resetToken === token);
  if (!user) return { ok: false as const, error: "This reset link is not valid." };
  if (user.resetTokenExp && user.resetTokenExp < Date.now()) {
    return { ok: false as const, error: "This reset link has expired. Request a new one." };
  }
  return { ok: true as const };
}

export function resetPasswordWithToken(token: string, password: string) {
  if (password.length < 6) {
    return { ok: false as const, error: "Password must be at least 6 characters." };
  }
  const store = ensureUsers();
  const user = store.users.find((u) => u.resetToken && u.resetToken === token);
  if (!user) return { ok: false as const, error: "This reset link is not valid." };
  if (user.resetTokenExp && user.resetTokenExp < Date.now()) {
    return { ok: false as const, error: "This reset link has expired. Request a new one." };
  }
  user.passwordHash = hashPassword(password);
  user.resetToken = null;
  user.resetTokenExp = null;
  user.emailVerified = true;
  saveUsers(store);
  return { ok: true as const };
}

export function loginUser(email: string, password: string) {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Email or password is wrong." };
  }
  if (!isEmailVerified(user)) {
    return {
      ok: false as const,
      error: "Verify your email first. Check your inbox for the link.",
      needsVerify: true as const,
    };
  }
  return { ok: true as const, user, token: signSession(user.id) };
}

export async function getSession() {
  const jar = await cookies();
  const parsed = readSessionToken(jar.get(COOKIE)?.value);
  if (!parsed) return null;
  const user = findUserById(parsed.uid);
  return user ? publicUser(user) : null;
}

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    ...SESSION_COOKIE_OPTS,
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    ...SESSION_COOKIE_OPTS,
    maxAge: 0,
    expires: new Date(0),
  });
}

export function listUsers() {
  return ensureUsers().users.map(publicUser);
}

export function setUserPlan(id: string, plan: Plan) {
  const store = ensureUsers();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;
  user.plan = plan;
  if (plan === "regular") user.premiumUntil = null;
  saveUsers(store);
  return publicUser(user);
}

export function grantPremium(id: string, days: number) {
  const store = ensureUsers();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;
  const extra = Math.max(1, Math.round(days)) * 24 * 60 * 60 * 1000;
  const base = Math.max(Date.now(), Date.parse(user.premiumUntil || "") || 0);
  user.plan = "premium";
  user.premiumUntil = new Date(base + extra).toISOString();
  saveUsers(store);
  return publicUser(user);
}

export function listPremiumUsers() {
  return ensureUsers()
    .users.filter((u) => effectivePlan(u) === "premium" && isEmailVerified(u))
    .map(publicUser);
}
