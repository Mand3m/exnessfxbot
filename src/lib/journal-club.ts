import fs from "fs";
import path from "path";
import { CALLING_CODES, composeContact } from "@/lib/calling-codes";

/** Waitlist for the Forex Traders' Journal Club. Stored beside the other live stores in data/. */
export const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "pro", label: "Pro" },
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]["value"];

export type JournalClubSignup = {
  id: string;
  name: string;
  email: string;
  contact: string;
  country: string;
  experience: ExperienceLevel;
  message: string;
  createdAt: string;
  mailed: boolean;
};

type Store = { signups: JournalClubSignup[] };

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "journal-club-waitlist.json");

function load(): Store {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) return { signups: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
    return { signups: Array.isArray(raw.signups) ? raw.signups : [] };
  } catch {
    return { signups: [] };
  }
}

function save(store: Store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

export function findSignupByEmail(email: string) {
  const key = email.trim().toLowerCase();
  return load().signups.find((s) => s.email === key);
}

export function addSignup(entry: Omit<JournalClubSignup, "id" | "createdAt" | "mailed">) {
  const store = load();
  const signup: JournalClubSignup = {
    ...entry,
    id: "jc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    mailed: false,
  };
  store.signups.push(signup);
  save(store);
  return signup;
}

export function markMailed(id: string, mailed: boolean) {
  const store = load();
  const row = store.signups.find((s) => s.id === id);
  if (!row) return;
  row.mailed = mailed;
  save(store);
}

export function waitlistCount() {
  return load().signups.length;
}

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

export function validateSignup(body: Record<string, unknown>):
  | { ok: true; value: Omit<JournalClubSignup, "id" | "createdAt" | "mailed"> }
  | { ok: false; error: string } {
  const name = clean(body.name, 80).replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  const email = clean(body.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Enter a valid email." };
  const dialIso = clean(body.dialIso, 4).toUpperCase();
  const contact = composeContact(dialIso, clean(body.phone, 30));
  if (!contact.ok) return { ok: false, error: contact.error };
  const experience = clean(body.experience, 20) as ExperienceLevel;
  if (!EXPERIENCE_LEVELS.some((l) => l.value === experience)) {
    return { ok: false, error: "Choose your experience level." };
  }
  const message = clean(body.message, 1000);
  const country = CALLING_CODES.find((c) => c.iso === dialIso)?.name || dialIso;
  return { ok: true, value: { name, email, contact: contact.contact, country, experience, message } };
}

/** Small in-memory limiter: a few signups per IP per window. Resets when the app restarts. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

export function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}
