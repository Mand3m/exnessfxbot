import type { Metadata } from "next";
import { listUsers } from "@/lib/auth";
import { listPayments } from "@/lib/payments";
import { getMemberMt5ForPayment } from "@/lib/member-mt5";
import { FibAutofill } from "@/components/FibAutofill";
import { LevelsEditForm } from "@/components/LevelsEditForm";
import { GOLD_MIN_EQUITY_USD, RISK_TIERS } from "@/lib/calc";
import { emptyMt5Account, lastMt5JobForSignal, publicMt5State } from "@/lib/mt5";
import { publicLiveSyncState } from "@/lib/live-sync";
import { publicTelegramState } from "@/lib/telegram";
import { PAIRS } from "@/lib/pairs";
import { isEntered, listActiveSignals, listSignals, settleLiveOrders } from "@/lib/signals";

export const metadata: Metadata = {
  title: "Signal desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; ok?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const q = await searchParams;
  await settleLiveOrders();
  const signals = listSignals();
  const pending = listActiveSignals();
  const mt5 = publicMt5State();
  const telegram = publicTelegramState();
  const liveSync = publicLiveSyncState();
  const addSlot = mt5.accounts.length < mt5.maxAccounts ? emptyMt5Account(mt5.accounts.length) : null;
  let users: { id: string; name: string; email: string; plan: string }[] = [];
  try {
    users = listUsers();
  } catch {
    users = [];
  }
  const payments = listPayments();
  const pendingPays = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Signal desk</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        These fields are always on this page. Fill SL, TP and Entry, type the
        password, then submit. Password:{" "}
        <code className="rounded bg-card px-1">exnessfxbot-admin</code>
      </p>

      {q.error ? (
        <p className="mt-4 rounded-xl border border-red-400 bg-red-500/20 px-4 py-3 text-sm text-red-200">
          {q.error}
        </p>
      ) : null}
      {q.ok ? (
        <p className="mt-4 rounded-xl border border-[#c9a227] bg-[#e0b422]/15 px-4 py-3 text-sm text-[#e0b422]">
          {q.ok}
        </p>
      ) : null}

      <form
        action="/api/admin/desk"
        method="post"
        className="mt-8 space-y-4 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-6"
      >
        <input type="hidden" name="action" value="publish" />
        <h2 className="text-2xl font-semibold text-[#e0b422]">Live card panel</h2>
        <p className="text-sm text-muted">
          Pick the pair, enter prices, enter the password, submit. That pair’s
          card updates (premium now, regular in 10 minutes). The free Telegram
          channel {telegram.channel} gets an instant link to the card; regulars
          still wait 10 minutes for prices.
          Draw Fibonacci in MT5 and 0.5 fills Entry, 1.0 fills SL.
        </p>
        <p className="text-xs text-[#d4b84a]">
          Live site:{" "}
          {liveSync.pushEnabled
            ? `desk on this PC will push cards to ${liveSync.target}`
            : "off — after deploy, set LIVE_SITE_URL and LIVE_SYNC_SECRET in .env.local on this PC only"}
        </p>
        <p className="text-xs text-[#d4b84a]">
          Telegram {telegram.channel}:{" "}
          {telegram.tokenSet
            ? telegram.posterRunning
              ? `poster running · ${telegram.queued} waiting`
              : `${telegram.queued} waiting · poster idle until the next send`
            : "add TELEGRAM_BOT_TOKEN in .env.local, then add the bot as admin of the channel"}
        </p>
        <FibAutofill />

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Pair</span>
          <select
            name="pair"
            className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
            defaultValue="USDJPY"
          >
            {PAIRS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-6 text-sm text-[#f3d56a]">
          <label className="flex items-center gap-2">
            <input type="radio" name="side" value="buy" defaultChecked />
            Buy (green card)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="side" value="sell" />
            Sell (red card)
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[#e0b422]">SL price</span>
            <input
              name="stopLoss"
              required
              inputMode="decimal"
              className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[#e0b422]">TP price</span>
            <input
              name="takeProfit"
              required
              inputMode="decimal"
              className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[#e0b422]">Entry price</span>
            <input
              name="entry"
              required
              inputMode="decimal"
              className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#f3d56a]">
          <input type="checkbox" name="openOnMt5" value="1" defaultChecked />
          Also open this trade on every enabled MT5 account
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Admin password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            defaultValue="exnessfxbot-admin"
            className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black"
        >
          Submit to live card
        </button>
      </form>

      <details
        className="mt-8 rounded-2xl border border-[#c9a227] bg-black/80 p-6"
        open={mt5.linkedCount === 0}
      >
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[#e0b422]">Link MT5 accounts</h2>
              <p className="mt-1 text-sm text-muted">
                {mt5.linkedCount
                  ? `${mt5.linkedCount} linked · ${mt5.enabledCount} armed · executor ${mt5.executorRunning ? "running" : "idle"} · click to expand (max ${mt5.maxAccounts})`
                  : `Link up to ${mt5.maxAccounts} accounts. After they are saved, this panel stays collapsed.`}
              </p>
            </div>
            <span className="rounded-full border border-[#c9a227] px-3 py-1 text-xs font-semibold text-[#e0b422]">
              {mt5.linkedCount ? "Minimise / expand" : "Set up"}
            </span>
          </div>
        </summary>

        <p className="mt-4 text-sm text-muted">
          Lot size is no longer typed in. When a signal is sent, the executor
          reads live equity and converts it to USD first (UGX ÷ USDUGX, or the
          live USD/UGX rate if that symbol is missing). Lot size then uses that
          USD figure in the position-size calculator (USD equity × risk % ÷ stop
          pips). A UGX balance is never treated as dollars. Accounts under ${GOLD_MIN_EQUITY_USD}{" "}
          skip gold and only take the other pairs. Accounts at ${GOLD_MIN_EQUITY_USD}+
          take every pair, including gold. One open MetaTrader window can only
          stay logged into one account. If you want 2–5 accounts live at the same
          time, install extra portable copies of MT5 and put each copy’s{" "}
          <code>terminal64.exe</code> in that account’s path field. Leave MT5
          open with Algo Trading on. The executor starts when you send a signal
          and stops when nothing is pending or open. Use the master password,
          not investor.
        </p>
        {mt5.status ? (
          <div className="mt-3 space-y-2">
            <p className="rounded-xl border border-[#c9a227] bg-black/60 px-3 py-2 text-sm">
              {mt5.status.message}
            </p>
            {(mt5.status.accounts || []).map((row) => (
              <p key={row.id} className="text-sm text-[#d4b84a]">
                {row.label || row.id}:{" "}
                {row.connected
                  ? `${row.login} @ ${row.server} · ${row.balance ?? "—"}`
                  : row.message}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Executor not seen yet. Send a signal with the MT5 box ticked after
            MetaTrader is logged in.
          </p>
        )}

        <div className="mt-6 space-y-6">
          {mt5.accounts.map((account) => (
            <Mt5AccountForm
              key={account.id}
              accountId={account.id}
              label={account.label}
              enabled={account.enabled}
              login={account.login}
              server={account.server}
              hasPassword={account.hasPassword}
              riskPct={account.riskPct}
              deviation={account.deviation}
              symbolSuffix={account.symbolSuffix}
              terminalPath={account.terminalPath}
              canDelete
            />
          ))}
          {addSlot ? (
            <Mt5AccountForm
              accountId=""
              label={addSlot.label}
              enabled={false}
              login=""
              server=""
              hasPassword={false}
              riskPct={addSlot.riskPct}
              deviation={addSlot.deviation}
              symbolSuffix=""
              terminalPath=""
              canDelete={false}
              isNew
            />
          ) : null}
        </div>
      </details>

      <section className="mt-8 space-y-3 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#e0b422]">MT5 dispatch</h2>
          <p className="mt-1 text-sm text-muted">
            Executor {mt5.executorRunning ? (mt5.executorStale ? "hung — will restart on the next send" : "running") : "idle"}.
            Gold is skipped when the account is under ${GOLD_MIN_EQUITY_USD} USD after UGX conversion.
            Pending orders sit in MetaTrader’s Trade tab, not in open positions.
            Dollar P/L is the first (master) account only, converted from account currency.
          </p>
        </div>
        {mt5.status ? (
          <p className="text-sm text-[#d4b84a]">{mt5.status.message}</p>
        ) : null}
        {mt5.pnl ? (
          <div className="grid gap-2 sm:grid-cols-4">
            {(
              [
                ["Open", mt5.pnl.openUsd],
                ["Week", mt5.pnl.weekUsd],
                ["Month", mt5.pnl.monthUsd],
                ["Year", mt5.pnl.yearUsd],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#c9a227]/50 bg-black/50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted">{label} P/L</p>
                <p
                  className={`num mt-1 text-lg font-semibold ${
                    value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-[#f3d56a]"
                  }`}
                >
                  {value > 0 ? "+" : ""}
                  ${value.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">
            Dollar P/L appears after the executor has connected the first (master) MT5 account.
          </p>
        )}
        {mt5.jobs.length ? (
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
                {mt5.jobs.map((job) => (
                  <tr key={job.id} className="border-t border-[#c9a227]/40">
                    <td className="num whitespace-nowrap px-2 py-1.5">
                      {job.createdAt.replace("T", " ").slice(5, 16)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 capitalize">{job.action}</td>
                    <td className="num whitespace-nowrap px-2 py-1.5">{job.pair}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span
                        className={`inline-block rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
                          job.status === "sent"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : job.status === "error"
                              ? "bg-red-500/15 text-red-400"
                              : job.status === "skipped"
                                ? "bg-amber-400/15 text-amber-300"
                                : "bg-white/5 text-muted"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-2 py-1.5">{job.ticket || "—"}</td>
                    <td className="num whitespace-nowrap px-2 py-1.5">
                      {job.pnlUsd == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={job.pnlUsd > 0 ? "text-emerald-400" : job.pnlUsd < 0 ? "text-red-400" : ""}>
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
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No pending orders right now.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((s) => {
              const job = lastMt5JobForSignal(s.id);
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
                  next="/admin"
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
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-3 font-medium">{s.pair}</td>
                <td className="px-3 py-3 uppercase">{s.side}</td>
                <td className="num px-3 py-3">{s.entry}</td>
                <td className="num px-3 py-3">{s.takeProfit}</td>
                <td className="num px-3 py-3">{s.stopLoss}</td>
                <td className="px-3 py-3">{s.status}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <form action="/api/admin/desk" method="post">
                      <input type="hidden" name="action" value="resolve" />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="status" value="filled" />
                      <input type="hidden" name="password" value="exnessfxbot-admin" />
                      <button type="submit" className="text-xs font-semibold text-buy">
                        Fill
                      </button>
                    </form>
                    <form action="/api/admin/desk" method="post">
                      <input type="hidden" name="action" value="resolve" />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <input type="hidden" name="password" value="exnessfxbot-admin" />
                      <button type="submit" className="text-xs font-semibold text-warn">
                        Cancel
                      </button>
                    </form>
                    <form action="/api/admin/desk" method="post">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="password" value="exnessfxbot-admin" />
                      <button type="submit" className="text-xs font-semibold text-sell">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8 space-y-3 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#e0b422]">Payments</h2>
          <p className="mt-1 text-sm text-muted">
            {pendingPays
              ? `${pendingPays} waiting. Approve MoMo after it shows on MTN 593294 / Airtel 4366333. Approve BTC after it shows on bc1qsr8wlnjxklkzcc4tcc4pxeqgx8qu9gr0rs0elc.`
              : "No waiting deposits. Approved members get instant cards and email on each signal."}
          </p>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">No payment submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#c9a227]/60">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-sm leading-snug">
              <thead className="bg-black/70 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Package</th>
                  <th className="px-3 py-2.5">Payer</th>
                  <th className="px-3 py-2.5">Network</th>
                  <th className="px-3 py-2.5">MT5</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5"> </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-[#c9a227]/40 align-top">
                    <td className="num px-3 py-2.5 text-xs">
                      {p.createdAt.replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="px-3 py-2.5 text-xs break-words">
                      {p.email}
                      <span className="num mt-1 block">${p.price}</span>
                    </td>
                    <td className="px-3 py-2.5">{p.packName}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {p.payerName}
                      <span className="num mt-1 block">{p.phone}</span>
                      {p.reference ? <span className="mt-1 block text-muted">Ref {p.reference}</span> : null}
                    </td>
                    <td className="px-3 py-2.5">{p.network}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {(() => {
                        const mt5 = getMemberMt5ForPayment(p.id);
                        return mt5 ? (
                          <span>
                            {mt5.login} @{mt5.server}
                            <span className="mt-1 block text-muted">password saved</span>
                          </span>
                        ) : (
                          <span className="text-muted">not sent</span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                          p.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : p.status === "rejected"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-400/15 text-amber-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <form action="/api/admin/desk" method="post">
                            <input type="hidden" name="action" value="paymentApprove" />
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="password" value="exnessfxbot-admin" />
                            <button type="submit" className="text-xs font-semibold text-emerald-400">
                              Approve
                            </button>
                          </form>
                          <form action="/api/admin/desk" method="post">
                            <input type="hidden" name="action" value="paymentReject" />
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="password" value="exnessfxbot-admin" />
                            <button type="submit" className="text-xs font-semibold text-red-400">
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">
                          {p.decidedAt ? p.decidedAt.replace("T", " ").slice(0, 16) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Members</h2>
        <p className="mt-1 text-sm text-muted">
          Regular accounts see prices 10 minutes late. Premium accounts see them immediately.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Plan</th>
                <th className="py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-muted">
                    No members yet. They register at /register.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-3">{u.name}</td>
                  <td className="py-3">{u.email}</td>
                  <td className="py-3 capitalize">{u.plan}</td>
                  <td className="py-3">
                    <form action="/api/admin/desk" method="post">
                      <input type="hidden" name="action" value="setPlan" />
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        type="hidden"
                        name="plan"
                        value={u.plan === "premium" ? "regular" : "premium"}
                      />
                      <input type="hidden" name="password" value="exnessfxbot-admin" />
                      <button type="submit" className="text-xs font-semibold text-[#e0b422] underline">
                        {u.plan === "premium" ? "Make regular" : "Make premium"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Mt5AccountForm({
  accountId,
  label,
  enabled,
  login,
  server,
  hasPassword,
  riskPct,
  deviation,
  symbolSuffix,
  terminalPath,
  canDelete,
  isNew,
}: {
  accountId: string;
  label: string;
  enabled: boolean;
  login: string;
  server: string;
  hasPassword: boolean;
  riskPct: number;
  deviation: number;
  symbolSuffix: string;
  terminalPath: string;
  canDelete: boolean;
  isNew?: boolean;
}) {
  const field =
    "w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black";
  return (
    <div className="space-y-2 rounded-xl border border-[#c9a227]/70 bg-black/50 p-4">
    <form
      action="/api/admin/desk"
      method="post"
      className="space-y-3"
    >
      <input type="hidden" name="action" value="mt5Save" />
      <input type="hidden" name="accountId" value={accountId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-[#e0b422]">{isNew ? "Add another account" : label}</h3>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#f3d56a]">
        <input type="checkbox" name="enabled" value="1" defaultChecked={enabled} />
        Enable auto-open on this account
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Label</span>
          <input name="label" defaultValue={label} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">MT5 login</span>
          <input name="login" defaultValue={login} inputMode="numeric" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Server</span>
          <input name="server" defaultValue={server} placeholder="Exness-MT5Trial8" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">
            Password {hasPassword ? "(saved — leave blank to keep)" : ""}
          </span>
          <input type="password" name="mt5Password" autoComplete="off" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Risk per trade</span>
          <select name="riskPct" defaultValue={riskPct} className={field}>
            {RISK_TIERS.map((tier) => (
              <option key={tier.pct} value={tier.pct}>
                {tier.label} · {tier.pct}%
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Lot is calculated from USD equity. UGX balances are converted to USD
            first. Gold is skipped if USD equity is under ${GOLD_MIN_EQUITY_USD}.
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Symbol suffix</span>
          <input name="symbolSuffix" defaultValue={symbolSuffix} placeholder="m  or  .pro" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Max slippage</span>
          <input name="deviation" defaultValue={deviation} inputMode="numeric" className={field} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-[#e0b422]">
            Portable terminal64.exe path (optional)
          </span>
          <input
            name="terminalPath"
            defaultValue={terminalPath}
            placeholder="D:\MT5-Account2\terminal64.exe"
            className={field}
          />
          <span className="mt-1 block text-xs text-muted">
            Leave blank to use the MT5 window you already have open. Fill this only
            if this account has its own separate MT5 folder.
          </span>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-[#e0b422]">Admin password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          defaultValue="exnessfxbot-admin"
          className={field}
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black"
      >
        {isNew ? "Add MT5 account" : "Save this account"}
      </button>
    </form>
    {canDelete ? (
      <form action="/api/admin/desk" method="post" className="px-4 pb-2">
        <input type="hidden" name="action" value="mt5Delete" />
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="password" value="exnessfxbot-admin" />
        <button type="submit" className="text-xs font-semibold text-sell underline">
          Remove this account
        </button>
      </form>
    ) : null}
    </div>
  );
}
