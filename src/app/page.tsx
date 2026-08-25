import { SignalsBoard } from "@/components/SignalsBoard";
import { SiteBasics } from "@/components/SiteBasics";
import { isAndroidApp } from "@/lib/app-shell";
import { getSession } from "@/lib/auth";
import { listBoard, listMonthly, listRecentResults, settleLiveOrders } from "@/lib/signals";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const premium = session?.plan === "premium";
  const fold = await isAndroidApp();
  await settleLiveOrders();
  const board = listBoard({ premium });
  const recent = listRecentResults();
  const monthly = listMonthly();

  return (
    <>
      {fold ? (
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

      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
        <SignalsBoard
          initial={board}
          premium={premium}
          initialRecent={recent}
          initialMonthly={monthly}
          fold={fold}
        />
      </section>

      <section className="border-t border-border">
        <SiteBasics />
      </section>
    </>
  );
}
