import { NextResponse } from "next/server";
import {
  addSignup,
  findSignupByEmail,
  markMailed,
  rateLimited,
  validateSignup,
} from "@/lib/journal-club";
import { sendJournalClubSignup } from "@/lib/mail";

function clientIp(req: Request) {
  return (
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Could not read the form." }, { status: 400 });
  }

  // Honeypot: real people never see or fill this field. Pretend success for bots.
  if (String(body.website || "").trim()) {
    return NextResponse.json({ ok: true });
  }
  // Forms submitted faster than a person can type are almost always bots.
  const startedAt = Number(body.startedAt || 0);
  if (startedAt && Date.now() - startedAt < 2500) {
    return NextResponse.json({ ok: true });
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many signups from this connection. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const parsed = validateSignup(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    if (findSignupByEmail(parsed.value.email)) {
      return NextResponse.json({ ok: true, already: true });
    }
    const signup = addSignup(parsed.value);
    const mail = await sendJournalClubSignup(signup);
    markMailed(signup.id, mail.sent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[journal-club] signup failed", err);
    return NextResponse.json(
      { error: "Could not join the waitlist right now. Try again shortly." },
      { status: 500 }
    );
  }
}
