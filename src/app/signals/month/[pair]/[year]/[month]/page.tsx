import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsTracker } from "@/components/ResultsTracker";
import { formatPrice, pairFromSlug } from "@/lib/pairs";
import { isEntered, listMonthPairResults, listMonthPairSignals, settleLiveOrders } from "@/lib/signals";
import { eatMonthKey, formatArchiveWhen, isEatMonthClosed } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ pair: string; year: string; month: string }> };

function parseMonth(year: string, month: string) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2020 || y > 2100) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return { y, m };
}

function monthTitle(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 2)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function stateLabel(status: string, entered: boolean) {
  if (status === "filled") return "Filled";
  if (status === "cancelled") return "Cancelled";
  return entered ? "Active" : "Pending";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair: slug, year, month } = await params;
  const pair = pairFromSlug(slug);
  const parsed = parseMonth(year, month);
  if (!pair || !parsed) return { title: "Monthly signals" };
  const when = monthTitle(parsed.y, parsed.m);
  const title = `${pair.label} Forex signals, ${when}`;
  return {
    title,
    description: `${title} from Forex Trading Consultants.`,
  };
}

export default async function MonthPairPage({ params }: Props) {
  const { pair: slug, year, month } = await params;
  const pair = pairFromSlug(slug);
  const parsed = parseMonth(year, month);
  if (!pair || !parsed) notFound();
  const when = monthTitle(parsed.y, parsed.m);
  const closed = isEatMonthClosed(eatMonthKey(parsed.y, parsed.m));
  if (!closed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm text-white">
          <Link href="/" className="underline underline-offset-4">
            Home
          </Link>
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
          {pair.label} Forex signals, {when}
        </h1>
        <p className="mt-4 text-sm text-white">
          This month is still running. Pair results open when the month ends.
        </p>
      </div>
    );
  }
  await settleLiveOrders();
  const rows = listMonthPairSignals(pair.id, parsed.y, parsed.m);
  const chart = listMonthPairResults(pair.id, parsed.y, parsed.m);
  const filledPips = rows.reduce((sum, s) => sum + (s.status === "filled" && typeof s.pips === "number" ? s.pips : 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-sm text-white">
        <Link href="/" className="underline underline-offset-4">
          Home
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
        {pair.label} Forex signals, {when}
      </h1>
      <p className="mt-2 text-sm text-white">
        Filled pips{" "}
        <span className="num font-semibold">
          {filledPips > 0 ? "+" : ""}
          {filledPips.toLocaleString()}
        </span>
      </p>

      <div className="mt-8">
        <ResultsTracker data={chart} title={`${pair.label} results`} lockPair={pair.id} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-white">No signals for {pair.label} in {when}.</p>
      ) : (
        <div className="results-panel mt-8 overflow-x-auto rounded-2xl border border-white/30">
          <table className="min-w-full text-left text-sm text-white">
            <thead className="text-xs uppercase">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Date, time</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Order</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Price</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Take Profit</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Stop Loss</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">State</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Entry</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Exit</th>
                <th className="whitespace-nowrap px-2 py-2 font-semibold sm:px-3">Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const filled = s.status === "filled";
                const profit = filled && typeof s.pips === "number" ? s.pips : null;
                return (
                  <tr key={s.id} className="border-t border-white/20">
                    <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                      {formatArchiveWhen(s.publishedAt || s.from)}
                    </td>
                    <td className="px-2 py-2 capitalize sm:px-3">{s.side}</td>
                    <td className="num px-2 py-2 sm:px-3">{formatPrice(pair, s.entry)}</td>
                    <td className="num px-2 py-2 sm:px-3">{formatPrice(pair, s.takeProfit)}</td>
                    <td className="num px-2 py-2 sm:px-3">{formatPrice(pair, s.stopLoss)}</td>
                    <td className="px-2 py-2 sm:px-3">{stateLabel(s.status, isEntered(s))}</td>
                    <td className="num px-2 py-2 sm:px-3">
                      {filled && s.filledEntry != null ? formatPrice(pair, s.filledEntry) : "—"}
                    </td>
                    <td className="num px-2 py-2 sm:px-3">
                      {filled && s.filledExit != null ? formatPrice(pair, s.filledExit) : "—"}
                    </td>
                    <td className="num px-2 py-2 font-semibold sm:px-3">
                      {profit == null ? "—" : `${profit > 0 ? "+" : ""}${profit}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
