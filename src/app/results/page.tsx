import type { Metadata } from "next";
import { MonthlySummary } from "@/components/MonthlySummary";
import { SiteBasics } from "@/components/SiteBasics";
import { dayPipTotal, listMonthly, monthPipTotal, settleLiveOrders } from "@/lib/signals";

export const metadata: Metadata = { title: "Results" };
export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  await settleLiveOrders();
  const monthly = listMonthly();
  const today = dayPipTotal();
  const month = monthPipTotal();

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Track record</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Recent results</h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted">Today · to midnight EAT</p>
            <p className={`num mt-1 text-3xl font-semibold ${today >= 0 ? "text-buy" : "text-sell"}`}>
              {today > 0 ? "+" : ""}
              {today}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted">Month-to-date</p>
            <p className={`num mt-1 text-3xl font-semibold ${month >= 0 ? "text-buy" : "text-sell"}`}>
              {month > 0 ? "+" : ""}
              {month}
            </p>
          </div>
        </div>

        <div className="mt-12">
          <MonthlySummary rows={monthly} />
        </div>
      </div>
      <SiteBasics />
    </>
  );
}
