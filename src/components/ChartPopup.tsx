"use client";

import { useEffect, useMemo, useState } from "react";
import { PAIRS, formatPrice, getPair, pipsBetween } from "@/lib/pairs";
import type { Signal } from "@/lib/signals";

export type ChartOpenDetail = {
  pairId: string;
  signal: Signal | null;
};

function liveSignal(signal: Signal | null | undefined): Signal | null {
  return signal && signal.status === "active" ? signal : null;
}

export function openChart(detail: ChartOpenDetail) {
  window.dispatchEvent(
    new CustomEvent("exnessfx-chart", {
      detail: { pairId: detail.pairId, signal: liveSignal(detail.signal) },
    })
  );
}

export function ChartHost() {
  const [open, setOpen] = useState(false);
  const [pairId, setPairId] = useState("USDJPY");
  const [signal, setSignal] = useState<Signal | null>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const ev = e as CustomEvent<ChartOpenDetail>;
      setPairId(ev.detail.pairId);
      setSignal(liveSignal(ev.detail.signal));
      setOpen(true);
      if (!liveSignal(ev.detail.signal)) {
        fetch("/api/signals")
          .then((r) => r.json())
          .then((j) => {
            const card = Array.isArray(j.board)
              ? j.board.find((c: { pair: string }) => c.pair === ev.detail.pairId)
              : null;
            setSignal(liveSignal(card?.signal));
          })
          .catch(() => {});
      }
    }
    window.addEventListener("exnessfx-chart", onOpen);
    return () => window.removeEventListener("exnessfx-chart", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function pull() {
      fetch("/api/signals")
        .then((r) => r.json())
        .then((j) => {
          const card = Array.isArray(j.board)
            ? j.board.find((c: { pair: string }) => c.pair === pairId)
            : null;
          setSignal(liveSignal(card?.signal));
        })
        .catch(() => {});
    }
    pull();
    const t = setInterval(pull, 4000);
    return () => clearInterval(t);
  }, [open, pairId]);

  if (!open) return null;

  return (
    <ChartPopup
      pairId={pairId}
      signal={signal}
      onClose={() => setOpen(false)}
      onPair={(id) => {
        setPairId(id);
        setSignal(null);
        fetch("/api/signals")
          .then((r) => r.json())
          .then((j) => {
            const card = Array.isArray(j.board)
              ? j.board.find((c: { pair: string }) => c.pair === id)
              : null;
            setSignal(liveSignal(card?.signal));
          })
          .catch(() => {});
      }}
    />
  );
}

function ChartPopup({
  pairId,
  signal,
  onClose,
  onPair,
}: {
  pairId: string;
  signal: Signal | null;
  onClose: () => void;
  onPair: (id: string) => void;
}) {
  const pair = getPair(pairId) || PAIRS[0];
  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol: pair.tvSymbol,
      interval: "5",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbarbg: "0a0a0a",
      hideideas: "1",
      withdateranges: "1",
      hide_side_toolbar: "0",
      allow_symbol_change: "0",
      saveimage: "1",
    });
    return "https://s.tradingview.com/widgetembed/?" + params.toString();
  }, [pair.tvSymbol]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/80 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border-[#c9a227] bg-black shadow-2xl sm:h-[90vh] sm:rounded-2xl sm:border-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-[#c9a227] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#d4b84a]">5 minute chart</p>
              <h2 className="text-lg font-semibold text-[#e0b422]">
                {pair.baseFlag} {pair.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[#e0b422] px-3 text-sm font-semibold !text-black sm:hidden"
            >
              Close
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PAIRS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPair(p.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
                  p.id === pair.id
                    ? "bg-[#e0b422] !text-black"
                    : "border border-[#c9a227] text-[#e0b422]"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              className="hidden shrink-0 rounded-full bg-[#e0b422] px-3 py-2 text-xs font-semibold !text-black sm:inline-flex"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_240px]">
          <iframe
            key={pair.tvSymbol}
            title={`${pair.label} 5 minute TradingView chart`}
            src={src}
            className="h-full min-h-[240px] w-full border-0 sm:min-h-[360px]"
            allow="clipboard-write"
          />
          <PositionTool pairId={pair.id} signal={signal} />
        </div>
      </div>
    </div>
  );
}

function PositionTool({ pairId, signal }: { pairId: string; signal: Signal | null }) {
  const pair = getPair(pairId);
  if (!pair) return null;

  const live = liveSignal(signal);
  if (!live) {
    return (
      <aside className="border-t border-[#c9a227] p-4 lg:border-l lg:border-t-0">
        <p className="text-sm font-semibold text-[#e0b422]">Long / Short tool</p>
        <p className="mt-2 text-xs text-[#d4b84a]">
          No active desk levels for this pair. Publish Entry, SL and TP and they
          will draw here like TradingView’s long/short position tool.
        </p>
      </aside>
    );
  }

  const buy = live.side === "buy";
  const reward = pipsBetween(pair, live.entry, live.takeProfit);
  const risk = Math.max(1, pipsBetween(pair, live.entry, live.stopLoss));
  const rr = reward / risk;
  const rewardPct = Math.max(18, Math.min(72, (reward / (reward + risk)) * 100));
  const riskPct = 100 - rewardPct;

  return (
    <aside className="flex flex-col border-t border-[#c9a227] p-4 lg:border-l lg:border-t-0">
      <p className="text-sm font-semibold text-[#e0b422]">
        {buy ? "Long position" : "Short position"}
      </p>
      <p className="mt-1 text-xs text-[#d4b84a]">
        Auto levels from the live card · R:R 1 : {rr.toFixed(2)}
      </p>

      <div className="mt-4 flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-[#c9a227]">
        {buy ? (
          <>
            <LevelBand
              color="#089981"
              height={rewardPct}
              label="TP"
              price={formatPrice(pair, live.takeProfit)}
              extra={"+ " + reward + " pips"}
            />
            <EntryBand price={formatPrice(pair, live.entry)} side="Buy" />
            <LevelBand
              color="#f23645"
              height={riskPct}
              label="SL"
              price={formatPrice(pair, live.stopLoss)}
              extra={"− " + risk + " pips"}
            />
          </>
        ) : (
          <>
            <LevelBand
              color="#f23645"
              height={riskPct}
              label="SL"
              price={formatPrice(pair, live.stopLoss)}
              extra={"− " + risk + " pips"}
            />
            <EntryBand price={formatPrice(pair, live.entry)} side="Sell" />
            <LevelBand
              color="#089981"
              height={rewardPct}
              label="TP"
              price={formatPrice(pair, live.takeProfit)}
              extra={"+ " + reward + " pips"}
            />
          </>
        )}
      </div>
    </aside>
  );
}

function LevelBand({
  color,
  height,
  label,
  price,
  extra,
}: {
  color: string;
  height: number;
  label: string;
  price: string;
  extra: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 text-xs text-white"
      style={{ background: color, flexBasis: height + "%", flexGrow: 1 }}
    >
      <span className="font-semibold">{label}</span>
      <span className="num text-right">
        {price}
        <span className="mt-0.5 block text-[10px] opacity-80">{extra}</span>
      </span>
    </div>
  );
}

function EntryBand({ price, side }: { price: string; side: string }) {
  return (
    <div className="flex items-center justify-between bg-[#e0b422] px-3 py-2 text-xs font-semibold !text-black">
      <span>Entry · {side}</span>
      <span className="num">{price}</span>
    </div>
  );
}
