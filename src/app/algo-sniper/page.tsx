import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignalsBoard } from "@/components/SignalsBoard";
import { SiteBasics } from "@/components/SiteBasics";
import { isAndroidApp } from "@/lib/app-shell";
import { getSession } from "@/lib/auth";
import { listBoard, listMonthly, listRecentResults, settleLiveOrders } from "@/lib/signals";
import { ALGO_SNIPER_SHARE_URL, SHOW_ALGO_SNIPER, SHOW_PREMIUM } from "@/lib/site";

export const metadata: Metadata = {
  title: "Algo-Sniper Bot signals",
  description: "Algo-Sniper Bot signals desk — coming soon.",
  alternates: { canonical: ALGO_SNIPER_SHARE_URL },
};

export const dynamic = "force-dynamic";

export default async function AlgoSniperPage() {
  if (!SHOW_ALGO_SNIPER) redirect("/");
  const session = await getSession();
  const premium = session?.plan === "premium";
  const fold = await isAndroidApp();
  await settleLiveOrders();
  const board = listBoard({ premium });
  const recent = listRecentResults();
  const monthly = listMonthly();

  return (
    <>
      <section className="border-b border-[#c9a227] bg-[#e0b422]">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] !text-black">Algo-Sniper Bot</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight !text-black sm:text-3xl">
            Coming soon
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm !text-black/80">
            This tab holds the Algo-Sniper Bot signals desk while we finish the next release. The board
            below is preserved for the rollout.
          </p>
        </div>
      </section>

      {fold && SHOW_PREMIUM ? (
        <section className="border-b border-border">
          <div className="mx-auto flex max-w-3xl justify-center px-4 py-4">
            <a
              href="/premium#pay"
              className="inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-full bg-[#e0b422] px-6 py-2.5 text-sm font-semibold !text-black"
            >
              Subscribe to Algo-Sniper Bot
            </a>
          </div>
        </section>
      ) : null}

      <section className="relative mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute inset-x-3 top-6 z-10 flex justify-center sm:inset-x-6 sm:top-10">
          <div className="rounded-full border border-[#c9a227] bg-black/85 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FFD700] shadow-lg">
            Coming soon | Algo-Sniper Bot signals
          </div>
        </div>
        <div className="opacity-70">
          <SignalsBoard
            initial={board}
            premium={premium}
            initialRecent={recent}
            initialMonthly={monthly}
            fold={fold}
          />
        </div>
      </section>

      <section className="border-t border-border">
        <SiteBasics />
      </section>
    </>
  );
}