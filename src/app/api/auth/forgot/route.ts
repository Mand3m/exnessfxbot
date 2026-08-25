import { NextResponse } from "next/server";
import { issueResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mail";
import { publicSiteOrigin } from "@/lib/site";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = issueResetToken(String(body.email || ""));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.user) {
      const url = publicSiteOrigin(req) + "/reset-password?token=" + result.user.resetToken;
      const mail = await sendPasswordResetEmail(result.user.email, url);
      if (!mail.sent) {
        console.error("[reset-email] send failed");
        return NextResponse.json(
          { error: "Could not send the reset email. Tap Resend reset email and try again." },
          { status: 502 }
        );
      }
      console.log("[reset-email] sent");
    } else {
      console.warn("[reset-email] no matching account; nothing delivered");
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not start the password reset." }, { status: 500 });
  }
}
