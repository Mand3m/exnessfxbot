"use client";

import { useEffect, useState } from "react";
import { LevelsEditForm } from "@/components/LevelsEditForm";
import { isEntered } from "@/lib/signal-view";

type DeskSignal = {
  id: string;
  pair: string;
  side: string;
  status: string;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  pips?: number;
  note?: string;
  updatedAt?: string;
  publishedAt?: string;
  enteredAt?: string;
  mt5?: { status?: string; message?: string; ticket?: number; commissionUsd?: number; commissionNote?: string };
};

type SignalJob = { status: string; ticket?: number; message?: string } | null;

type DispatchJob = {
  id: string;
  action: string;
  pair: string;
  status: string;
  ticket?: number;
  message?: string;
  createdAt: string;
  pnlUsd?: number | null;
};

type Mt5Live = {
  executorRunning?: boolean;
  executorStale?: boolean;
  status?: { message?: string } | null;
  pnl?: { openUsd?: number; weekUsd?: number; monthUsd?: number; yearUsd?: number } | null;
  jobs?: DispatchJob[];
};

type Book = {
  pending: DeskSignal[];
  orders: DeskSignal[];
  jobs: Record<string, SignalJob>;
  mt5: Mt5Live;
};

function statusClass(status: string) {
  if (status === "filled") return "text-buy";
  if (status === "cancelled") return "text-sell";
  return "text-[#e0b422]";
}

function pipsLabel(pips?: number) {
  if (typeof pips !== "number") return "—";
  return `${pips > 0 ? "+" : ""}${pips}`;
}

function jobTone(status: string) {
  if (status === "sent") return "bg-emerald-500/15 text-emerald-400";
  if (status === "error") return "bg-red-500/15 text-red-400";
  if (status === "skipped") return "bg-amber-400/15 text-amber-300";
  return "bg-white/5 text-muted";
}

function pnlTone(value?: number | null) {
  if (value == null || value === 0) return "text-[#f3d56a]";
  return value > 0 ? "text-emerald-400" : "text-red-400";
}

