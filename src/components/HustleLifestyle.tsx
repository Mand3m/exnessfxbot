import Link from "next/link";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { MENTORSHIP_PATH } from "@/lib/site";

/** Before/after pairs from Desktop/fractals (earlier timestamp = before). */
export const FRACTAL_PAIRS: Array<{
  id: string;
  beforeSrc: string;
  afterSrc: string;
  caption?: string;
}> = [
  { id: "01", beforeSrc: "/home/fractals/01-before.webp", afterSrc: "/home/fractals/01-after.webp", caption: "EURUSD" },
  { id: "02", beforeSrc: "/home/fractals/02-before.webp", afterSrc: "/home/fractals/02-after.webp", caption: "EURUSD" },
  { id: "03", beforeSrc: "/home/fractals/03-before.webp", afterSrc: "/home/fractals/03-after.webp", caption: "GBPJPY" },
  { id: "04", beforeSrc: "/home/fractals/04-before.webp", afterSrc: "/home/fractals/04-after.webp", caption: "GBPJPY" },
  { id: "05", beforeSrc: "/home/fractals/05-before.webp", afterSrc: "/home/fractals/05-after.webp", caption: "GBPJPY" },
  { id: "06", beforeSrc: "/home/fractals/06-before.webp", afterSrc: "/home/fractals/06-after.webp", caption: "MNQ" },
  { id: "07", beforeSrc: "/home/fractals/07-before.webp", afterSrc: "/home/fractals/07-after.webp", caption: "MNQ" },
];

export function HustleLifestyle() {
  return (
    <section className="bg-[#0c0a08] text-white">
      <div className="relative overflow-hidden border-b border-[#c9a227]/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(224,180,34,0.12),_transparent_55%)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3 text-2xl" aria-hidden>
            <span>🗺️</span>
            <span>💎</span>
            <span>🔐</span>
            <span>💰</span>
            <span>👑</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-[#FFD700] sm:text-6xl">
            Hustle Lifestyle
          </h1>
          <div className="mt-4 text-2xl text-[#e0b422]" aria-hidden>
            ▲
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-[#d4b84a]">
            A visual look at how we do things
          </p>
        </div>
      </div>

      <div className="border-b border-[#c9a227]/40 bg-black/40">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0b422]">
            Pattern recon
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            <span className="font-normal text-[#e8d9a8]">The secret life of</span>
            <br />
            <span className="text-[#FFD700]">Fractals</span>
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#e8d9a8] sm:text-lg">
            A brief look at some of our favourite fractals, how they tend to behave and how we use
            them in the markets. Do we have similar styles or does this approach feel foreign to
            you?
          </p>

          <div className="mt-12 space-y-14">
            {FRACTAL_PAIRS.map((pair) => (
              <BeforeAfterSlider
                key={pair.id}
                beforeSrc={pair.beforeSrc}
                afterSrc={pair.afterSrc}
                caption={pair.caption}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-[#c9a227]/40">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0b422]">
            Once you see it
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#FFD700] sm:text-5xl">
            You Can&apos;t Unsee It
          </h2>
          <p className="mt-4 text-sm uppercase tracking-[0.25em] text-[#d4b84a]">
            A different perspective
          </p>
        </div>
      </div>

      <div>
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#e0b422]">Ready?</p>
          <Link
            href={MENTORSHIP_PATH}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#e0b422] px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] !text-black"
          >
            Join the network
            <span aria-hidden>✈</span>
          </Link>
          <p className="mt-4 text-xs text-[#d4b84a]">*The Hustle Is Sold Separately</p>
        </div>
      </div>
    </section>
  );
}