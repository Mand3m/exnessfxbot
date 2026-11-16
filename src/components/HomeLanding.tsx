import Link from "next/link";
import { PhoneFractals } from "@/components/PhoneFractals";
import { MENTORSHIP_PATH, HUSTLE_LIFESTYLE_PATH } from "@/lib/site";

const PILLARS = [
  {
    n: "1",
    title: "Unknowing",
    body: "The financial markets move large amounts of money from the uninformed majority to the skilled minority, session in and session out. Many struggle for consistency in seemingly random markets - what if they are simply uninformed?",
  },
  {
    n: "2",
    title: "Money Trap",
    body: "We train traders to think like larger players and use how those players operate to avoid - and exploit - the money traps laid for the majority.",
  },
  {
    n: "3",
    title: "Vuja De",
    body: "A play on déjà vu: noticing something for the first time that has been there all along. We build deep familiarity with price fractals that repeat at different scales.",
  },
  {
    n: "4",
    title: "Psychology",
    body: "As hard as technicals may seem, the real battle is won and lost in the mind. We change how traders process pressure and emotion so they can hold a psychological edge.",
  },
  {
    n: "5",
    title: "Risk",
    body: "We explore risk systems that fit an overall method - and your personality. Maximise risk-to-reward, or apply pressure through strike rate?",
  },
  {
    n: "6",
    title: "Access",
    body: "Forex Trading Consultants is built to be reached from anywhere. Content and coaching live on the web so traders can connect, review, and execute with clarity.",
  },
  {
    n: "7",
    title: "Lift-Off",
    body: "A lot of this journey is reprogramming. We create an environment where traders rewire habits that work against them - so equity curves can lift off.",
  },
] as const;

const FEATURES = [
  {
    title: "The Language",
    body: "A clear trading syllabus presented through structured notes and walkthroughs you can revisit.",
  },
  {
    title: "Market Reviews",
    body: "Reviews of key levels and structure as we track how informed money is positioned.",
  },
  {
    title: "Live Coaching Paths",
    body: "Mentorship and beginner tracks that move from concepts to execution - not theory alone.",
  },
  {
    title: "Technical Perspectives",
    body: "Breakdowns of trades and levels that support both passive study and active practice.",
  },
  {
    title: "Information Desk",
    body: "Curated video resources for visitors who want context before they commit to a pack.",
  },
  {
    title: "Work The Numbers",
    body: "Risk frameworks and position sizing so skilled traders can cover ground with discipline.",
  },
] as const;


export function HomeLanding() {
  return (
    <div className="bg-[#0c0a08] text-white">
<section className="relative overflow-hidden border-b border-[#c9a227]/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(224,180,34,0.12),_transparent_55%)]" />
        <div className="relative mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#e0b422]">
            Forex Trading Consultants · The Culture
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[#FFD700] sm:text-6xl md:text-7xl">
            follow the money
          </h1>
          <p className="mt-6 max-w-xl text-lg italic text-[#d4b84a] sm:text-xl">
            “Even a rigged game is fun to play”
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={MENTORSHIP_PATH}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#e0b422] px-6 py-3 text-sm font-semibold !text-black"
            >
              Explore mentorship
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#FFD700] sm:text-4xl">
            how smart is your money?
          </h2>
          <p className="mt-3 text-sm uppercase tracking-[0.25em] text-[#d4b84a]">Mountain Life</p>
        </div>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)_minmax(0,1fr)] lg:gap-6 xl:gap-10">
          <ol className="order-2 space-y-4 lg:order-1">
            {PILLARS.slice(0, 4).map((item) => (
              <li
                key={item.n}
                className="grid gap-3 rounded-3xl border border-[#c9a227]/50 bg-black/50 p-5 sm:grid-cols-[3.25rem_1fr] sm:gap-5 sm:p-6"
              >
                <div className="text-3xl font-semibold text-[#e0b422]">{item.n}.</div>
                <div>
                  <h3 className="text-lg font-semibold text-[#FFD700] sm:text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#e8d9a8]">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="order-1 mx-auto w-full max-w-[320px] lg:order-2 lg:sticky lg:top-24 lg:mx-0">
            <PhoneFractals />
          </div>

          <ol className="order-3 space-y-4">
            {PILLARS.slice(4).map((item) => (
              <li
                key={item.n}
                className="grid gap-3 rounded-3xl border border-[#c9a227]/50 bg-black/50 p-5 sm:grid-cols-[3.25rem_1fr] sm:gap-5 sm:p-6"
              >
                <div className="text-3xl font-semibold text-[#e0b422]">{item.n}.</div>
                <div>
                  <h3 className="text-lg font-semibold text-[#FFD700] sm:text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#e8d9a8]">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-[#c9a227]/40 bg-black/40">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-center text-3xl font-semibold text-[#FFD700] sm:text-4xl">
            We&apos;re biased… build the edge anyway
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-[#d4b84a] sm:text-base">
            Forex Trading Consultants exists to shift traders from the psychology of the majority
            toward the habits of the skilled minority - structure, risk, and execution that can be
            repeated.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={HUSTLE_LIFESTYLE_PATH}
              className="rounded-full border border-[#c9a227] px-5 py-2.5 text-sm font-semibold text-[#FFD700] hover:bg-white/5"
            >
              Hustle Lifestyle
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-center text-3xl font-semibold text-[#FFD700] sm:text-4xl">What you get</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-3xl border border-[#c9a227]/50 bg-black/55 p-6"
            >
              <h3 className="text-lg font-semibold text-[#e0b422]">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#e8d9a8]">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#c9a227]/40">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-center text-3xl font-semibold text-[#FFD700] sm:text-4xl">
            Market direction?
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed text-[#d4b84a] sm:text-base">
            Market structure is foundational and commonly misconceived. Like footwork in any sport,
            the better your understanding of structure, the better your all-round game.
          </p>
          <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#e0b422]">
            Chapter 1 · Mentorship
          </p>

          <div className="mx-auto mt-12 max-w-xl">
            <article className="rounded-3xl border border-[#c9a227] bg-black/60 p-8 text-center">
              <h3 className="text-xl font-semibold text-[#FFD700]">Mentorship</h3>
              <p className="mt-2 text-sm text-[#d4b84a]">One-on-one coaching path</p>
              <p className="mt-6 text-4xl font-semibold text-[#f3d56a]">
                $300
                <span className="ml-2 text-base font-normal text-[#d4b84a]">/ 4 months</span>
              </p>
              <ul className="mt-6 space-y-2 text-left text-sm text-white">
                <li>Full coaching on analysis and execution</li>
                <li>A shift from majority psychology to skilled minority habits</li>
                <li>Access to mentorship materials after unlock</li>
                <li>Desk support while you repeat one simple method</li>
              </ul>
              <Link
                href={MENTORSHIP_PATH}
                className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#e0b422] px-5 py-3 text-base font-semibold !text-black"
              >
                Open mentorship
              </Link>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
