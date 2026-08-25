import type { Metadata } from "next";
import { PositionCalculator } from "@/components/PositionCalculator";
import { SiteBasics } from "@/components/SiteBasics";

export const metadata: Metadata = { title: "Position size calculator" };

type Props = { searchParams: Promise<{ pair?: string; stoploss?: string }> };

export default async function CalculatorPage({ searchParams }: Props) {
  const q = await searchParams;
  const pair = q.pair || "USDJPY";
  const stop = Number(q.stoploss) || 20;

  return (
    <>
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">Tools</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Position size calculator</h1>
      <p className="mt-3 text-muted">
        Size the trade from account balance, pair, and stop-loss pips. Each
        tier shows what ten losses in a row would leave you.
      </p>
      <div className="mt-8">
        <PositionCalculator initialPair={pair} initialStop={stop} />
      </div>
    </div>
    <SiteBasics />
    </>
  );
}
