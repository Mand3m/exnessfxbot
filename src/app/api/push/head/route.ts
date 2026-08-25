import { NextResponse } from "next/server";
import { readPushHead } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const head = readPushHead();
  return NextResponse.json({
    ok: true,
    id: head?.id || null,
    pair: head?.pair || null,
    label: head?.label || null,
    publishedAt: head?.publishedAt || null,
  });
}
