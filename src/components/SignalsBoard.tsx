"use client";

import { useEffect, useState } from "react";
import type { BoardCard, MonthlyRow, RecentResults } from "@/lib/signals";
import { MonthlySummary } from "./MonthlySummary";
import { ResultsTracker } from "./ResultsTracker";
import { SignalCard } from "./SignalCard";

export function SignalsBoard({
  initial,
  premium,
  initialRecent,
  initialMonthly,
  fold = false,
}: {
  initial: BoardCard[];
  premium: boolean;
  initialRecent: RecentResults;
  initialMonthly: MonthlyRow[];
  fold?: boolean;
}) {
  const [board, setBoard] = useState(initial);
  const [isPremium, setIsPremium] = useState(premium);
  const [dayPips, setDayPips] = useState(0);
  const [recent, setRecent] = useState(initialRecent);
  const [monthly, setMonthly] = useState(initialMonthly);

  useEffect(() => {
    const tick = () => {
      fetch("/api/signals")
        .then((r) => r.json())
        .then((j) => {
          if (j.ok && Array.isArray(j.board)) setBoard(j.board);
          if (typeof j.premium === "boolean") setIsPremium(j.premium);
          if (typeof j.dayPips === "number") setDayPips(j.dayPips);
          if (j.recent && Array.isArray(j.recent.days)) setRecent(j.recent);
          if (Array.isArray(j.monthly)) setMonthly(j.monthly);
        })
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
      <div className="monitor-frame">
        <div className="monitor-frame__inner">Algo-Sniper Bot Signals</div>
      </div>
      <div className={`grid grid-cols-1 ${fold ? "gap-2" : "gap-5 sm:grid-cols-2 sm:gap-6"}`}>
        {board.map((card) => (
          <SignalCard
            key={card.pair}
            pairId={card.pair}
            signal={card.signal}
            pending={card.pending}
            liveAt={card.liveAt}
            premium={isPremium}
            dayPips={dayPips}
            reloadOnUnlock
            fold={fold}
          />
        ))}
      </div>
      <ResultsTracker data={recent} />
      <MonthlySummary rows={monthly} />
    </div>
  );
}
