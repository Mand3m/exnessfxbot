import { NextResponse } from "next/server";
import { listUsers, setUserPlan } from "@/lib/auth";
import {
  deleteSignal,
  getSignalById,
  listMonthly,
  listSignals,
  publishSignal,
  resetDemo,
  resolveSignal,
  reviseLevels,
  verifyAdminPassword,
} from "@/lib/signals";
import { isEntered } from "@/lib/signal-view";
import { fetchLivePrices } from "@/lib/quotes";
import type { PairId, Side } from "@/lib/signals";
import {
  deleteMt5Account,
  enabledMt5Accounts,
  mt5PublishNote,
  publicMt5State,
  saveMt5Account,
  waitForMt5Jobs,
} from "@/lib/mt5";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!verifyAdminPassword(String(body.password || ""))) return unauthorized();

    const action = String(body.action || "list");

    if (action === "list") {
      let users: ReturnType<typeof listUsers> = [];
      try {
        users = listUsers();
      } catch {
        users = [];
      }
      return NextResponse.json({
        ok: true,
        signals: listSignals(),
        monthly: listMonthly(),
        users,
        mt5: publicMt5State(),
      });
    }

    if (action === "publish" || action === "upsert") {
      const pair = String(body.pair || "") as PairId;
      const side = String(body.side || "") as Side;
      const entry = Number(body.entry);
      const takeProfit = Number(body.takeProfit);
      const stopLoss = Number(body.stopLoss);
      if (!pair || (side !== "buy" && side !== "sell")) {
        return NextResponse.json({ error: "Choose a pair and Buy or Sell." }, { status: 400 });
      }
      if (![entry, takeProfit, stopLoss].every((n) => Number.isFinite(n) && n > 0)) {
        return NextResponse.json(
          { error: "Enter entry, take profit, and stop loss prices." },
          { status: 400 }
        );
      }
      const signal = publishSignal({
        pair,
        side,
        entry,
        takeProfit,
        stopLoss,
        openOnMt5: body.openOnMt5 !== false && body.openOnMt5 !== "0",
      });
      const queued = publicMt5State().jobs.filter((j) => j.signalId === signal.id && j.action === "open");
      const jobs = await waitForMt5Jobs(queued.map((j) => j.id));
      return NextResponse.json({
        ok: true,
        signal,
        signals: listSignals(),
        mt5: publicMt5State(),
        message:
          "Card updated. Premium users see it now. Regular users see it in 10 minutes." +
          mt5PublishNote(jobs.length ? jobs : queued, enabledMt5Accounts().length),
      });
    }

    if (action === "levels") {
      const signal = reviseLevels(String(body.id || ""), Number(body.stopLoss), Number(body.takeProfit));
      if (!signal) {
        return NextResponse.json({ error: "Could not update levels on that pending order." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        signal,
        signals: listSignals(),
        mt5: publicMt5State(),
        message:
          "SL/TP updated. Premium cards are notified now. Regular cards keep the old levels for 10 minutes.",
      });
    }

    if (action === "mt5Save") {
      const saved = saveMt5Account({
        id: String(body.accountId || body.id || "") || undefined,
        label: String(body.label || ""),
        enabled: Boolean(body.enabled),
        login: String(body.login || ""),
        server: String(body.server || ""),
        password: String(body.mt5Password || ""),
        riskPct: Number(body.riskPct),
        deviation: Number(body.deviation),
        symbolSuffix: String(body.symbolSuffix || ""),
        terminalPath: String(body.terminalPath || ""),
      });
      return NextResponse.json({
        ok: true,
        mt5: publicMt5State(),
        message: saved.enabled
          ? `${saved.label} saved and armed. Keep the executor running.`
          : `${saved.label} saved. Enable it when you want publishes to open trades.`,
      });
    }

    if (action === "mt5Delete") {
      deleteMt5Account(String(body.accountId || body.id || ""));
      return NextResponse.json({ ok: true, mt5: publicMt5State(), message: "MT5 account removed." });
    }

    if (action === "setPlan") {
      const user = setUserPlan(
        String(body.userId || ""),
        body.plan === "premium" ? "premium" : "regular"
      );
      if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
      return NextResponse.json({ ok: true, user, users: listUsers(), signals: listSignals() });
    }

    if (action === "resolve") {
      const status = body.status === "cancelled" ? "cancelled" : "filled";
      let filledExit = Number(body.filledExit) || undefined;
      if (status === "cancelled" && !filledExit) {
        const existing = getSignalById(String(body.id || ""));
        if (existing && isEntered(existing)) {
          const prices = await fetchLivePrices();
          filledExit = prices[existing.pair] ?? existing.entry;
        }
      }
      const signal = resolveSignal(String(body.id || ""), status, filledExit);
      if (!signal) return NextResponse.json({ error: "Signal not found." }, { status: 404 });
      return NextResponse.json({ ok: true, signal, signals: listSignals() });
    }

    if (action === "delete") {
      const ok = deleteSignal(String(body.id || ""));
      if (!ok) return NextResponse.json({ error: "Signal not found." }, { status: 404 });
      return NextResponse.json({ ok: true, signals: listSignals() });
    }

    if (action === "reset") {
      const store = resetDemo();
      return NextResponse.json({ ok: true, signals: store.signals, monthly: store.monthly });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin action failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
