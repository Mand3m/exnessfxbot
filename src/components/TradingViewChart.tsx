"use client";

import { useMemo } from "react";
import { PAIRS, getPair, type PairId } from "@/lib/pairs";

export function TradingViewChart({
  pairId,
  height = 560,
}: {
  pairId: string;
  height?: number;
}) {
  const pair = getPair(pairId) || PAIRS[0];
  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol: pair.tvSymbol,
      interval: "15",
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
      studies: '["MASimple@tv-basicstudies"]',
    });
    return "https://s.tradingview.com/widgetembed/?" + params.toString();
  }, [pair.tvSymbol]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#c9a227] bg-black">
      <iframe
        key={pair.tvSymbol}
        title={`${pair.label} TradingView chart`}
        src={src}
        className="w-full border-0"
        style={{ height }}
        allow="clipboard-write"
      />
    </div>
  );
}

export function ChartPairTabs({
  current,
}: {
  current: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {PAIRS.map((p) => {
        const active = p.id === current;
        return (
          <a
            key={p.id}
            href={`/chart?pair=${p.id}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              active
                ? "bg-[#e0b422] !text-black"
                : "border border-[#c9a227] text-[#e0b422] hover:bg-[#e0b422]/15"
            }`}
          >
            {p.baseFlag} {p.label}
          </a>
        );
      })}
    </div>
  );
}

export function isPairId(id: string): id is PairId {
  return PAIRS.some((p) => p.id === id);
}
