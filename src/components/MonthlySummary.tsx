import Link from "next/link";
import { PAIRS, pairSlug } from "@/lib/pairs";
import type { MonthlyRow } from "@/lib/signals";
import { isEatMonthClosed } from "@/lib/time";

function monthParts(key: string) {
  const [year, month] = key.split("-");
  return { year, month };
}

export function MonthlySummary({ rows }: { rows: MonthlyRow[] }) {
  return (
    <section className="results-panel rounded-2xl border border-white/30 bg-transparent px-2 py-3 sm:px-4">
      <h2 className="text-center text-lg font-semibold tracking-tight sm:text-xl">
        Monthly summary (pips)
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-center text-sm text-white">No monthly totals yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-white">
            <thead className="text-xs uppercase">
              <tr>
                <th className="px-2 py-2 font-semibold sm:px-3">Month</th>
                <th className="px-2 py-2 font-semibold sm:px-3">Total</th>
                {PAIRS.map((p) => (
                  <th key={p.id} className="px-2 py-2 font-semibold sm:px-3">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { year, month } = monthParts(row.key);
                return (
                  <tr key={row.key} className="border-t border-white/20">
                    <td className="px-2 py-2.5 font-medium text-white sm:px-3">{row.label}</td>
                    <td className="num px-2 py-2.5 font-semibold text-white sm:px-3">
                      {row.totals.ALL > 0 ? "+" : ""}
                      {row.totals.ALL.toLocaleString()}
                    </td>
                    {PAIRS.map((p) => {
                      const n = row.totals[p.id] || 0;
                      const text = `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
                      const closed = isEatMonthClosed(row.key);
                      return (
                        <td key={p.id} className="num px-2 py-2.5 text-white sm:px-3">
                          {closed ? (
                            <Link
                              href={`/signals/month/${pairSlug(p.id)}/${year}/${month}`}
                              className="underline underline-offset-4 hover:text-[#FFD700]"
                            >
                              {text}
                            </Link>
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
