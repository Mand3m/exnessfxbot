import { NextResponse } from "next/server";
import { syncMomo } from "@/lib/momo-sync";
import { findPaymentByMomoRef } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ref = req.headers.get("x-reference-id") || "";
  if (!ref) return NextResponse.json({ ok: false }, { status: 400 });
  const row = findPaymentByMomoRef(ref);
  if (row) await syncMomo(row);
  return NextResponse.json({ ok: true });
}
