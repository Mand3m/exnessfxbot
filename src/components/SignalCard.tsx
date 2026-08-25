"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { openChart } from "@/components/ChartPopup";
import { RegularUnlockTimer } from "@/components/RegularUnlockTimer";
import { getPair, formatPrice, type Pair } from "@/lib/pairs";
import { isEntered } from "@/lib/signal-view";
import type { Signal } from "@/lib/signals";
import { formatWhen } from "@/lib/time";

function flagFile(code: string): string | null {
  if (code === "USD") return "/og/flags/us.png";
  if (code === "JPY") return "/og/flags/jp.png";
  if (code === "GBP") return "/og/flags/gb.png";
  return null;
}

function FlagCircle({
  src,
  emoji,
  className,
}: {
  src: string | null;
  emoji: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`h-8 w-8 rounded-full object-cover ring-2 ring-white ${className || ""}`}
      />
    );
  }
  return (
    <span
      className={`grid h-8 w-8 place-items-center rounded-full bg-zinc-200 text-base ring-2 ring-white ${className || ""}`}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

function OverlappingFlags({ pair }: { pair: Pair }) {
  return (
    <div className="relative h-8 w-[3.25rem] shrink-0">
      <FlagCircle src={flagFile(pair.base)} emoji={pair.baseFlag} className="absolute left-0 z-[1]" />
      <FlagCircle src={flagFile(pair.quote)} emoji={pair.quoteFlag} className="absolute left-[18px] z-[2]" />
    </div>
  );
}

function Heart({
  kind,
  light,
}: {
  kind: "profit" | "loss" | "buy" | "sell";
  light?: boolean;
}) {
  if (kind === "loss") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 fill-zinc-500" aria-label="Filled at a loss">
        <path d="M11.2 20.7 9.9 19.5C6.2 16.1 3.4 13.6 3.4 10.2c0-2.3 1.8-4.1 4.1-4.1 1.3 0 2.5.6 3.3 1.6L8.6 12l3.1 2.1-3.4 2.7 2.9 3.9Z" />
        <path d="M12.8 20.7 14.1 19.5C17.8 16.1 20.6 13.6 20.6 10.2c0-2.3-1.8-4.1-4.1-4.1-1.3 0-2.5.6-3.3 1.6L15.6 11.4 12.3 13.6l3.2 2.5-2.7 4.6Z" />
      </svg>
    );
  }
  const fill = light
    ? "fill-white"
    : kind === "profit" || kind === "buy"
      ? "fill-emerald-500"
      : "fill-red-500";
  return (
    <svg viewBox="0 0 24 24" className={`h-7 w-7 shrink-0 ${fill}`} aria-hidden>
      <path d="M12 21s-6.72-4.32-9.36-8.1C.72 10.2 1.2 6.6 4.2 5.16 6.36 4 8.64 4.8 12 8.16 15.36 4.8 17.64 4 19.8 5.16c3 1.44 3.48 5.04 1.56 7.74C18.72 16.68 12 21 12 21z" />
    </svg>
  );
}

function NotifyBell() {
  return (
    <span className="relative grid h-7 w-7 shrink-0 place-items-center" aria-label="Has a signal">
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#e0b422]" aria-hidden>
        <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-4H5a1 1 0 0 1-.8-1.6L6 13.5V9a6 6 0 1 1 12 0v4.5l1.8 2.9A1 1 0 0 1 19 18Z" />
      </svg>
      <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500" aria-hidden />
    </span>
  );
}

type CardTone = "plain" | "ghost" | "buy" | "sell";

function cardTone(signal: Signal): CardTone {
  if (signal.status === "filled" || signal.status === "cancelled") return "ghost";
  return signal.side === "buy" ? "buy" : "sell";
}

function CardShell({
  pair,
  fold,
  hasSignal,
  trailing,
  tone = "plain",
  children,
}: {
  pair: Pair;
  fold?: boolean;
  hasSignal: boolean;
  trailing?: ReactNode;
  tone?: CardTone;
  children: ReactNode;
}) {
  const light = tone !== "plain";
  const title = (
    <div className="flex min-w-0 items-center gap-2.5">
      <OverlappingFlags pair={pair} />
      <h2
        className={`truncate text-lg font-bold tracking-tight ${light ? "!text-white" : "!text-black"}`}
      >
        {pair.label}
      </h2>
    </div>
  );
  const shell =
    tone === "ghost"
      ? "signal-card-ghost overflow-hidden rounded-lg border border-white/30 bg-transparent text-white"
      : tone === "buy"
        ? "signal-card-buy overflow-hidden rounded-lg border border-emerald-300/50 bg-[#157a3a] text-white"
        : tone === "sell"
          ? "signal-card-sell overflow-hidden rounded-lg border border-red-300/50 bg-[#c43333]/60 text-white"
          : "overflow-hidden rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm";
  const head = light
    ? "flex items-center justify-between gap-2 bg-transparent px-3 py-2.5"
    : "flex items-center justify-between gap-2 bg-zinc-100 px-3 py-2.5";

  if (!fold) {
    return (
      <article className={`flex h-full flex-col ${shell}`}>
        <header className={head}>
          {title}
          {trailing || null}
        </header>
        {children}
      </article>
    );
  }

  return (
    <details className={`group ${shell}`}>
      <summary className={`${head} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        {title}
        <span className="flex shrink-0 items-center gap-1.5">
          {hasSignal ? <NotifyBell /> : null}
          <span
            className={`text-lg leading-none transition-transform group-open:rotate-180 ${light ? "text-white" : "text-[#e0b422]"}`}
            aria-hidden
          >
            ▾
          </span>
        </span>
      </summary>
      {children}
    </details>
  );
}

function DottedRow({
  label,
  value,
  valueClass,
  light,
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
  light?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-dotted py-1.5 text-sm ${
        light ? "border-white/40" : "border-zinc-400"
      }`}
    >
      <dt className={light ? "text-white" : "text-zinc-600"}>{label}</dt>
      <dd className={`num ${light ? "text-white" : "text-zinc-900"} ${valueClass || ""}`}>{value}</dd>
    </div>
  );
}

