import { NextResponse } from "next/server";
import { grantPack, revokePack, setUserPlan } from "@/lib/auth";
import { decidePayment } from "@/lib/payments";
import { isMaterialPack } from "@/lib/packages";
import {
  isDeskUnlocked,
  lockDesk,
  unlockDesk,
} from "@/lib/admin-session";
import {
  deleteSignal,
  getSignalById,
  listActiveSignals,
  listDeskOrders,
  publishSignal,
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
  lastMt5JobForSignal,
  mt5PublishNote,
  publicMt5State,
  saveMt5Account,
  waitForMt5Jobs,
} from "@/lib/mt5";

function back(req: Request, form: FormData, query: string) {
  const next = String(form.get("next") || "/desk");
  const path = next.startsWith("/") ? next.split("?")[0] : "/desk";
  const dest = `${path === "/" || path === "/desk" ? path : "/desk"}${query ? `?${query}` : ""}`;
  return new NextResponse(null, {
    status: 303,
    headers: { Location: dest },
  });
}

function formAction(form: FormData) {
  const raw = String(form.get("deskAction") || form.get("action") || "");
  if (!raw || raw.includes("/") || raw.startsWith("http")) return "";
  return raw;
}

export async function GET() {
  if (!(await isDeskUnlocked())) {
    return NextResponse.json({ ok: false, locked: true });
  }
  const pending = listActiveSignals();
  const jobs: Record<string, { status: string; ticket?: number; message?: string } | null> = {};
  for (const row of pending) {
    const job = lastMt5JobForSignal(row.id);
    jobs[row.id] = job
      ? { status: job.status, ticket: job.ticket, message: job.message }
      : null;
  }
  const mt5 = publicMt5State();
  return NextResponse.json({
    ok: true,
    pending,
    orders: listDeskOrders(),
    jobs,
    mt5: {
      executorRunning: mt5.executorRunning,
      executorStale: mt5.executorStale,
      status: mt5.status,
      pnl: mt5.pnl,
      jobs: mt5.jobs,
    },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const action = formAction(form);

  if (action === "unlock") {
    if (!verifyAdminPassword(String(form.get("password") || ""))) {
      return back(req, form, "error=Wrong+password");
    }
    await unlockDesk();
    return back(req, form, "ok=unlocked");
  }

  const passwordOk = verifyAdminPassword(String(form.get("password") || ""));
  const sessionOk = await isDeskUnlocked();
  if (!passwordOk && !sessionOk) {
    return back(req, form, "error=Enter+the+admin+password+to+submit");
  }
  if (passwordOk) await unlockDesk();

  if (action === "lock") {
    await lockDesk();
    return back(req, form, "");
  }

  if (action === "publish") {
    const pair = String(form.get("pair") || "") as PairId;
    const side = String(form.get("side") || "") as Side;
    const entry = Number(form.get("entry"));
    const takeProfit = Number(form.get("takeProfit"));
    const stopLoss = Number(form.get("stopLoss"));
    if (!pair || (side !== "buy" && side !== "sell")) {
      return back(req, form, "error=Choose+a+pair+and+Buy+or+Sell");
    }
    if (![entry, takeProfit, stopLoss].every((n) => Number.isFinite(n) && n > 0)) {
      return back(req, form, "error=Enter+SL%2C+TP+and+Entry+prices");
    }
    const mt5TicketRaw = Number(form.get("mt5Ticket"));
    const mt5Ticket = Number.isFinite(mt5TicketRaw) && mt5TicketRaw > 0 ? mt5TicketRaw : undefined;
    const alreadyLive = String(form.get("alreadyLive") || "") === "1" || mt5Ticket != null;
    // Never double-open a trade that FibToDesk marked as already live on MT5.
    const openOnMt5 = !alreadyLive && String(form.get("openOnMt5") || "") === "1";
    const signal = publishSignal({
      pair,
      side,
      entry,
      takeProfit,
      stopLoss,
      openOnMt5,
      mt5Ticket,
      alreadyLive,
    });
    const queued = publicMt5State().jobs.filter((j) => j.signalId === signal.id && j.action === "open");
    const jobs = await waitForMt5Jobs(queued.map((j) => j.id));
    const note = alreadyLive && !openOnMt5
      ? (mt5Ticket
          ? ` Linked to live MT5 ticket ${mt5Ticket} (no new open).`
          : " Trade already live on MT5 — cards only (no new open).")
      : mt5PublishNote(jobs.length ? jobs : queued, enabledMt5Accounts().length);
    return back(
      req,
      form,
      "ok=" +
        encodeURIComponent(
          "Card updated. Premium sees it now, regular in 10 minutes." + note
        )
    );
  }

  if (action === "levels") {
    const signal = reviseLevels(
      String(form.get("id") || ""),
      Number(form.get("stopLoss")),
      Number(form.get("takeProfit"))
    );
    if (!signal) {
      return back(req, form, "error=Could+not+update+levels+on+that+pending+order");
    }
    return back(
      req,
      form,
      "ok=" +
        encodeURIComponent(
          "SL/TP updated. Premium cards are notified now. Regular cards keep the old levels for 10 minutes. MT5 modify queued on enabled accounts."
        )
    );
  }

  if (action === "close") {
    const id = String(form.get("id") || "");
    const existing = getSignalById(id);
    if (!existing) {
      return back(req, form, "error=Could+not+close+that+order");
    }
    let status: "filled" | "cancelled" = "cancelled";
    let exit: number | undefined;
    let note = "Cancelled";
    if (isEntered(existing)) {
      status = "filled";
      const prices = await fetchLivePrices();
      exit = prices[existing.pair] ?? existing.entry;
      note = "Filled at market.";
    }
    const signal = resolveSignal(id, status, exit, note);
    if (!signal) {
      return back(req, form, "error=Could+not+close+that+order");
    }
    const queued = publicMt5State().jobs.filter(
      (j) => j.signalId === signal.id && j.action === "cancel" && j.status === "queued"
    );
    const jobs = await waitForMt5Jobs(queued.map((j) => j.id));
    const mt5Note = jobs[0]?.message
      ? ` ${jobs[0].status}: ${jobs[0].message}`
      : " MT5 cancel queued.";
    return back(
      req,
      form,
      "ok=" + encodeURIComponent("Order closed on the desk." + mt5Note)
    );
  }

  if (action === "mt5Save") {
    try {
      const saved = saveMt5Account({
        id: String(form.get("accountId") || "") || undefined,
        label: String(form.get("label") || ""),
        enabled: String(form.get("enabled") || "") === "1",
        login: String(form.get("login") || ""),
        server: String(form.get("server") || ""),
        password: String(form.get("mt5Password") || ""),
        riskPct: Number(form.get("riskPct")),
        deviation: Number(form.get("deviation")),
        symbolSuffix: String(form.get("symbolSuffix") || ""),
        terminalPath: String(form.get("terminalPath") || ""),
      });
      return back(
        req,
        form,
        "ok=" +
          encodeURIComponent(
            saved.enabled
              ? `${saved.label} saved and armed. Leave MT5 open — the executor starts when you send a signal.`
              : `${saved.label} saved. Enable it when you want publishes to open trades.`
          )
      );
    } catch (err) {
      return back(
        req,
        form,
        "error=" + encodeURIComponent(err instanceof Error ? err.message : "Could not save account")
      );
    }
  }

  if (action === "mt5Delete") {
    deleteMt5Account(String(form.get("accountId") || ""));
    return back(req, form, "ok=MT5+account+removed");
  }

  if (action === "resolve") {
    const status = String(form.get("status")) === "cancelled" ? "cancelled" : "filled";
    resolveSignal(String(form.get("id") || ""), status);
    return back(req, form, "ok=Status+updated");
  }

  if (action === "delete") {
    deleteSignal(String(form.get("id") || ""));
    return back(req, form, "ok=Deleted");
  }

  if (action === "setPlan") {
    setUserPlan(
      String(form.get("userId") || ""),
      String(form.get("plan")) === "premium" ? "premium" : "regular"
    );
    return back(req, form, "ok=Member+updated");
  }

  if (action === "paymentApprove" || action === "paymentReject") {
    const result = decidePayment(
      String(form.get("id") || ""),
      action === "paymentApprove" ? "approved" : "rejected"
    );
    if (!result.ok) {
      return back(req, form, "error=" + encodeURIComponent(result.error));
    }
    const packName = result.payment.packName;
    const material = isMaterialPack(result.payment.packId);
    return back(
      req,
      form,
      action === "paymentApprove"
        ? "ok=" +
            encodeURIComponent(
              material
                ? `Payment approved. ${packName} is unlocked on ${result.payment.email}.`
                : "Payment approved. Member is premium and will get instant cards plus email alerts."
            )
        : "ok=Payment+rejected"
    );
  }

  if (action === "grantPack" || action === "revokePack") {
    const userId = String(form.get("userId") || "");
    const packId = String(form.get("packId") || "");
    if (!isMaterialPack(packId)) {
      return back(req, form, "error=Unknown+material+pack");
    }
    const user = action === "grantPack" ? grantPack(userId, packId) : revokePack(userId, packId);
    if (!user) return back(req, form, "error=Member+not+found");
    return back(
      req,
      form,
      action === "grantPack"
        ? "ok=" + encodeURIComponent(`Unlocked ${packId} for ${user.email}`)
        : "ok=" + encodeURIComponent(`Removed ${packId} from ${user.email}`)
    );
  }

  return back(req, form, "error=Unknown+action");
}
