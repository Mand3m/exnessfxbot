import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { issueMt5LinkToken } from "@/lib/member-mt5";
import { syncMomo } from "@/lib/momo-sync";
import { isMaterialPack } from "@/lib/packages";
import { findPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const row = findPayment(id);
  if (!row || row.userId !== user.id) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  const payment = row.momoRef && row.status === "pending" ? await syncMomo(row) : row;
  const material = isMaterialPack(payment.packId);
  const mt5Token =
    payment.status === "approved" && !material ? issueMt5LinkToken(user.id, payment.id) : "";
  const message =
    payment.status === "approved"
      ? material
        ? "MTN confirmed the payment. This pack is unlocked on your email."
        : "MTN confirmed the payment. Premium is on."
      : payment.status === "rejected"
        ? "MTN did not complete the payment. You can try again."
        : "Waiting for you to approve the prompt on your phone.";
  return NextResponse.json({ ok: true, status: payment.status, mt5Token, message });
}
