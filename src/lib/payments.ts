import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { findUserById, grantPremium } from "./auth";
import { findPack } from "./packages";

export type PayNetwork = "MTN" | "Airtel" | "BTC";
export type PaymentStatus = "pending" | "approved" | "rejected";

export type Payment = {
  id: string;
  userId: string;
  email: string;
  packId: string;
  packName: string;
  price: number;
  days: number;
  payerName: string;
  phone: string;
  network: PayNetwork;
  reference?: string;
  status: PaymentStatus;
  createdAt: string;
  decidedAt?: string;
};

type Store = { payments: Payment[] };

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "exnessfxbot-data")
  : path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "payments.json");

function load(): Store {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const empty: Store = { payments: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
    return { payments: Array.isArray(raw.payments) ? raw.payments : [] };
  } catch {
    return { payments: [] };
  }
}

function save(store: Store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function listPayments(): Payment[] {
  return load()
    .payments.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listUserPayments(userId: string): Payment[] {
  return listPayments().filter((p) => p.userId === userId);
}

export function createPayment(input: {
  userId: string;
  email: string;
  packId: string;
  payerName: string;
  phone: string;
  network: PayNetwork;
  reference?: string;
}): { ok: true; payment: Payment } | { ok: false; error: string } {
  const pack = findPack(input.packId);
  if (!pack) return { ok: false, error: "Unknown package." };
  const name = input.payerName.trim();
  const phone = input.phone.replace(/\s+/g, "").trim();
  const ref = input.reference?.trim() || "";
  if (input.network !== "MTN" && input.network !== "Airtel" && input.network !== "BTC") {
    return { ok: false, error: "Pick MTN, Airtel, or BTC." };
  }
  if (input.network === "BTC") {
    if (!name || name.length < 2) return { ok: false, error: "Enter your name." };
    if (ref.length < 6) return { ok: false, error: "Paste the Bitcoin transaction ID." };
  } else {
    if (!name || name.length < 2) return { ok: false, error: "Enter the name on the MoMo account." };
    if (!/^[0-9+]{9,15}$/.test(phone)) return { ok: false, error: "Enter a valid mobile number." };
  }
  const store = load();
  if (
    store.payments.some(
      (p) => p.userId === input.userId && p.packId === pack.id && p.status === "pending"
    )
  ) {
    return { ok: false, error: "That package already has a payment waiting for admin approval." };
  }
  const payment: Payment = {
    id: randomBytes(6).toString("hex"),
    userId: input.userId,
    email: input.email,
    packId: pack.id,
    packName: pack.name,
    price: pack.price,
    days: "days" in pack ? pack.days : 30,
    payerName: name,
    phone: input.network === "BTC" ? phone || "BTC" : phone,
    network: input.network,
    reference: ref || undefined,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.payments.push(payment);
  save(store);
  return { ok: true, payment };
}

export function decidePayment(id: string, status: "approved" | "rejected") {
  const store = load();
  const row = store.payments.find((p) => p.id === id);
  if (!row) return { ok: false as const, error: "Payment not found." };
  if (row.status !== "pending") return { ok: false as const, error: "That payment is already decided." };
  row.status = status;
  row.decidedAt = new Date().toISOString();
  save(store);
  if (status === "approved") {
    const user = findUserById(row.userId);
    if (user) grantPremium(user.id, row.days || 30);
  }
  return { ok: true as const, payment: row };
}