export function DeskLiveBook({ initial }: { initial: Book }) {
  const [book, setBook] = useState<Book>({
    pending: initial.pending || [],
    orders: initial.orders || [],
    jobs: initial.jobs || {},
    mt5: initial.mt5 || {},
  });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/desk", { cache: "no-store" });
        const data = (await res.json()) as Book & { ok?: boolean; locked?: boolean };
        if (!alive || !data?.ok || data.locked) return;
        setBook({
          pending: data.pending || [],
          orders: data.orders || [],
          jobs: data.jobs || {},
          mt5: data.mt5 || {},
        });
      } catch {
        /* keep last snapshot */
      }
    };
    tick();
    const id = window.setInterval(tick, 1200);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const mt5 = book.mt5 || {};
  const dispatchJobs = mt5.jobs || [];
  const pnl = mt5.pnl;

  return (
    <>
      <section className="mt-8 space-y-3 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#e0b422]">MT5 dispatch</h2>
          <p className="mt-1 text-sm text-muted">
            Executor {mt5.executorRunning ? (mt5.executorStale ? "hung — will restart on the next send" : "running") : "idle"}.
            Gold is skipped when the account is under $500 USD after UGX conversion.
            Pending orders sit in MetaTrader’s Trade tab, not in open positions.
            Dollar P/L is the first (master) account only, converted from account currency.
          </p>
        </div>
        {mt5.status?.message ? <p className="text-sm text-[#d4b84a]">{mt5.status.message}</p> : null}
        {pnl ? (
          <div className="grid gap-2 sm:grid-cols-4">
            {(
              [
                ["Open", pnl.openUsd],
                ["Week", pnl.weekUsd],
                ["Month", pnl.monthUsd],
                ["Year", pnl.yearUsd],
              ] as const
            ).map(([label, value]) => {
              const n = Number(value) || 0;
              return (
                <div key={label} className="rounded-xl border border-[#c9a227]/50 bg-black/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted">{label} P/L</p>
                  <p className={`num mt-1 text-lg font-semibold ${pnlTone(n)}`}>
                    {n > 0 ? "+" : ""}
                    ${n.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted">
            Dollar P/L appears after the executor has connected the first (master) MT5 account.
          </p>
        )}
        {dispatchJobs.length ? (
          <div className="overflow-x-auto rounded-xl border border-[#c9a227]/60">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-black/70 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">When</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Act</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Pair</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Status</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">Ticket</th>
                  <th className="whitespace-nowrap px-2 py-1.5 font-semibold">P/L $</th>
                  <th className="px-2 py-1.5 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {dispatchJobs.map((job) => (
                  <tr key={job.id} className="border-t border-[#c9a227]/40">
                    <td className="num whitespace-nowrap px-2 py-1.5">
                      {String(job.createdAt || "").replace("T", " ").slice(5, 16)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 capitalize">{job.action}</td>
                    <td className="num whitespace-nowrap px-2 py-1.5">{job.pair}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span className={`inline-block rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${jobTone(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-2 py-1.5">{job.ticket || "—"}</td>
                    <td className="num whitespace-nowrap px-2 py-1.5">
                      {job.pnlUsd == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={pnlTone(job.pnlUsd)}>
                          {job.pnlUsd > 0 ? "+" : ""}
                          ${job.pnlUsd.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-0 truncate px-2 py-1.5 text-muted" title={job.message || ""}>
                      {job.message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No MT5 jobs yet. Send a card with the MT5 box ticked.</p>
        )}
      </section>

      <section className="mt-8 space-y-4 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#e0b422]">Pending orders</h2>
          <p className="mt-1 text-sm text-muted">
            Live cards that are still running. After fill: 1:1 moves SL to
            break-even; 1:2 takes half off and locks SL at 1R; the rest runs to TP.
            Linked MT5 accounts move automatically. Premium cards get a notice to match.
            Use Close order if you want it off the book.
          </p>
        </div>
        {book.pending.length === 0 ? (
          <p className="text-sm text-muted">No pending orders right now.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {book.pending.map((s) => {
              const job = book.jobs[s.id];
              return (
                <article key={s.id} className="rounded-xl border border-[#c9a227] bg-black/60 p-4">
                  <p className="text-sm font-semibold text-[#e0b422]">
                    {s.pair} · {s.side.toUpperCase()} · {isEntered(s) ? "Active" : "Pending"}
                  </p>
                  <p className="mt-1 text-sm text-[#d4b84a]">
                    Entry <span className="num text-[#f3d56a]">{s.entry}</span>
                  </p>
                  {job ? (
                    <p
                      className={`mt-2 text-xs ${
                        job.status === "sent"
                          ? "text-emerald-400"
                          : job.status === "error"
                            ? "text-red-300"
                            : "text-amber-300"
                      }`}
                    >
                      MT5 {job.status}
                      {job.ticket ? ` · ticket ${job.ticket}` : ""}: {job.message || "—"}
                    </p>
                  ) : s.mt5 ? (
                    <p className="mt-2 text-xs text-emerald-400">
                      MT5 {s.mt5.status}
                      {s.mt5.ticket ? ` · ticket ${s.mt5.ticket}` : ""}: {s.mt5.message || "linked"}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted">No MT5 job for this card.</p>
                  )}
                  {typeof s.mt5?.commissionUsd === "number" ? (
                    <p className="mt-1 text-xs text-[#d4b84a]">
                      Commission at trigger{" "}
                      <span className="num text-[#f3d56a]">
                        {s.mt5.commissionUsd > 0 ? "+" : ""}
                        ${s.mt5.commissionUsd.toFixed(2)}
                      </span>
                      {s.mt5.commissionNote ? ` · ${s.mt5.commissionNote}` : ""}
                    </p>
                  ) : isEntered(s) ? (
                    <p className="mt-1 text-xs text-muted">Commission at trigger: waiting on MT5 deal…</p>
                  ) : null}
                  <LevelsEditForm
                    signalId={s.id}
                    stopLoss={s.stopLoss}
                    takeProfit={s.takeProfit}
                    next="/desk"
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-card-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Pair</th>
              <th className="px-3 py-2">Side</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">TP</th>
              <th className="px-3 py-2">SL</th>
              <th className="px-3 py-2">Pips</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {book.orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-muted">
                  No desk tickets yet.
                </td>
              </tr>
            ) : (
              book.orders.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-3 font-medium">{s.pair}</td>
                  <td className="px-3 py-3 uppercase">{s.side}</td>
                  <td className="num px-3 py-3">{s.entry}</td>
                  <td className="num px-3 py-3">{s.takeProfit}</td>
                  <td className="num px-3 py-3">{s.stopLoss}</td>
                  <td className={`num px-3 py-3 ${typeof s.pips === "number" && s.pips >= 0 ? "text-buy" : typeof s.pips === "number" ? "text-sell" : ""}`}>
                    {pipsLabel(s.pips)}
                  </td>
                  <td className={`px-3 py-3 ${statusClass(s.status)}`}>{s.status}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action="/api/admin/desk" method="post">
                        <input type="hidden" name="action" value="resolve" />
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="status" value="filled" />
                        <button type="submit" className="text-xs font-semibold text-buy">
                          Fill
                        </button>
                      </form>
                      <form action="/api/admin/desk" method="post">
                        <input type="hidden" name="action" value="resolve" />
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="status" value="cancelled" />
                        <button type="submit" className="text-xs font-semibold text-warn">
                          Cancel
                        </button>
                      </form>
                      <form action="/api/admin/desk" method="post">
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="text-xs font-semibold text-sell">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
