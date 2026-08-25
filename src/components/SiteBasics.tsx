import Link from "next/link";
import { AppFold } from "@/components/AppFold";
import { isAndroidApp } from "@/lib/app-shell";
import { ARTICLES } from "@/lib/learn";

const ORDER = [
  "what-is-forex-trading",
  "best-forex-trading-strategies",
  "choosing-a-forex-broker",
  "developing-a-trading-plan",
  "using-forex-signals",
  "managing-risk",
  "improving-trading-psychology",
] as const;

const INSTRUCTIONS = (
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
);

const DISCLAIMER = (
  <div className="space-y-4 text-sm leading-relaxed text-muted">
    <p>
      Stocks, Options, Binary options, Forex and Future trading has large
      potential rewards, but also large potential risk. You must be aware of
      the risks and be willing to accept them in order to invest in the stock,
      binary options or futures markets. Don’t trade with money you can’t
      afford to lose especially with leveraged instruments such as binary
      options trading, futures trading or forex trading. This website is
      neither a solicitation nor an offer to Buy/Sell stocks, futures or
      options. No representation is being made that any account will or is
      likely to achieve profits or losses similar to those discussed on this
      website. The past performance of any trading system or methodology is
      not necessarily indicative of future results. You could lose all of
      your money fast due to: poor market trading conditions, mechanical
      error, emotional induced errors, news surprises and earnings releases.
    </p>
    <p className="text-xs uppercase leading-relaxed">
      CFTC RULE 4.41 — HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE
      CERTAIN LIMITATIONS. UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED
      RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE
      NOT BEEN EXECUTED, THE RESULTS MAY HAVE UNDER-OR-OVER COMPENSATED FOR
      THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF
      LIQUIDITY. SIMULATED TRADING PROGRAMS IN GENERAL ARE ALSO SUBJECT TO
      THE FACT THAT THEY ARE DESIGNED WITH THE BENEFIT OF HINDSIGHT. NO
      REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS LIKELY TO
      ACHIEVE PROFIT OR LOSSES SIMILAR TO THOSE SHOWN.
    </p>
  </div>
);

export async function SiteBasics() {
  const fold = await isAndroidApp();
  const links = ORDER.map((slug) => ARTICLES.find((a) => a.slug === slug)).filter(
    (a): a is (typeof ARTICLES)[number] => Boolean(a)
  );

  const basicsLinks = (
    <ul className={fold ? "space-y-1" : "mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 sm:mt-6 sm:gap-x-6 sm:gap-y-3"}>
      {links.map((a) => (
        <li key={a.slug}>
          <Link
            href={`/learn/${a.slug}`}
            className={fold ? "block rounded-lg px-2 py-2.5 text-sm underline underline-offset-4 hover:text-brand" : "text-sm underline underline-offset-4 hover:text-brand"}
          >
            {a.title}
          </Link>
        </li>
      ))}
      <li>
        <Link
          href="/tools/position-size"
          className={fold ? "block rounded-lg px-2 py-2.5 text-sm underline underline-offset-4 hover:text-brand" : "text-sm underline underline-offset-4 hover:text-brand"}
        >
          Position size calculator
        </Link>
      </li>
    </ul>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:space-y-10 sm:px-6 sm:py-12">
      {fold ? (
        <div className="mx-auto max-w-4xl space-y-3">
          <AppFold title="Forex Trading Basics">{basicsLinks}</AppFold>
          <AppFold title="Instructions">{INSTRUCTIONS}</AppFold>
          <AppFold title="Disclaimer">{DISCLAIMER}</AppFold>
          <a
            href="/premium#pay"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#e0b422] px-6 py-3 text-sm font-semibold !text-black"
          >
            Subscribe to Algo-Sniper Bot
          </a>
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card px-4 py-6 text-center sm:px-6 sm:py-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Forex Trading Basics</h2>
          {basicsLinks}
        </section>
      )}

      {fold ? null : (
        <>
          <section>
            <h2 className="text-center text-3xl font-semibold tracking-tight">Instructions</h2>
            <div className="mx-auto mt-5 max-w-4xl">{INSTRUCTIONS}</div>
          </section>
          <section>
            <h2 className="text-center text-3xl font-semibold tracking-tight">Disclaimer</h2>
            <div className="mx-auto mt-5 max-w-4xl">{DISCLAIMER}</div>
          </section>
        </>
      )}
    </div>
  );
}
