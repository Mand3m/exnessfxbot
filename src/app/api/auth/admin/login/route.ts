import { NextResponse } from "next/server";
import { loginStaff, publicUser, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginStaff(String(body.email || ""), String(body.password || ""));
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await setSessionCookie(result.token);
    return NextResponse.json({ ok: true, user: publicUser(result.user) });
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
