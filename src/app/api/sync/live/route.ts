import { NextResponse } from "next/server";
import { verifyLiveSyncSecret } from "@/lib/live-sync";
import { applyLiveStore } from "@/lib/signals";

export const dynamic = "force-dynamic";

function bearer(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function POST(req: Request) {
  if (!verifyLiveSyncSecret(bearer(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a signal store" }, { status: 400 });
  }
  const store = body as { signals?: unknown; monthly?: unknown; pipLedger?: unknown };
  const applied = applyLiveStore({
    signals: Array.isArray(store.signals) ? store.signals : [],
    monthly: Array.isArray(store.monthly) ? store.monthly : [],
    pipLedger: Array.isArray(store.pipLedger) ? store.pipLedger : [],
  });
  return NextResponse.json({ ok: true, signals: applied });
}
