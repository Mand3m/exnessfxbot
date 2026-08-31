import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listNotices, markNoticesRead, unreadCount } from "@/lib/notices";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (user.plan !== "premium") {
    return NextResponse.json({ ok: true, premium: false, notices: [], unread: 0 });
  }
  return NextResponse.json({
    ok: true,
    premium: true,
    notices: listNotices(),
    unread: unreadCount(user.id),
  });
}

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (user.plan !== "premium") {
    return NextResponse.json({ error: "Premium only." }, { status: 403 });
  }
  markNoticesRead(user.id);
  return NextResponse.json({ ok: true, unread: 0 });
}
