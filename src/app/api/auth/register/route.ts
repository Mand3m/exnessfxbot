import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/mail";
import { publicSiteOrigin } from "@/lib/site";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = registerUser({
      name: String(body.name || ""),
      email: String(body.email || ""),
      password: String(body.password || ""),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const url =
      publicSiteOrigin(req) + "/api/auth/verify?token=" + result.user.verifyToken;
    const mail = await sendVerificationEmail(result.user.email, url);
    if (!mail.sent) {
      return NextResponse.json(
        {
          error:
            "Account created, but the verification email could not be sent. Wait a moment, then use Resend verification email on the login page.",
          needsVerify: true,
          email: result.user.email,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      needsVerify: true,
      email: result.user.email,
    });
  } catch {
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}
