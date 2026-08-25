import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPayment, listUserPayments } from "@/lib/payments";
import { issueMt5LinkToken } from "@/lib/member-mt5";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  return NextResponse.json({ ok: true, payments: listUserPayments(user.id) });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Log in first to pay." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    packId?: string;
    payerName?: string;
    phone?: string;
    network?: string;
    reference?: string;
  };
  const result = createPayment({
    userId: user.id,
    email: user.email,
    packId: String(body.packId || ""),
    payerName: String(body.payerName || user.name || ""),
    phone: String(body.phone || ""),
    network: body.network === "Airtel" ? "Airtel" : body.network === "BTC" ? "BTC" : "MTN",
    reference: body.reference,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const mt5Token = issueMt5LinkToken(user.id, result.payment.id);
  return NextResponse.json({
    ok: true,
    payment: { id: result.payment.id, packName: result.payment.packName, status: result.payment.status },
    mt5Token,
    message: "Submitted. Premium starts after admin confirms the deposit.",
  });
}
