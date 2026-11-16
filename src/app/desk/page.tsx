import type { Metadata } from "next";
import { FibAutofill } from "@/components/FibAutofill";
import { DeskLiveBook } from "@/components/DeskLiveBook";
import { GOLD_MIN_EQUITY_USD, RISK_TIERS } from "@/lib/calc";
import { emptyMt5Account, lastMt5JobForSignal, publicMt5State } from "@/lib/mt5";
import { publicLiveSyncState } from "@/lib/live-sync";
import { publicTelegramState } from "@/lib/telegram";
import { PAIRS } from "@/lib/pairs";
import { isDeskUnlocked } from "@/lib/admin-session";
import { listActiveSignals, listDeskOrders, settleLiveOrders } from "@/lib/signals";

export const metadata: Metadata = {
  title: "Signal desk",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; ok?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const q = await searchParams;
  const unlocked = await isDeskUnlocked();
  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Signal desk</h1>
        <p className="mt-2 text-sm text-muted">
          Local desk password. This panel is not the site Admin and is not for production.
        </p>
        {q.error ? (
          <p className="mt-4 rounded-xl border border-red-400 bg-red-500/20 px-4 py-3 text-sm text-red-200">
            {q.error}
          </p>
        ) : null}
        <form
          action="/api/admin/desk"
          method="post"
          className="mt-8 space-y-4 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-6"
        >
          <input type="hidden" name="action" value="unlock" />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#e0b422]">Desk password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black"
          >
            Unlock desk
          </button>
        </form>
      </div>
    );
  }
  await settleLiveOrders();
  const pending = listActiveSignals();
  const orders = listDeskOrders();
  const jobs = Object.fromEntries(
    pending.map((s) => {
      const job = lastMt5JobForSignal(s.id);
      return [
        s.id,
        job ? { status: job.status, ticket: job.ticket, message: job.message } : null,
      ];
    })
  );
  const mt5 = publicMt5State();
  const telegram = publicTelegramState();
  const liveSync = publicLiveSyncState();
  const addSlot = mt5.accounts.length < mt5.maxAccounts ? emptyMt5Account(mt5.accounts.length) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Signal desk</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Fill SL, TP and Entry, then submit. This session stays unlocked for 12 hours.
          </p>
        </div>
        <form action="/api/admin/desk" method="post">
          <input type="hidden" name="action" value="lock" />
          <button type="submit" className="rounded-full border border-[#c9a227] px-4 py-2 text-sm text-[#e0b422]">
            Lock desk
          </button>
        </form>
      </div>

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
          Pick the pair, enter prices, then submit. That pairâ€™s
          card updates (premium now, regular in 10 minutes). The free Telegram
          channel {telegram.channel} gets an instant link to the card; regulars
          still wait 10 minutes for prices.
          Draw Fibonacci in MT5 and 0.5 fills Entry, 1.0 fills SL. Or place a manual limit/market with SL/TP — prices fill here and Submit only sends premium + website cards (no second MT5 open).
        </p>
        <p className="text-xs text-[#d4b84a]">
          Live site:{" "}
          {liveSync.pushEnabled
            ? `desk on this PC will push cards to ${liveSync.target}`
            : "off â€” after deploy, set LIVE_SITE_URL and LIVE_SYNC_SECRET in .env.local on this PC only"}
        </p>
        <p className="text-xs text-[#d4b84a]">
          Telegram {telegram.channel}:{" "}
          {telegram.tokenSet
            ? telegram.posterRunning
              ? `poster running Â· ${telegram.queued} waiting`
              : `${telegram.queued} waiting Â· poster idle until the next send`
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

        <input type="hidden" id="mt5Ticket" name="mt5Ticket" value="" />
        <input type="hidden" id="alreadyLive" name="alreadyLive" value="" />
        <label className="flex items-center gap-2 text-sm text-[#f3d56a]">
          <input id="openOnMt5" type="checkbox" name="openOnMt5" value="1" defaultChecked />
          Also open this trade on every enabled MT5 account
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
                  ? `${mt5.linkedCount} linked Â· ${mt5.enabledCount} armed Â· executor ${mt5.executorRunning ? "running" : "idle"} Â· click to expand (max ${mt5.maxAccounts})`
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
          reads live equity and converts it to USD first (UGX Ã· USDUGX, or the
          live USD/UGX rate if that symbol is missing). Lot size then uses that
          USD figure in the position-size calculator (USD equity Ã— risk % Ã· stop
          pips). A UGX balance is never treated as dollars. Accounts under ${GOLD_MIN_EQUITY_USD}{" "}
          skip gold and only take the other pairs. Accounts at ${GOLD_MIN_EQUITY_USD}+
          take every pair, including gold. Saving an account creates a private
          MT5 window for that login in the background: it logs in, turns Algo
          Trading on, and installs FibToDesk on the desk pairs. Starting the
          executor opens every linked account so they are ready for the next
          signal. Use the master password, not investor.
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
                  ? `${row.login} @ ${row.server} Â· ${row.balance ?? "â€”"}`
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
              enabled
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

      <DeskLiveBook
        initial={{
          pending,
          orders,
          jobs,
          mt5: {
            executorRunning: mt5.executorRunning,
            executorStale: mt5.executorStale,
            status: mt5.status,
            pnl: mt5.pnl,
            jobs: mt5.jobs,
          },
        }}
      />
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
            Password {hasPassword ? "(saved â€” leave blank to keep)" : ""}
          </span>
          <input type="password" name="mt5Password" autoComplete="off" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Risk per trade</span>
          <select name="riskPct" defaultValue={riskPct} className={field}>
            {RISK_TIERS.map((tier) => (
              <option key={tier.pct} value={tier.pct}>
                {tier.label} Â· {tier.pct}%
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
            Private MT5 window
          </span>
          <input
            name="terminalPath"
            defaultValue={terminalPath}
            placeholder="created automatically on save"
            className={field}
          />
          <span className="mt-1 block text-xs text-muted">
            Leave this blank. The desk creates and opens a dedicated terminal for
            this login when you save.
          </span>
        </label>
      </div>
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
        <button type="submit" className="text-xs font-semibold text-sell underline">
          Remove this account
        </button>
      </form>
    ) : null}
    </div>
  );
}
