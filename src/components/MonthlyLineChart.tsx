"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { RecentResults } from "@/lib/signals";

const W = 800;
const H = 280;
const PAD = { top: 22, right: 28, bottom: 40, left: 52 };
const LINE = "#e0b422";
const FILL = "rgba(224, 180, 34, 0.16)";
const DOT = "#78d978";
const DOT_LOSS = "#e9a8b8";

type DayPoint = {
  day: string;
  label: string;
  pips: number;
  cumulative: number;
};

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dayLabel(year: number, month: number, d: number) {
  const dt = new Date(Date.UTC(year, month - 1, d, 12));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(dt);
}

function niceScale(min: number, max: number, tickCount = 5) {
  const lo = Math.min(min, 0);
  const hi = Math.max(max, 0);
  const span = hi - lo || 40;
  const pad = span * 0.14;
  let domainMin = lo < 0 ? lo - pad : Math.min(lo, 0);
  let domainMax = hi > 0 ? hi + pad : Math.max(hi, 0);
  if (domainMin === domainMax) {
    domainMin -= 20;
    domainMax += 20;
  }
  const raw = (domainMax - domainMin) / tickCount;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const niceStep = [1, 2, 2.5, 5, 10].map((n) => n * mag).find((n) => n >= raw) || raw;
  const start = Math.floor(domainMin / niceStep) * niceStep;
  const end = Math.ceil(domainMax / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= end + niceStep / 2; v += niceStep) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { min: start, max: end, ticks };
}

function pipText(n: number) {
  if (n > 0) return `+${n.toLocaleString()}`;
  return n.toLocaleString();
}

function innerBox() {
  return {
    x: PAD.left,
    y: PAD.top,
    w: W - PAD.left - PAD.right,
    h: H - PAD.top - PAD.bottom,
  };
}

export function MonthlyLineChart({
  data,
  title,
  year,
  month,
}: {
  data: RecentResults;
  title: string;
  year: number;
  month: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo<DayPoint[]>(() => {
    const byDay = new Map(data.days.map((d) => [d.day, d.total]));
    const last = daysInMonth(year, month);
    let running = 0;
    const out: DayPoint[] = [];
    for (let d = 1; d <= last; d++) {
      const key = `${year}-${pad2(month)}-${pad2(d)}`;
      const pips = byDay.get(key) || 0;
      running += pips;
      out.push({
        day: key,
        label: dayLabel(year, month, d),
        pips,
        cumulative: running,
      });
    }
    return out;
  }, [data.days, year, month]);

  const hasTrades = points.some((p) => p.pips !== 0);
  const scale = useMemo(() => {
    const values = points.map((p) => p.cumulative);
    return niceScale(Math.min(0, ...values), Math.max(0, ...values));
  }, [points]);

  const box = innerBox();
  const n = points.length;
  const xAt = (i: number) => box.x + (n <= 1 ? box.w / 2 : (i / (n - 1)) * box.w);
  const yAt = (v: number) => {
    const span = scale.max - scale.min || 1;
    return box.y + ((scale.max - v) / span) * box.h;
  };

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.cumulative).toFixed(2)}`)
    .join(" ");
  const yZero = yAt(0);
  const areaPath = `${linePath} L ${xAt(n - 1).toFixed(2)} ${yZero.toFixed(2)} L ${xAt(0).toFixed(2)} ${yZero.toFixed(2)} Z`;

  const xTicks = useMemo(() => {
    if (n <= 8) return points.map((_, i) => i);
    const step = Math.max(1, Math.round((n - 1) / 6));
    const idxs = [0];
    for (let i = step; i < n - 1; i += step) idxs.push(i);
    if (idxs[idxs.length - 1] !== n - 1) idxs.push(n - 1);
    return idxs;
  }, [n, points]);

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < box.x || px > box.x + box.w) {
      setHover(null);
      return;
    }
    const t = n <= 1 ? 0 : (px - box.x) / box.w;
    setHover(Math.round(t * (n - 1)));
  }

  const active = hover != null ? points[hover] : null;
  const last = points[n - 1];

  return (
    <section className="results-panel rounded-2xl border border-white/30 bg-transparent px-2 py-3 sm:px-4">
      <h2 className="text-center text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      <p className="mt-1 text-center text-xs text-white/80">Cumulative pips</p>

      {!hasTrades ? (
        <p className="mt-4 text-center text-sm text-white">No results yet.</p>
      ) : (
        <div className="relative mt-3 w-full">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`${title} cumulative pip line chart`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            {scale.ticks.map((tick) => {
              const y = yAt(tick);
              const zero = tick === 0;
              return (
                <g key={tick}>
                  <line
                    x1={box.x}
                    x2={box.x + box.w}
                    y1={y}
                    y2={y}
                    stroke={zero ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)"}
                    strokeDasharray={zero ? undefined : "4 4"}
                  />
                  <text
                    x={box.x - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="num"
                    fill="#ffffff"
                    fontSize="11"
                  >
                    {pipText(tick)}
                  </text>
                </g>
              );
            })}

            <path d={areaPath} fill={FILL} />
            <path d={linePath} fill="none" stroke={LINE} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

            {points.map((p, i) =>
              p.pips !== 0 ? (
                <circle
                  key={p.day}
                  cx={xAt(i)}
                  cy={yAt(p.cumulative)}
                  r={hover === i ? 5 : 3.2}
                  fill={p.pips > 0 ? DOT : DOT_LOSS}
                  stroke="#16130e"
                  strokeWidth="1"
                />
              ) : null
            )}

            {xTicks.map((i) => (
              <text
                key={points[i].day}
                x={xAt(i)}
                y={H - 12}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
              >
                {points[i].label}
              </text>
            ))}

            {last ? (
              <text
                x={xAt(n - 1)}
                y={yAt(last.cumulative) - 10}
                textAnchor="end"
                fill="#ffd700"
                fontSize="12"
                fontWeight="600"
                className="num"
              >
                {pipText(last.cumulative)}
              </text>
            ) : null}

            {active && hover != null ? (
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={box.y}
                y2={box.y + box.h}
                stroke="rgba(255,255,255,0.35)"
                strokeDasharray="3 3"
              />
            ) : null}
          </svg>

          {active && hover != null ? (
            <div
              className="pointer-events-none absolute rounded-lg border border-white/25 bg-[#1c1812]/95 px-2.5 py-1.5 text-[11px] text-white shadow-lg"
              style={{
                left: `${(xAt(hover) / W) * 100}%`,
                top: 8,
                transform: hover > n * 0.7 ? "translateX(-108%)" : "translateX(8%)",
              }}
            >
              <p className="font-semibold">{active.label}</p>
              <p>
                Day{" "}
                <span className="num font-semibold">
                  {active.pips === 0 ? "0" : pipText(active.pips)}
                </span>
              </p>
              <p>
                Total{" "}
                <span className="num font-semibold">{pipText(active.cumulative)}</span>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
