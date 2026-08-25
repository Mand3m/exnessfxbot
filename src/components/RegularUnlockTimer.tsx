"use client";

import { useEffect, useState } from "react";
import { REGULAR_DELAY_MS } from "@/lib/constants";

function clockFrom(ms: number) {
  const safe = Math.max(0, ms);
  const mins = Math.floor(safe / 60000);
  const secs = Math.floor((safe % 60000) / 1000);
  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

export function RegularUnlockTimer({ until, reloadOnEnd }: { until: string; reloadOnEnd?: boolean }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(new Date(until).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [until]);

  useEffect(() => {
    if (!reloadOnEnd || left === null || left > 0) return;
    const key = "unlock-" + until;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }, [left, reloadOnEnd, until]);

  const remaining = left ?? REGULAR_DELAY_MS;
  const pct = Math.max(0, Math.min(1, remaining / REGULAR_DELAY_MS));
  const size = 168;
  const cx = size / 2;
  const r = 64;
  const circ = 2 * Math.PI * r;
  const clock = clockFrom(remaining);
  const done = left !== null && left <= 0;

  return (
    <div className="mt-4 flex flex-col items-center py-1 sm:mt-6 sm:py-2">
      <div className="relative scale-90 sm:scale-100" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="#3a3420" strokeWidth="12" />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="#e0b422"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/logo.jpg"
            alt=""
            width={88}
            height={88}
            className={`h-[88px] w-[88px] rounded-full object-cover ring-2 ring-[#e0b422] ${
              done ? "" : "animate-[spin_8s_linear_infinite]"
            }`}
          />
        </div>
      </div>
      <p className="mt-4 text-sm text-white">
        {done ? (
          <span className="font-semibold text-white">Unlocked</span>
        ) : (
          <>
            Free access in <span className="num font-semibold text-white">{clock}</span>
          </>
        )}
      </p>
    </div>
  );
}
