"use client";

import { useMemo, useState } from "react";
import { PAIRS } from "@/lib/pairs";
import { RISK_TIERS, positionForRisk } from "@/lib/calc";

export function PositionCalculator({
  initialPair = "USDJPY",
  initialStop = 20,
}: {
  initialPair?: string;
  initialStop?: number;
}) {
  const [balance, setBalance] = useState(1000);
  const [pair, setPair] = useState(initialPair);
  const [stop, setStop] = useState(initialStop);

  const rows = useMemo(
    () =>
      RISK_TIERS.map((tier) => ({
        ...tier,
        ...positionForRisk(balance, stop, pair, tier.pct),
      })),
    [balance, stop, pair]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Account balance (USD)</span>
          <input
            type="number"
            min={50}
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value) || 0)}
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Currency pair</span>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
          >
            {PAIRS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Stop loss (pips)</span>
          <input
            type="number"
            min={1}
            value={stop}
            onChange={(e) => setStop(Number(e.target.value) || 0)}
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <article key={row.pct} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {row.label}{" "}
                <span className="text-sm font-normal text-muted">· {row.pct}% per trade</span>
              </h3>
              <p className="num text-sm text-muted">
                After 10 losses: ${row.after10.toFixed(0)} ({row.remainingPct.toFixed(0)}% left)
              </p>
            </div>
            <p className="num mt-2 text-2xl font-semibold">{row.units.toLocaleString()} units</p>
            <p className="mt-1 text-sm text-muted">
              {row.lots.toFixed(2)} lots = {row.mini.toFixed(1)} mini = {row.micro.toFixed(0)} micro
              {" · "}
              ${row.atRisk.toFixed(0)} at risk = ${row.perPip.toFixed(1)} / pip
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
