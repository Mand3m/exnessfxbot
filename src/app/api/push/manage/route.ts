import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readManageHead } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user || user.plan !== "premium") {
    return NextResponse.json({ ok: true, id: null });
  }
  const head = readManageHead();
  return NextResponse.json({
    ok: true,
    id: head?.id || null,
    pair: head?.pair || null,
    label: head?.label || null,
    publishedAt: head?.publishedAt || null,
    kind: "manage",
    title: head?.title || null,
    body: head?.body || null,
  });
}
