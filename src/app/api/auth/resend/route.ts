import { NextResponse } from "next/server";
import { issueVerifyToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/mail";
import { publicSiteOrigin } from "@/lib/site";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "");
    const result = issueVerifyToken(email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const url =
      publicSiteOrigin(req) + "/api/auth/verify?token=" + result.user.verifyToken;
    const mail = await sendVerificationEmail(result.user.email, url);
    if (!mail.sent) {
      return NextResponse.json(
        { error: "Could not send the verification email. Try again in a minute." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      email: result.user.email,
    });
  } catch {
    return NextResponse.json({ error: "Could not resend the email." }, { status: 500 });
  }
}
