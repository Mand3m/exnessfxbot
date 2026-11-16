"use client";

import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";

const PHONE_FRACTAL_PAIRS = [
  {
    id: "01",
    beforeSrc: "/home/fractals/01-before.phone.webp",
    afterSrc: "/home/fractals/01-after.phone.webp",
    caption: "EURUSD",
  },
  {
    id: "03",
    beforeSrc: "/home/fractals/03-before.phone.webp",
    afterSrc: "/home/fractals/03-after.phone.webp",
    caption: "GBPJPY",
  },
] as const;

export function PhoneFractals() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div
        className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[radial-gradient(circle_at_center,_rgba(224,180,34,0.22),_transparent_70%)]"
        aria-hidden
      />
      <div className="relative rounded-[2.6rem] border-[3px] border-[#c9a227]/80 bg-[#12100c] p-2 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-[#3a3426] bg-black">
          <div className="absolute left-1/2 top-2 z-20 h-5 w-28 -translate-x-1/2 rounded-full bg-black/90" />
          <div className="flex min-h-[560px] flex-col justify-center gap-5 px-2.5 pb-8 pt-10">
            {PHONE_FRACTAL_PAIRS.map((pair) => (
              <BeforeAfterSlider
                key={pair.id}
                beforeSrc={pair.beforeSrc}
                afterSrc={pair.afterSrc}
                caption={pair.caption}
                compact
              />
            ))}
            <p className="text-center text-[10px] uppercase tracking-[0.2em] text-[#d4b84a]/80">
              Drag to compare
            </p>
          </div>
          <div className="absolute bottom-3 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-white/35" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs uppercase tracking-[0.28em] text-[#d4b84a]">
        Fractal before / after
      </p>
    </div>
  );
}