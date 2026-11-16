import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  attachMomo,
  createPayment,
  decidePayment,
  listUserPayments,
  releasePendingMomo,
  setCharge,
} from "@/lib/payments";
import { issueMt5LinkToken } from "@/lib/member-mt5";
import { momoConfigured, momoPartyId, momoUgxBlocked, newMomoReference, requestToPay } from "@/lib/momo";
import { MERCHANTS, isMaterialPack } from "@/lib/packages";
import { formatUgx, usdToUgx } from "@/lib/ugx";

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
  const network = body.network === "Airtel" ? "Airtel" : body.network === "BTC" ? "BTC" : "MTN";
  const packId = String(body.packId || "");
  if (network === "MTN") releasePendingMomo(user.id, packId);
  const result = createPayment({
    userId: user.id,
    email: user.email,
    packId,
    payerName: String(body.payerName || user.name || ""),
    phone: String(body.phone || ""),
    network,
    reference: body.reference,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const material = isMaterialPack(result.payment.packId);
  const ugx = usdToUgx(result.payment.price);
  if (network === "MTN") setCharge(result.payment.id, ugx);

  if (network === "MTN" && momoConfigured() && !momoUgxBlocked()) {
    const partyId = momoPartyId(result.payment.phone);
    if (!partyId) {
      decidePayment(result.payment.id, "rejected");
      return NextResponse.json({ error: "Enter the MTN number as 07… or 2567…" }, { status: 400 });
    }
    const momoRef = newMomoReference();
    const requested = await requestToPay({
      referenceId: momoRef,
      amount: ugx,
      partyId,
      externalId: result.payment.id,
      message: result.payment.packName,
    });
    if (requested.ok) {
      attachMomo(result.payment.id, momoRef, ugx);
      return NextResponse.json({
        ok: true,
        momo: true,
        payment: { id: result.payment.id, packName: result.payment.packName, status: "pending" },
        amount: ugx,
        currency: "UGX",
        message: `Approve ${formatUgx(ugx)} UGX on ${partyId}.`,
      });
    }
    if (requested.code !== "INVALID_CURRENCY") {
      decidePayment(result.payment.id, "rejected");
      return NextResponse.json({ error: requested.error }, { status: 400 });
    }
  }

  const mt5Token = material ? "" : issueMt5LinkToken(user.id, result.payment.id);
  const momoNote =
    network === "MTN"
      ? ` Pay merchant code ${MERCHANTS.MTN} the amount ${formatUgx(ugx)} UGX. The name on that code is EXNESS FX TRADING CONSULTANTS LTD.`
      : "";
  return NextResponse.json({
    ok: true,
    momo: false,
    payment: { id: result.payment.id, packName: result.payment.packName, status: result.payment.status },
    mt5Token,
    message: material
      ? `Submitted.${momoNote} Admin confirms the deposit, then unlocks this pack on your email. The course stays closed until then.`
      : `Submitted.${momoNote} Premium starts after admin confirms the deposit.`,
  });
}
