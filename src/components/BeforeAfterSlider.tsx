"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

type BeforeAfterSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  caption?: string;
  compact?: boolean;
};

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = "Chart before",
  afterAlt = "Chart after",
  caption,
  compact = false,
}: BeforeAfterSliderProps) {
  const [pos, setPos] = useState(50);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, next)));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <figure className={compact ? "w-full" : "mx-auto w-full max-w-4xl"}>
      <div
        ref={frameRef}
        className={
          compact
            ? "relative aspect-[5/4] w-full cursor-ew-resize touch-none overflow-hidden rounded-xl border border-[#c9a227]/40 bg-[#0c0a08] select-none"
            : "relative aspect-[16/10] w-full cursor-ew-resize touch-none overflow-hidden rounded-2xl border border-[#c9a227]/50 bg-black select-none"
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={caption || "Before and after chart comparison"}
      >
        <Image
          src={afterSrc}
          alt={afterAlt}
          fill
          sizes={compact ? "280px" : "(max-width: 896px) 100vw, 896px"}
          className="object-contain object-center p-0.5"
          draggable={false}
        />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <Image
            src={beforeSrc}
            alt={beforeAlt}
            fill
            sizes={compact ? "280px" : "(max-width: 896px) 100vw, 896px"}
            className="object-contain object-center p-0.5"
            draggable={false}
          />
        </div>
        <div
          className={
            compact
              ? "pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-[#FFD700]"
              : "pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-[#FFD700]"
          }
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div
            className={
              compact
                ? "absolute top-1/2 left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFD700] bg-black shadow"
                : "absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFD700] bg-black shadow-lg"
            }
          />
        </div>
      </div>
      {caption ? (
        <figcaption
          className={
            compact
              ? "mt-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-[#d4b84a]"
              : "mt-3 text-center text-xs uppercase tracking-[0.22em] text-[#d4b84a]"
          }
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}