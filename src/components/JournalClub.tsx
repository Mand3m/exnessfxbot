import { JournalClubWaitlist } from "@/components/JournalClubWaitlist";

const POINTS = [
  {
    title: "The process",
    body: "Pro traders open their journal for the week: the setups they took, the ones they skipped, and why.",
  },
  {
    title: "The thinking",
    body: "Hear the reasoning before each entry: bias, levels, risk, and what would prove them wrong.",
  },
  {
    title: "The execution",
    body: "Entries, exits, trade management and the mistakes too, explained trade by trade.",
  },
  {
    title: "The mindset",
    body: "How pros keep calm through losing days, avoid revenge trades, and stay disciplined when it counts.",
  },
];

export function JournalClub() {
  return (
    <div className="bg-[#0c0a08] text-white">
      <section className="relative overflow-hidden border-b border-[#c9a227]/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(224,180,34,0.12),_transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="inline-flex rounded-full border border-[#c9a227] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#FFD700]">
            Coming soon
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
            Forex Traders&apos; Journal Club
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white sm:text-xl">
            A small weekly meeting where pro traders explain the process, thinking and execution of
            the trades they took that week. Beginners get a seat at the table to learn the pro
            mindset, and how experienced traders handle themselves emotionally and psychologically
            while the market moves.
          </p>
          <a
            href="#waitlist"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[#e0b422] px-6 py-2.5 text-sm font-semibold !text-black"
          >
            Join the waitlist
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 sm:px-6 sm:py-20 lg:grid-cols-4">
        {POINTS.map((p) => (
          <article key={p.title} className="rounded-3xl border border-[#c9a227] bg-black/70 px-5 py-6">
            <h2 className="text-xl font-semibold text-[#FFD700]">{p.title}</h2>
            <p className="mt-3 text-base leading-relaxed text-white">{p.body}</p>
          </article>
        ))}
      </section>

      <section id="waitlist" className="mx-auto max-w-xl scroll-mt-40 px-4 pb-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Save your seat</h2>
        <p className="mt-3 text-center text-base text-white">
          Sessions are kept small. Join the waitlist and we&apos;ll reach out by email or WhatsApp
          as soon as the first Journal Club dates are set.
        </p>
        <div className="mt-8">
          <JournalClubWaitlist />
        </div>
      </section>
    </div>
  );
}
