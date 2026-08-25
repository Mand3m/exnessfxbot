import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token || "");
    const password = String(body.password || "");
    const confirm = String(body.confirm || "");
    if (!token) {
      return NextResponse.json({ error: "This reset link is not valid." }, { status: 400 });
    }
    if (password !== confirm) {
      return NextResponse.json({ error: "The two passwords do not match." }, { status: 400 });
    }
    const result = resetPasswordWithToken(token, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update the password." }, { status: 500 });
  }
}