function statusHeading(signal: Signal) {
  if (signal.status === "cancelled") return "Cancelled";
  if (signal.status === "filled") return "Filled";
  if (!isEntered(signal)) return "Pending";
  return signal.side === "buy" ? "Active" : "Active";
}

export function SignalCard({
  pairId,
  signal,
  liveAt,
  premium,
  reloadOnUnlock,
  lockMessage,
  fold,
}: {
  pairId: string;
  signal: Signal | null;
  pending?: boolean;
  liveAt?: string | null;
  premium?: boolean;
  dayPips?: number;
  reloadOnUnlock?: boolean;
  lockMessage?: string;
  fold?: boolean;
}) {
  const pair = getPair(pairId);
  if (!pair) return null;
  const showTimer = !premium && Boolean(liveAt);
  const hasSignal = Boolean(liveAt) || signal?.status === "active";

  if (!signal || showTimer) {
    const waitText = showTimer
      ? lockMessage || ""
      : premium
        ? "No live prices on this card yet."
        : "Waiting for the desk to publish entry, take profit, and stop loss.";
    return (
      <CardShell pair={pair} fold={fold} hasSignal={hasSignal} tone="ghost">
        <div className="px-3 py-3 text-white">
          {waitText ? <p className="text-sm text-white">{waitText}</p> : null}
          {showTimer ? (
            <RegularUnlockTimer until={liveAt!} reloadOnEnd={reloadOnUnlock} />
          ) : (
            <button
              type="button"
              onClick={() => openChart({ pairId: pair.id, signal: null })}
              className="mt-3 text-sm text-white underline"
            >
              Open chart
            </button>
          )}
        </div>
      </CardShell>
    );
  }

  const slPips = Math.round(Math.abs(signal.entry - signal.stopLoss) / pair.pipSize);
  const pips = signal.pips || 0;
  const tone = cardTone(signal);
  const light = tone !== "plain";
  const heartKind =
    signal.status === "filled" ? (pips >= 0 ? "profit" : "loss") : signal.side === "buy" ? "buy" : "sell";
  const heart = <Heart kind={heartKind} light={tone === "buy" || tone === "sell"} />;

  return (
    <CardShell
      pair={pair}
      fold={fold}
      hasSignal={hasSignal}
      tone={tone}
      trailing={fold ? null : heart}
    >
      <div className={`px-3 pb-3 pt-1 ${light ? "text-white" : ""}`}>
        {fold ? <div className="flex justify-end pb-1">{heart}</div> : null}
        <dl>
          <DottedRow light={light} label="From" value={formatWhen(signal.from)} />
          <DottedRow light={light} label="Till" value={formatWhen(signal.till)} />
        </dl>

        <p
          className={`py-3 text-center text-lg font-semibold ${light ? "text-white" : "text-zinc-500"}`}
        >
          {statusHeading(signal)}
        </p>

        {signal.status === "filled" ? (
          <dl>
            <DottedRow
              light
              label={signal.side === "buy" ? "Bought at" : "Sold at"}
              value={formatPrice(pair, signal.filledEntry ?? signal.entry)}
            />
            <DottedRow
              light
              label={signal.side === "buy" ? "Sold at" : "Bought at"}
              value={formatPrice(pair, signal.filledExit ?? signal.takeProfit)}
            />
            <DottedRow
              light
              label={pips >= 0 ? "Profit, pips" : "Loss, pips"}
              value={`${pips > 0 ? "+" : ""}${pips}`}
              valueClass="font-semibold text-white"
            />
          </dl>
        ) : signal.status === "cancelled" ? null : (
          <>
            <dl>
              <DottedRow
                light
                label={signal.side === "buy" ? "Buy at" : "Sell at"}
                value={formatPrice(pair, signal.entry)}
              />
              <DottedRow light label="Take profit at" value={formatPrice(pair, signal.takeProfit)} />
              <DottedRow light label="Stop loss at" value={formatPrice(pair, signal.stopLoss)} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-white">
              <Link
                href={`/tools/position-size?pair=${pair.id}&stoploss=${slPips}`}
                className="underline underline-offset-4"
              >
                Position size · Calculate
              </Link>
              <button
                type="button"
                onClick={() =>
                  openChart({
                    pairId: pair.id,
                    signal: signal.status === "active" ? signal : null,
                  })
                }
                className="underline underline-offset-4"
              >
                Open chart
              </button>
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}
