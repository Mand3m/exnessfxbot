"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PAIRS } from "@/lib/pairs";
import type { PairId } from "@/lib/pairs";
import type { RecentResults } from "@/lib/signals";

const PROFIT_H = 168;
const NUM_H = 36;
const AXIS_H = 92;
const LOSS_H = 168;
const COL_W = 26;
const DATE_W = 22;
const BAR_W = 20;
const GREEN = "#78d978";
const PINK = "#e9a8b8";

type Col =
  | { kind: "date"; key: string; label: string }
  | { kind: "trade"; key: string; label: string; pips: number };

function pipLabel(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function colWidth(col: Col) {
  return col.kind === "date" ? DATE_W : COL_W;
}

function colsWidth(cols: Col[]) {
  return cols.reduce((sum, col) => sum + colWidth(col), 0);
}

/** Keep the newest columns that fit; drop oldest from the left. */
function newestFit(cols: Col[], maxPx: number): Col[] {
  if (cols.length === 0) return cols;
  if (maxPx <= 0) return [];
  if (colsWidth(cols) <= maxPx) return cols;
  let i = 0;
  while (i < cols.length && colsWidth(cols.slice(i)) > maxPx) i += 1;
  let cut = cols.slice(i);
  while (cut[0]?.kind === "date" && cut[1]?.kind !== "trade") cut = cut.slice(1);
  return cut;
}

export function ResultsTracker({
  data,
  title = "Recent Results",
  lockPair,
}: {
  data: RecentResults;
  title?: string;
  lockPair?: PairId;
}) {
  const [focus, setFocus] = useState<"ALL" | PairId>(lockPair || "ALL");
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotW, setPlotW] = useState(0);

  const cols = useMemo(() => {
    const out: Col[] = [];
    data.days.forEach((day) => {
      const trades = (day.trades || []).filter((t) =>
        focus === "ALL" ? t.pips !== 0 : t.pair === focus && t.pips !== 0
      );
      if (!trades.length && focus !== "ALL") {
        const pips = day.pairs[focus] || 0;
        if (!pips) return;
        const pair = PAIRS.find((p) => p.id === focus);
        out.push({ kind: "date", key: `d-${day.day}`, label: day.label });
        out.push({
          kind: "trade",
          key: `${day.day}-${focus}`,
          label: pair?.label || focus,
          pips,
        });
        return;
      }
      if (!trades.length) return;
      out.push({ kind: "date", key: `d-${day.day}`, label: day.label });
      trades.forEach((t, i) =>
        out.push({
          kind: "trade",
          key: `${t.id}-${i}`,
          label: t.label,
          pips: t.pips,
        })
      );
    });
    return out;
  }, [data.days, focus]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setPlotW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols.length]);

  const visible = useMemo(() => newestFit(cols, plotW), [cols, plotW]);

  const peak = useMemo(() => {
    const values = visible
      .filter((c): c is Extract<Col, { kind: "trade" }> => c.kind === "trade")
      .map((c) => Math.abs(c.pips));
    return Math.max(20, ...values, 0);
  }, [visible]);

  const tabs: Array<{ id: "ALL" | PairId; label: string }> = [
    { id: "ALL", label: "ALL" },
    ...PAIRS.map((p) => ({ id: p.id, label: p.label })),
  ];

  function barPct(pips: number) {
    return Math.max(4, Math.round((Math.abs(pips) / peak) * 100));
  }

  const plotH = PROFIT_H + NUM_H + AXIS_H + NUM_H + LOSS_H;
  const profitAxisTop = PROFIT_H + NUM_H;
  const lossAxisTop = PROFIT_H + NUM_H + AXIS_H;

  return (
    <section className="results-panel rounded-2xl border border-white/30 bg-transparent px-2 py-3 sm:px-4">
      <h2 className="text-center text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>

      {cols.length === 0 ? (
        <p className="mt-4 text-center text-sm text-white">No results yet.</p>
      ) : (
        <div className="mt-4 flex w-full">
          <div className="relative w-12 shrink-0 sm:w-14" style={{ height: plotH }}>
            <span className="absolute left-0 top-0 text-[11px] font-medium text-white/80">100%</span>
            <span
              className="results-profit absolute left-0 text-[13px] font-semibold"
              style={{ top: profitAxisTop - 2 }}
            >
              Profit
            </span>
            <span
              className="results-loss absolute left-0 text-[13px] font-semibold"
              style={{ top: lossAxisTop - 14 }}
            >
              Loss
            </span>
            <span className="absolute bottom-0 left-0 text-[11px] font-medium text-white/80">100%</span>
          </div>

          <div ref={plotRef} className="min-w-0 flex-1 overflow-hidden">
            <div className="relative w-full overflow-hidden" style={{ height: plotH }}>
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute right-0 left-0 border-t border-white/20" style={{ top: 0 }} />
                <div className="absolute right-0 left-0 border-t border-white/10" style={{ top: PROFIT_H / 2 }} />
                <div className="absolute right-0 left-0 border-t border-white/25" style={{ top: profitAxisTop }} />
                <div className="absolute right-0 left-0 border-t border-white/25" style={{ top: lossAxisTop }} />
                <div
                  className="absolute right-0 left-0 border-t border-white/10"
                  style={{ top: lossAxisTop + NUM_H + LOSS_H / 2 }}
                />
                <div className="absolute right-0 bottom-0 left-0 border-t border-white/20" />
              </div>

              <div className="relative flex h-full">
                {visible.map((col) => (
                  <div
                    key={col.key}
                    className="flex h-full shrink-0 flex-col items-center"
                    style={{ width: colWidth(col) }}
                  >
                    <div className="flex w-full items-end justify-center" style={{ height: PROFIT_H }}>
                      {col.kind === "trade" && col.pips > 0 ? (
                        <div
                          title={`${col.label} ${pipLabel(col.pips)} pips`}
                          style={{
                            width: BAR_W,
                            height: `${barPct(col.pips)}%`,
                            background: GREEN,
                          }}
                        />
                      ) : null}
                    </div>

                    <div className="flex items-center justify-center" style={{ height: NUM_H }}>
                      {col.kind === "trade" && col.pips > 0 ? (
                        <span
                          className="num text-[10px] font-bold leading-none tabular-nums"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                          {pipLabel(col.pips)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-center" style={{ height: AXIS_H }}>
                      <span
                        className={`leading-none ${
                          col.kind === "date" ? "text-[11px] font-bold" : "text-[10px] font-semibold"
                        }`}
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                      >
                        {col.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-center" style={{ height: NUM_H }}>
                      {col.kind === "trade" && col.pips < 0 ? (
                        <span
                          className="num text-[10px] font-bold leading-none tabular-nums"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                          {pipLabel(col.pips)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex w-full items-start justify-center" style={{ height: LOSS_H }}>
                      {col.kind === "trade" && col.pips < 0 ? (
                        <div
                          title={`${col.label} ${col.pips} pips`}
                          style={{
                            width: BAR_W,
                            height: `${barPct(col.pips)}%`,
                            background: PINK,
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {lockPair ? null : (
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFocus(tab.id)}
            className={`min-h-8 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
              focus === tab.id
                ? "bg-[#e0b422] !text-black ring-[#e0b422]"
                : "bg-transparent text-white ring-white/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      )}
    </section>
  );
}
