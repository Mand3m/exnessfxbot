import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUserPayments } from "@/lib/payments";
import {
  allowMt5Attempt,
  consumeMt5LinkToken,
  getMemberMt5ForPayment,
  issueMt5LinkToken,
  mt5LinkTokenLive,
  readMt5LinkToken,
  requestSameOrigin,
  saveMemberMt5,
} from "@/lib/member-mt5";

export const dynamic = "force-dynamic";

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET() {
  const user = await getSession();
  if (!user) return fail("Log in first.", 401);
  const pending = listUserPayments(user.id).find(
    (p) => p.status === "pending" && !getMemberMt5ForPayment(p.id)
  );
  if (!pending) {
    return NextResponse.json({ ok: true, needsLink: false });
  }
  const token = issueMt5LinkToken(user.id, pending.id);
  return NextResponse.json({
    ok: true,
    needsLink: true,
    paymentId: pending.id,
    mt5Token: token,
  });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return fail("Log in first.", 401);
  if (!requestSameOrigin(req)) return fail("Rejected: origin mismatch.", 403);
  if (!allowMt5Attempt(user.id)) return fail("Too many attempts. Try again later.", 429);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("Invalid request.");
  }

  const token = String(body.mt5Token || "");
  const parsed = readMt5LinkToken(token);
  if (!parsed || parsed.uid !== user.id) return fail("This form has expired. Start from payment again.", 403);

  const ownsPayment = listUserPayments(user.id).some((p) => p.id === parsed.pid);
  if (!ownsPayment) return fail("That payment does not belong to this account.", 403);
  if (!mt5LinkTokenLive(user.id, parsed.pid, parsed.nonce)) {
    return fail("This form was already used or has expired.", 403);
  }

  const result = saveMemberMt5({
    userId: user.id,
    paymentId: parsed.pid,
    label: String(body.label || user.name || "Member account"),
    login: String(body.login || ""),
    server: String(body.server || ""),
    password: String(body.password || ""),
    riskPct: body.riskPct,
    deviation: body.deviation,
    symbolSuffix: String(body.symbolSuffix || ""),
  });
  if (!result.ok) return fail(result.error);
  if (!consumeMt5LinkToken(user.id, parsed.pid, parsed.nonce)) {
    return fail("This form was already used or has expired.", 403);
  }

  return NextResponse.json({
    ok: true,
    record: result.record,
    message: "MT5 details saved. Admin will use them after the payment is confirmed.",
  });
}
