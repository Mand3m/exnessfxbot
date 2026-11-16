import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

export type Plan = "regular" | "premium";
export type UserRole = "member" | "admin";

export {
  SAMPLE_STUDENT_LOGIN,
  SAMPLE_STUDENT_PASSWORD,
  STAFF_LOGIN,
  STAFF_PASSWORD,
} from "./sample-logins";
import {
  SAMPLE_STUDENT_LOGIN,
  SAMPLE_STUDENT_PASSWORD,
  STAFF_LOGIN,
  STAFF_PASSWORD,
} from "./sample-logins";
import { composeContact } from "./calling-codes";
import { packTermDays } from "./packages";

export type PackEntitlement = {
  packId: string;
  grantedAt: string;
  until?: string | null;
};

export type User = {
  id: string;
  email: string;
  name: string;
  contact?: string;
  plan: Plan;
  passwordHash: string;
  createdAt: string;
  emailVerified?: boolean;
  verifyToken?: string | null;
  verifyTokenExp?: number | null;
  resetToken?: string | null;
  resetTokenExp?: number | null;
  premiumUntil?: string | null;
  entitlements?: PackEntitlement[];
  role?: UserRole;
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

function collapseDuplicateEmails(store: UserStore): boolean {
  const groups = new Map<string, User[]>();
  for (const user of store.users || []) {
    const email = String(user.email || "").trim().toLowerCase();
    user.email = email;
    if (!email) continue;
    const list = groups.get(email) || [];
    list.push(user);
    groups.set(email, list);
  }
  const kept: User[] = [];
  let changed = false;
  for (const list of groups.values()) {
    if (list.length === 1) {
      kept.push(list[0]);
      continue;
    }
    changed = true;
    list.sort((a, b) => {
      const pa = a.plan === "premium" ? 1 : 0;
      const pb = b.plan === "premium" ? 1 : 0;
      if (pb !== pa) return pb - pa;
      const va = a.emailVerified !== false ? 1 : 0;
      const vb = b.emailVerified !== false ? 1 : 0;
      if (vb !== va) return vb - va;
      return Date.parse(a.createdAt || "") - Date.parse(b.createdAt || "");
    });
    const winner = { ...list[0] };
    for (const other of list.slice(1)) {
      if (other.plan === "premium") winner.plan = "premium";
      const otherUntil = Date.parse(other.premiumUntil || "") || 0;
      const winUntil = Date.parse(winner.premiumUntil || "") || 0;
      if (otherUntil > winUntil) winner.premiumUntil = other.premiumUntil;
      if (other.emailVerified) winner.emailVerified = true;
      if (other.name && (!winner.name || winner.name.length < other.name.length)) winner.name = other.name;
      if (other.contact && !winner.contact) winner.contact = other.contact;
      winner.entitlements = mergeEntitlements(winner.entitlements, other.entitlements);
    }
    kept.push(winner);
  }
  if (changed) store.users = kept;
  return changed;
}

function ensureUsers(): UserStore {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const empty: UserStore = { users: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as UserStore;
  if (!Array.isArray(store.users)) store.users = [];
  let changed = collapseDuplicateEmails(store);
  if (process.env.NODE_ENV === "production") {
    if (ensureEnvStaff(store)) changed = true;
  } else {
    if (ensureStaffAccount(store)) changed = true;
    if (ensureSampleStudent(store)) changed = true;
  }
  if (backfillEntitlementExpiry(store)) changed = true;
  if (changed) saveUsers(store);
  return store;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function backfillEntitlementExpiry(store: UserStore): boolean {
  let changed = false;
  for (const user of store.users) {
    if (!user.entitlements) continue;
    for (const row of user.entitlements) {
      if (row.until) continue;
      const days = packTermDays(row.packId);
      if (days <= 0) continue;
      const start = Date.parse(row.grantedAt) || Date.now();
      row.until = new Date(start + days * DAY_MS).toISOString();
      changed = true;
    }
  }
  return changed;
}

function ensureEnvStaff(store: UserStore): boolean {
  const email = (process.env.STAFF_EMAIL || "").trim().toLowerCase();
  const password = process.env.STAFF_PASSWORD || "";
  if (!email || password.length < 6) return false;
  const existing = store.users.find((u) => u.email === email);
  if (!existing) {
    store.users.push({
      id: randomBytes(8).toString("hex"),
      email,
      name: "Admin",
      plan: "regular",
      role: "admin",
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      emailVerified: true,
    });
    return true;
  }
  let changed = false;
  if (existing.role !== "admin") {
    existing.role = "admin";
    changed = true;
  }
  if (existing.emailVerified !== true) {
    existing.emailVerified = true;
    changed = true;
  }
  if (!verifyPassword(password, existing.passwordHash)) {
    existing.passwordHash = hashPassword(password);
    changed = true;
  }
  return changed;
}

function ensureSampleStudent(store: UserStore): boolean {
  const email = SAMPLE_STUDENT_LOGIN;
  const existing = store.users.find((u) => u.email === email);
  if (!existing) {
    store.users.push({
      id: randomBytes(8).toString("hex"),
      email,
      name: "Amos",
      plan: "regular",
      role: "member",
      passwordHash: hashPassword(SAMPLE_STUDENT_PASSWORD),
      createdAt: new Date().toISOString(),
      emailVerified: true,
    });
    return true;
  }
  let changed = false;
  if (existing.role === "admin") {
    existing.role = "member";
    changed = true;
  }
  if (existing.emailVerified !== true) {
    existing.emailVerified = true;
    existing.verifyToken = null;
    existing.verifyTokenExp = null;
    changed = true;
  }
  if (!verifyPassword(SAMPLE_STUDENT_PASSWORD, existing.passwordHash)) {
    existing.passwordHash = hashPassword(SAMPLE_STUDENT_PASSWORD);
    changed = true;
  }
  return changed;
}

function ensureStaffAccount(store: UserStore): boolean {
  const email = STAFF_LOGIN;
  const existing = store.users.find((u) => u.email === email);
  if (!existing) {
    store.users.push({
      id: randomBytes(8).toString("hex"),
      email,
      name: "Mandem",
      plan: "regular",
      role: "admin",
      passwordHash: hashPassword(STAFF_PASSWORD),
      createdAt: new Date().toISOString(),
      emailVerified: true,
    });
    return true;
  }
  let changed = false;
  if (existing.role !== "admin") {
    existing.role = "admin";
    changed = true;
  }
  if (existing.emailVerified === false) {
    existing.emailVerified = true;
    changed = true;
  }
  if (!verifyPassword(STAFF_PASSWORD, existing.passwordHash)) {
    existing.passwordHash = hashPassword(STAFF_PASSWORD);
    changed = true;
  }
  return changed;
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

function mergeEntitlements(
  a?: PackEntitlement[] | null,
  b?: PackEntitlement[] | null
): PackEntitlement[] {
  const map = new Map<string, PackEntitlement>();
  for (const row of [...(a || []), ...(b || [])]) {
    if (!row?.packId) continue;
    const prev = map.get(row.packId);
    const until = Date.parse(row.until || "") || 0;
    const prevUntil = Date.parse(prev?.until || "") || 0;
    if (!prev || until > prevUntil || (!row.until && prev.until)) map.set(row.packId, { ...row });
  }
  return [...map.values()];
}

export function activeEntitlements(user: { entitlements?: PackEntitlement[] | null }): PackEntitlement[] {
  const now = Date.now();
  return (user.entitlements || []).filter((row) => {
    if (!row?.packId) return false;
    if (!row.until) return true;
    const exp = Date.parse(row.until);
    return !Number.isFinite(exp) || exp > now;
  });
}

export function userHasPack(
  user: { entitlements?: PackEntitlement[] | null } | null | undefined,
  packId: string
) {
  if (!user) return false;
  return activeEntitlements(user).some((row) => row.packId === packId);
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
    contact: user.contact || "",
    plan: effectivePlan(user),
    emailVerified: isEmailVerified(user),
    premiumUntil: user.premiumUntil || null,
    createdAt: user.createdAt,
    entitlements: activeEntitlements(user),
    role: user.role === "admin" ? "admin" : "member",
  };
}

export function isStaffUser(user: { role?: string | null } | null | undefined) {
  return user?.role === "admin";
}

export function findUserByEmail(email: string) {
  return ensureUsers().users.find((u) => u.email === email.trim().toLowerCase()) || null;
}

export function findUserById(id: string) {
  return ensureUsers().users.find((u) => u.id === id) || null;
}

export function registerUser(input: {
  name: string;
  email: string;
  password: string;
  dialIso: string;
  phone: string;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;
  const contact = composeContact(input.dialIso, input.phone);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a name and a valid email." };
  }
  if (!contact.ok) return { ok: false as const, error: contact.error };
  if (password.length < 6) {
    return { ok: false as const, error: "Password must be at least 6 characters." };
  }
  const store = ensureUsers();
  if (
    email === STAFF_LOGIN ||
    email === SAMPLE_STUDENT_LOGIN ||
    store.users.some((u) => u.email === email && u.role === "admin")
  ) {
    return { ok: false as const, error: "That email already has an account." };
  }
  if (store.users.some((u) => u.email === email)) {
    return { ok: false as const, error: "That email already has an account." };
  }
  const user: User = {
    id: randomBytes(8).toString("hex"),
    email,
    name,
    contact: contact.contact,
    plan: "regular",
    role: "member",
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
  if (user.role === "admin") {
    return { ok: false as const, error: "Use Admin to sign in." };
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

export function loginStaff(email: string, password: string) {
  const user = findUserByEmail(email);
  const pass = password.trim();
  if (!user || user.role !== "admin" || !verifyPassword(pass, user.passwordHash)) {
    return { ok: false as const, error: "Admin email or password is wrong." };
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

export async function getStaffSession() {
  const session = await getSession();
  return isStaffUser(session) ? session : null;
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

function familyKey(packId: string) {
  return packId === "mentorship" || packId.startsWith("mentor-") ? "mentorship" : packId;
}

export function grantPack(id: string, packId: string, days?: number | null) {
  const store = ensureUsers();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;
  const list = mergeEntitlements(user.entitlements, []);
  const term = typeof days === "number" && days > 0 ? days : packTermDays(packId);
  const key = familyKey(packId);
  const existing = list.find((r) => r.packId === key);
  const existingUntil = Date.parse(existing?.until || "") || 0;
  const now = Date.now();
  const stillOpen = existingUntil > now;
  const grantedAt = stillOpen && existing?.grantedAt ? existing.grantedAt : new Date().toISOString();
  const until =
    stillOpen && existing?.until
      ? existing.until
      : term > 0
        ? new Date(now + term * DAY_MS).toISOString()
        : null;
  const next: PackEntitlement = { packId, grantedAt, until };
  let nextList = mergeEntitlements(
    list.filter((r) => r.packId !== packId),
    [next]
  );
  if (packId.startsWith("mentor-") && !nextList.some((r) => r.packId === "mentorship" && (!r.until || Date.parse(r.until) > now))) {
    nextList = mergeEntitlements(
      nextList.filter((r) => r.packId !== "mentorship"),
      [{ packId: "mentorship", grantedAt, until }]
    );
  }
  user.entitlements = nextList;
  saveUsers(store);
  return publicUser(user);
}



export function revokePack(id: string, packId: string) {
  const store = ensureUsers();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;
  user.entitlements = (user.entitlements || []).filter((r) => r.packId !== packId);
  saveUsers(store);
  return publicUser(user);
}

export function listPremiumUsers() {
  return ensureUsers()
    .users.filter((u) => effectivePlan(u) === "premium" && isEmailVerified(u))
    .map(publicUser);
}
