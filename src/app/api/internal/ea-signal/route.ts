import { NextResponse } from "next/server";
import { getSignalById, publishEaSignal, resolveSignal, type PairId, type Side } from "@/lib/signals";

export const dynamic = "force-dynamic";

function isLocal(req: Request) {
  const host = (req.headers.get("host") || "").toLowerCase();
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

export async function POST(req: Request) {
  if (!isLocal(req)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const action = String(body.action || "open");
  if (action === "fill") {
    const id = String(body.signalId || "");
    const existing = getSignalById(id);
    if (!existing) return NextResponse.json({ error: "unknown signal" }, { status: 404 });
    const exit = Number(body.exit);
    const signal = resolveSignal(
      id,
      "filled",
      Number.isFinite(exit) ? exit : existing.entry,
      String(body.note || "") || undefined
    );
    return NextResponse.json({ ok: true, signal });
  }
  const pair = String(body.pair || "") as PairId;
  const side = String(body.side || "") as Side;
  const entry = Number(body.entry);
  const takeProfit = Number(body.takeProfit);
  const stopLoss = Number(body.stopLoss);
  const ticket = Number(body.ticket) || undefined;
  if (pair !== "XAUUSD" || (side !== "buy" && side !== "sell")) {
    return NextResponse.json({ error: "XAUUSD buy or sell required" }, { status: 400 });
  }
  if (![entry, takeProfit, stopLoss].every((n) => Number.isFinite(n) && n > 0)) {
    return NextResponse.json({ error: "entry, tp and sl required" }, { status: 400 });
  }
  const signal = publishEaSignal({ pair, side, entry, takeProfit, stopLoss, ticket });
  return NextResponse.json({ ok: true, signalId: signal.id, signal });
}
