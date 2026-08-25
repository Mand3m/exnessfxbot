import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { REGULAR_DELAY_MS } from "@/lib/constants";
import { getPair } from "@/lib/pairs";
import { getSignalById, settleLiveOrders } from "@/lib/signals";
import { AppFold } from "@/components/AppFold";
import { SignalCard } from "@/components/SignalCard";
import { isAndroidApp } from "@/lib/app-shell";

type Props = { params: Promise<{ id: string }> };

function unlockAt(publishedAt: string) {
  return new Date(Date.parse(publishedAt) + REGULAR_DELAY_MS).toISOString();
}

function pricesOpen(publishedAt: string, premium: boolean) {
  if (premium) return true;
  return Date.now() >= Date.parse(publishedAt) + REGULAR_DELAY_MS;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const signal = getSignalById(id);
  const pair = signal ? getPair(signal.pair) : null;
  const title = pair ? `${pair.label} Forex signal` : "Forex signal";
  const image = pair ? `/og/${pair.id}.png` : "/logo.jpg";
  return {
    title,
    description: `${title} from Forex Trading Consultants.`,
    openGraph: {
      title,
      description: `${title} from Forex Trading Consultants.`,
      images: [{ url: image, width: 1200, height: 400 }],
    },
  };
}

export default async function SignalPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const premium = session?.plan === "premium";
  const fold = await isAndroidApp();
  await settleLiveOrders();
  const signal = getSignalById(id);
  if (!signal) notFound();
  const pair = getPair(signal.pair);
  if (!pair) notFound();
  const liveAt = unlockAt(signal.publishedAt || signal.from);
  const unlocked = pricesOpen(signal.publishedAt || signal.from, premium);
  const when = new Date(signal.publishedAt || signal.from).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-[#e0b422] sm:text-4xl">
        {pair.label} Forex signal
      </h1>
      <p className="mt-2 text-center text-[#d4b84a]">{when}</p>

      <div className="mx-auto mt-8 max-w-md">
        <SignalCard
          pairId={pair.id}
          signal={unlocked ? signal : null}
          liveAt={unlocked ? null : liveAt}
          premium={premium}
          reloadOnUnlock
          lockMessage=""
        />
      </div>

      <section className="mx-auto mt-14 max-w-3xl">
        {fold ? (
          <AppFold title="Instructions">
            <div className="space-y-4 text-sm leading-relaxed text-muted">
              <p>
                Pending order should be placed as signal arrives (at “From” time). “Till”
                time is intended to forced exit. Any open trade is “Filled” when “Till”
                time is about to be reached. Any pending order is “Cancelled” when
                “Till” time is about to be reached. Use trailing-stop to maximize profit.
              </p>
              <p>
                Please keep in mind that different brokers give different quotes at a
                specific point of time. The difference is usually about 5 pips and
                perhaps more. To overcome this issue Forex Trading Consultants uses quotes from Exness broker. Nevertheless
                it’s possible that your trade reaches entry/take-profit/stop-loss level
                when a Forex Trading Consultants trade doesn’t and vice versa due to quote difference.
              </p>
            </div>
          </AppFold>
        ) : (
          <>
            <h2 className="text-center text-3xl font-semibold text-[#e0b422]">Instructions</h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
              <p>
                Pending order should be placed as signal arrives (at “From” time). “Till”
                time is intended to forced exit. Any open trade is “Filled” when “Till”
                time is about to be reached. Any pending order is “Cancelled” when
                “Till” time is about to be reached. Use trailing-stop to maximize profit.
              </p>
              <p>
                Please keep in mind that different brokers give different quotes at a
                specific point of time. The difference is usually about 5 pips and
                perhaps more. To overcome this issue Forex Trading Consultants uses quotes from Exness broker. Nevertheless
                it’s possible that your trade reaches entry/take-profit/stop-loss level
                when a Forex Trading Consultants trade doesn’t and vice versa due to quote difference.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
