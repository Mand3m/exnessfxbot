#!/usr/bin/env python3
"""H1 3-bar range + fib 50% (M5 close) + M5 sweep scalps on XAUUSDz."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import MetaTrader5 as mt5
import numpy as np

SYMBOL = "XAUUSDz"
RISK_UGX = 20_000.0
REWARD_R = 3.0
SL_BUFFER_POINTS = 30
MIN_RISK_PRICE = 0.30
MAX_RISK_PRICE = 15.0
MAX_SPREAD_POINTS = 80
SEQ_HALT_R = 2.0
TRADE_FROM_HOUR = 4
TRADE_TO_HOUR = 20
NEWS_PAD_HOURS = 1
FROM_DT = datetime(2026, 1, 1)
TO_DT = datetime(2026, 9, 8)
PRELOAD_DT = datetime(2025, 12, 31)
TODAY_ONLY = False
OUT_DIR = Path(r"C:\Users\GEORGE\exnessfxbot\data")
BARS_DIR = None  # optional external M1/M5 CSV from Soft4fx etc.

NEWS = [
    ("2025-06-06 12:30", "USD NFP"),
    ("2025-06-11 12:30", "USD CPI"),
    ("2025-06-12 12:30", "USD PPI"),
    ("2025-06-18 18:00", "USD FOMC"),
    ("2025-06-27 12:30", "USD PCE"),
    ("2025-07-03 12:30", "USD NFP"),
    ("2025-07-15 12:30", "USD CPI"),
    ("2025-07-16 12:30", "USD PPI"),
    ("2025-07-30 18:00", "USD FOMC"),
    ("2025-07-31 12:30", "USD PCE"),
    ("2025-08-01 12:30", "USD NFP"),
    ("2025-08-12 12:30", "USD CPI"),
    ("2025-08-14 12:30", "USD PPI"),
    ("2025-08-29 12:30", "USD PCE"),
    ("2025-09-05 12:30", "USD NFP"),
    ("2025-09-10 12:30", "USD PPI"),
    ("2025-09-11 12:30", "USD CPI"),
    ("2025-09-17 18:00", "USD FOMC"),
    ("2025-09-26 12:30", "USD PCE"),
    ("2025-10-24 12:30", "USD CPI delayed"),
    ("2025-10-29 18:00", "USD FOMC"),
    ("2025-11-20 13:30", "USD NFP delayed"),
    ("2025-12-05 13:30", "USD PCE delayed"),
    ("2025-12-10 19:00", "USD FOMC"),
    ("2025-12-16 13:30", "USD NFP delayed"),
    ("2025-12-18 13:30", "USD CPI delayed"),
    ("2026-01-09 13:30", "USD NFP"),
    ("2026-01-13 13:30", "USD CPI"),
    ("2026-01-14 13:30", "USD PPI"),
    ("2026-01-28 19:00", "USD FOMC"),
    ("2026-01-30 13:30", "USD PCE"),
    ("2026-02-11 13:30", "USD NFP+CPI"),
    ("2026-02-12 13:30", "USD PPI"),
    ("2026-02-27 13:30", "USD PCE"),
    ("2026-03-06 13:30", "USD NFP"),
    ("2026-03-11 12:30", "USD CPI"),
    ("2026-03-12 12:30", "USD PPI"),
    ("2026-03-18 18:00", "USD FOMC"),
    ("2026-03-27 12:30", "USD PCE"),
    ("2026-04-03 12:30", "USD NFP"),
    ("2026-04-10 12:30", "USD CPI"),
    ("2026-04-14 12:30", "USD PPI"),
    ("2026-04-29 18:00", "USD FOMC"),
    ("2026-04-30 12:30", "USD PCE"),
    ("2026-05-08 12:30", "USD NFP"),
    ("2026-05-12 12:30", "USD CPI"),
    ("2026-05-13 12:30", "USD PPI"),
    ("2026-05-29 12:30", "USD PCE"),
    ("2026-06-05 12:30", "USD NFP"),
    ("2026-06-10 12:30", "USD CPI"),
    ("2026-06-11 12:30", "USD PPI"),
    ("2026-06-17 18:00", "USD FOMC"),
    ("2026-06-26 12:30", "USD PCE"),
    ("2026-07-02 12:30", "USD NFP"),
    ("2026-07-14 12:30", "USD CPI"),
    ("2026-07-15 12:30", "USD PPI"),
    ("2026-07-29 18:00", "USD FOMC"),
    ("2026-07-31 12:30", "USD PCE"),
    ("2026-08-03 14:00", "USD ISM Mfg"),
    ("2026-08-04 14:00", "USD JOLTS"),
    ("2026-08-05 12:15", "USD ADP"),
    ("2026-08-05 14:00", "USD ISM Svc"),
    ("2026-08-07 12:30", "USD NFP"),
    ("2026-08-12 12:30", "USD CPI"),
    ("2026-08-19 18:00", "USD FOMC minutes"),
    ("2026-08-26 12:30", "USD PCE/GDP"),
    ("2026-08-28 14:00", "USD Warsh JH"),
    ("2026-09-04 12:30", "USD NFP"),
]

EURUSD_NEWS = [
    ("2025-06-05 12:15", "EUR ECB"),
    ("2025-07-24 12:15", "EUR ECB"),
    ("2025-09-11 12:15", "EUR ECB"),
    ("2025-10-30 13:15", "EUR ECB"),
    ("2025-12-18 13:15", "EUR ECB"),
    ("2026-01-29 13:15", "EUR ECB"),
    ("2026-03-12 13:15", "EUR ECB"),
    ("2026-04-16 12:15", "EUR ECB"),
    ("2026-06-04 12:15", "EUR ECB"),
    ("2026-07-23 12:15", "EUR ECB"),
]

USDCAD_NEWS = [
    ("2026-01-21 15:00", "CAD BoC"),
    ("2026-03-11 14:00", "CAD BoC"),
    ("2026-04-15 14:00", "CAD BoC"),
    ("2026-06-03 14:00", "CAD BoC"),
    ("2026-07-29 14:00", "CAD BoC"),
]

GBPJPY_NEWS = [
    ("2026-01-23 03:00", "JPY BoJ"),
    ("2026-02-05 12:00", "GBP BoE"),
    ("2026-03-19 12:00", "GBP BoE"),
    ("2026-03-19 03:00", "JPY BoJ"),
    ("2026-04-28 03:00", "JPY BoJ"),
    ("2026-05-07 11:00", "GBP BoE"),
    ("2026-06-18 11:00", "GBP BoE"),
    ("2026-06-18 03:00", "JPY BoJ"),
    ("2026-07-31 03:00", "JPY BoJ"),
    ("2026-08-06 11:00", "GBP BoE"),
]


def hour_key(ts: int, sec: int = 3600) -> int:
    return ts - (ts % sec)


def next_month(dt: datetime) -> datetime:
    return datetime(dt.year + 1, 1, 1) if dt.month == 12 else datetime(dt.year, dt.month + 1, 1)


def fmt_ts(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


RATE_DTYPE = np.dtype([
    ("time", "i8"),
    ("open", "f8"),
    ("high", "f8"),
    ("low", "f8"),
    ("close", "f8"),
    ("tick_volume", "i8"),
    ("spread", "i4"),
    ("real_volume", "i8"),
])


def _parse_dt_utc(text: str) -> datetime | None:
    text = text.strip().strip('"')
    for fmt in (
        "%Y.%m.%d %H:%M:%S.%f",
        "%Y.%m.%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%d.%m.%Y %H:%M:%S.%f",
        "%d.%m.%Y %H:%M:%S",
        "%Y%m%d %H%M%S",
    ):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def m1_from_bid_ticks(times: np.ndarray, bids: np.ndarray):
    if len(times) == 0:
        return None
    minute = times - (times % 60)
    order = np.argsort(times, kind="mergesort")
    minute = minute[order]
    bids = bids[order]
    change = np.empty(len(minute), dtype=bool)
    change[0] = True
    change[1:] = minute[1:] != minute[:-1]
    starts = np.flatnonzero(change)
    ends = np.empty_like(starts)
    ends[:-1] = starts[1:]
    ends[-1] = len(minute)
    out = np.empty(len(starts), dtype=RATE_DTYPE)
    for i, (a, b) in enumerate(zip(starts, ends)):
        sl = bids[a:b]
        out[i]["time"] = int(minute[a])
        out[i]["open"] = float(sl[0])
        out[i]["high"] = float(sl.max())
        out[i]["low"] = float(sl.min())
        out[i]["close"] = float(sl[-1])
        out[i]["tick_volume"] = int(b - a)
        out[i]["spread"] = 0
        out[i]["real_volume"] = 0
    return out


def load_external_m1(bars_dir: Path, symbol: str):
    """Load Soft4fx/CSV ticks or M1 bars if present. Returns MT5-like M1 array or None."""
    if bars_dir is None:
        return None
    root = Path(bars_dir)
    if not root.exists():
        return None
    keys = [symbol.lower(), symbol.lower().replace("z", "")]
    if "ustec" in symbol.lower():
        keys += ["nq100", "nas100", "us100", "ustec"]
    files: list[Path] = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {".csv", ".txt", ".tsv"}:
            continue
        name = p.name.lower()
        if any(k in name for k in keys) or any(k in str(p.parent).lower() for k in keys):
            files.append(p)
    if not files:
        files = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in {".csv", ".txt", ".tsv"}]
    if not files:
        return None

    times: list[int] = []
    bids: list[float] = []
    ohlc_rows: list[tuple] = []
    for path in files:
        with path.open("r", encoding="utf-8", errors="ignore") as fh:
            sample = fh.read(4096)
            fh.seek(0)
            first = sample.splitlines()[0] if sample else ""
            lower = first.lower()
            has_header = any(tok in lower for tok in ("date", "time", "bid", "open", "high"))
            sep = "," if first.count(",") >= first.count(";") and first.count(",") >= first.count("\t") else (";" if first.count(";") > first.count("\t") else "\t")
            import csv as _csv
            reader = _csv.reader(fh, delimiter=sep)
            header = next(reader) if has_header else None
            idx = {h.strip().lower(): i for i, h in enumerate(header or [])}
            for row in reader:
                if not row or len(row) < 2:
                    continue
                if header:
                    dt_s = None
                    for key in ("datetime", "time", "date", "timestamp"):
                        if key in idx:
                            dt_s = row[idx[key]]
                            break
                    if dt_s is None and "date" in idx and "time" in idx:
                        dt_s = f"{row[idx['date']]} {row[idx['time']]}"
                    if dt_s is None:
                        dt_s = row[0]
                    dt = _parse_dt_utc(dt_s)
                    if dt is None:
                        continue
                    ts = int(dt.timestamp())
                    if "bid" in idx:
                        try:
                            times.append(ts)
                            bids.append(float(row[idx["bid"]]))
                        except ValueError:
                            continue
                    elif all(k in idx for k in ("open", "high", "low", "close")):
                        try:
                            ohlc_rows.append((
                                ts,
                                float(row[idx["open"]]),
                                float(row[idx["high"]]),
                                float(row[idx["low"]]),
                                float(row[idx["close"]]),
                            ))
                        except ValueError:
                            continue
                else:
                    dt = _parse_dt_utc(row[0] if ":" in row[0] else f"{row[0]} {row[1]}")
                    nums_start = 1 if dt and ":" in row[0] else 2
                    if dt is None:
                        continue
                    nums = []
                    for cell in row[nums_start:]:
                        try:
                            nums.append(float(cell))
                        except ValueError:
                            break
                    if len(nums) >= 4 and nums[1] >= nums[2]:
                        ohlc_rows.append((int(dt.timestamp()), nums[0], nums[1], nums[2], nums[3]))
                    elif len(nums) >= 1:
                        times.append(int(dt.timestamp()))
                        bids.append(nums[0])

    if ohlc_rows:
        ohlc_rows.sort(key=lambda r: r[0])
        out = np.empty(len(ohlc_rows), dtype=RATE_DTYPE)
        for i, (ts, o, h, l, c) in enumerate(ohlc_rows):
            out[i]["time"] = ts
            out[i]["open"] = o
            out[i]["high"] = h
            out[i]["low"] = l
            out[i]["close"] = c
            out[i]["tick_volume"] = 1
            out[i]["spread"] = 0
            out[i]["real_volume"] = 0
        return out
    if times:
        return m1_from_bid_ticks(np.asarray(times, dtype=np.int64), np.asarray(bids, dtype=np.float64))
    return None


def fetch_range(tf: int, start: datetime, end: datetime):
    chunks = []
    cur = start
    while cur < end:
        nxt = next_month(cur)
        if nxt > end:
            nxt = end
        rates = mt5.copy_rates_range(SYMBOL, tf, cur, nxt)
        if rates is not None and len(rates):
            t0 = int(cur.replace(tzinfo=timezone.utc).timestamp())
            t1 = int(nxt.replace(tzinfo=timezone.utc).timestamp())
            rates = rates[(rates["time"] >= t0) & (rates["time"] < t1)]
            if len(rates):
                chunks.append(rates)
        cur = nxt
    if not chunks:
        return None
    return np.concatenate(chunks)


def in_session(ts: int) -> bool:
    hour = datetime.fromtimestamp(ts, tz=timezone.utc).hour
    return TRADE_FROM_HOUR <= hour < TRADE_TO_HOUR


def is_news(ts: int) -> bool:
    h = hour_key(ts)
    for stamp, _lbl in NEWS:
        news = int(datetime.strptime(stamp, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc).timestamp())
        news_h1 = hour_key(news)
        until = news_h1 + 3600 * (1 + NEWS_PAD_HOURS)
        if news_h1 <= h < until:
            return True
    return False


def round_lot(lot: float, step: float, vmin: float, vmax: float) -> float:
    if step <= 0:
        step = vmin or 0.01
    lot = (lot // step) * step
    if lot < vmin:
        lot = vmin
    if lot > vmax:
        lot = vmax
    return round(lot + 1e-12, 2)


def main() -> None:
    if not mt5.initialize():
        raise SystemExit(f"MT5 initialize failed: {mt5.last_error()}")
    acc = mt5.account_info()
    spec = mt5.symbol_info(SYMBOL)
    if spec is None:
        mt5.symbol_select(SYMBOL, True)
        spec = mt5.symbol_info(SYMBOL)
    if spec is None:
        mt5.shutdown()
        raise SystemExit("symbol missing")

    point = spec.point or 0.001
    tick_size = spec.trade_tick_size or point
    tick_value = spec.trade_tick_value
    vmin = spec.volume_min or 0.01
    vmax = spec.volume_max or 200.0
    step = spec.volume_step or 0.01
    digits = spec.digits
    spread_pts = int(spec.spread) if spec.spread is not None else 50
    spread_price = spread_pts * point
    sl_buffer = SL_BUFFER_POINTS * point

    h1 = fetch_range(mt5.TIMEFRAME_H1, PRELOAD_DT, TO_DT)
    m5 = fetch_range(mt5.TIMEFRAME_M5, PRELOAD_DT, TO_DT)
    m1 = fetch_range(mt5.TIMEFRAME_M1, PRELOAD_DT, TO_DT)
    mt5.shutdown()
    if h1 is None or m5 is None:
        raise SystemExit("not enough history")

    ext_m1 = load_external_m1(BARS_DIR, SYMBOL) if BARS_DIR else None
    if ext_m1 is not None and len(ext_m1):
        if m1 is None or len(m1) == 0:
            m1 = ext_m1
        else:
            by_t = {int(b["time"]): b for b in m1}
            for b in ext_m1:
                by_t[int(b["time"])] = b
            keys = sorted(by_t)
            merged = np.empty(len(keys), dtype=RATE_DTYPE)
            for i, t in enumerate(keys):
                src = by_t[t]
                merged[i]["time"] = int(src["time"])
                merged[i]["open"] = float(src["open"])
                merged[i]["high"] = float(src["high"])
                merged[i]["low"] = float(src["low"])
                merged[i]["close"] = float(src["close"])
                merged[i]["tick_volume"] = int(src["tick_volume"]) if "tick_volume" in src.dtype.names else 1
                merged[i]["spread"] = int(src["spread"]) if "spread" in src.dtype.names else 0
                merged[i]["real_volume"] = int(src["real_volume"]) if "real_volume" in src.dtype.names else 0
            m1 = merged
        print(f"Loaded external M1 from {BARS_DIR}: {len(ext_m1)} bars")

    m1_by_m5: dict[int, list] = defaultdict(list)
    if m1 is not None:
        for bar in m1:
            m1_by_m5[hour_key(int(bar["time"]), 300)].append(bar)

    trade_from = int(FROM_DT.replace(tzinfo=timezone.utc).timestamp())
    trade_to = int(TO_DT.replace(tzinfo=timezone.utc).timestamp())

    state = "idle"
    direction = 0
    swing = 0.0
    c3ext = 0.0
    fib_end = 0.0
    c4_ok = False
    c4_h1_time = 0
    stats = {"bull_patterns": 0, "bear_patterns": 0, "c4_fail": 0, "armed_bull": 0, "armed_bear": 0, "replaced": 0, "halted": 0}

    trades: list[dict] = []
    skipped: list[dict] = []
    events: list[str] = []
    position = None
    ticket = 0
    equity = float(acc.equity) if acc else 5_167_928.0
    start_equity = equity
    peak = equity
    max_dd = 0.0
    range_halt = False
    seq_loss_r = 0.0

    def close_pos(ts: int, price: float, reason: str) -> None:
        nonlocal position, equity, peak, max_dd, range_halt, seq_loss_r
        if position is None:
            return
        if position["side"] == "sell":
            pnl = (position["entry"] - price) * (position["lot"] / tick_size) * tick_value
        else:
            pnl = (price - position["entry"]) * (position["lot"] / tick_size) * tick_value
        equity += pnl
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
        r_mult = pnl / position["risk_ugx"] if position["risk_ugx"] else 0.0
        trades.append({
            **position,
            "exit_time": fmt_ts(ts),
            "exit": round(price, digits),
            "reason": reason,
            "pnl_ugx": round(pnl, 0),
            "r": round(r_mult, 2),
            "equity_ugx": round(equity, 0),
        })
        events.append(
            f"{fmt_ts(ts)}  EXIT {position['side'].upper()} {reason} @ {price:.{digits}f}  "
            f"PnL {round(pnl, 0):+,.0f} UGX ({r_mult:+.2f}R)"
        )
        if r_mult > 0:
            seq_loss_r = 0.0
        else:
            seq_loss_r += abs(r_mult) if r_mult else 1.0
            if SEQ_HALT_R > 0 and seq_loss_r >= SEQ_HALT_R - 1e-9:
                range_halt = True
                stats["halted"] += 1
                events.append(f"{fmt_ts(ts)}  RANGE HALT  sequential {seq_loss_r:.1f}R")
        position = None

    def manage(bar) -> None:
        nonlocal position
        if position is None:
            return
        ts = int(bar["time"])
        high, low = float(bar["high"]), float(bar["low"])
        sl, tp = position["sl"], position["tp"]
        if position["side"] == "sell":
            hit_sl, hit_tp = high >= sl, low <= tp
            if hit_sl and hit_tp:
                close_pos(ts, sl, "SL (same-bar both)")
            elif hit_sl:
                close_pos(ts, sl, "SL")
            elif hit_tp:
                close_pos(ts, tp, "TP")
        else:
            hit_sl, hit_tp = low <= sl, high >= tp
            if hit_sl and hit_tp:
                close_pos(ts, sl, "SL (same-bar both)")
            elif hit_sl:
                close_pos(ts, sl, "SL")
            elif hit_tp:
                close_pos(ts, tp, "TP")

    def open_trade(side: str, ts: int, fill: float, extreme: float) -> bool:
        nonlocal position, ticket
        if position is not None:
            return False
        if MAX_SPREAD_POINTS > 0 and spread_pts > MAX_SPREAD_POINTS:
            return False
        if side == "sell":
            sl = extreme + sl_buffer
            entry = fill
            risk_price = sl - entry
        else:
            sl = extreme - sl_buffer
            entry = fill + spread_price
            risk_price = entry - sl
        if risk_price <= 0 or risk_price < MIN_RISK_PRICE:
            skipped.append({"time": fmt_ts(ts), "side": side, "why": f"risk {risk_price:.3f}"})
            return False
        if MAX_RISK_PRICE > 0 and risk_price > MAX_RISK_PRICE:
            skipped.append({"time": fmt_ts(ts), "side": side, "why": "max risk"})
            return False
        sl_ticks = risk_price / tick_size
        raw_lot = RISK_UGX / (sl_ticks * tick_value)
        if raw_lot < vmin:
            skipped.append({"time": fmt_ts(ts), "why": "min lot over risk"})
            return False
        lot = round_lot(raw_lot, step, vmin, vmax)
        actual_risk = sl_ticks * tick_value * lot
        tp = entry - REWARD_R * risk_price if side == "sell" else entry + REWARD_R * risk_price
        ticket += 1
        events.append(
            f"{fmt_ts(ts)}  {side.upper()} {lot:.2f} lot  "
            f"@ {round(entry, digits)}  SL {round(sl, digits)}  TP {round(tp, digits)}  "
            f"risk {round(actual_risk, 0):.0f} UGX"
        )
        position = {
            "ticket": ticket,
            "side": side,
            "entry_time": fmt_ts(ts),
            "h1": fmt_ts(hour_key(ts)),
            "entry": round(entry, digits),
            "sl": round(sl, digits),
            "tp": round(tp, digits),
            "lot": lot,
            "risk_price": round(risk_price, digits),
            "risk_ugx": round(actual_risk, 0),
            "dir": "bull" if direction == 1 else "bear",
        }
        return True

    def on_h1_close(i: int) -> None:
        nonlocal state, direction, swing, c3ext, fib_end, c4_ok, c4_h1_time, range_halt, seq_loss_r
        if i < 2:
            return
        left, mid, right = h1[i - 2], h1[i - 1], h1[i]
        bull = float(mid["low"]) < float(left["low"]) and float(mid["low"]) < float(right["low"])
        bear = float(mid["high"]) > float(left["high"]) and float(mid["high"]) > float(right["high"])
        if bull or bear:
            if state != "idle":
                stats["replaced"] += 1
                events.append(f"{fmt_ts(int(right['time']))}  REPLACE old range with new {'BULL' if bull else 'BEAR'} 3-bar")
            state = "wait_c4"
            direction = 1 if bull else -1
            swing = float(mid["low"]) if bull else float(mid["high"])
            c3ext = float(right["high"]) if bull else float(right["low"])
            fib_end = swing
            c4_ok = False
            range_halt = False
            seq_loss_r = 0.0
            c4_h1_time = int(h1[i + 1]["time"]) if i + 1 < len(h1) else int(right["time"]) + 3600
            stats["bull_patterns" if bull else "bear_patterns"] += 1
            events.append(
                f"{fmt_ts(int(right['time']))}  H1 {'BULL' if bull else 'BEAR'} range confirmed  "
                f"swing={swing:.3f}  C3 ext={c3ext:.3f}  (L={float(left['low']):.3f}/{float(mid['low']):.3f}/{float(right['low']):.3f}"
                f" H={float(left['high']):.3f}/{float(mid['high']):.3f}/{float(right['high']):.3f})"
            )
            return
        if state == "wait_c4" and int(h1[i]["time"]) == c4_h1_time:
            if c4_ok:
                state = "track"
                if direction == 1:
                    fib_end = max(fib_end, float(h1[i]["high"]))
                else:
                    fib_end = min(fib_end, float(h1[i]["low"]))
                midp = 0.5 * (swing + fib_end)
                events.append(
                    f"{fmt_ts(int(h1[i]['time']))}  C4 OK  fib {swing:.3f} -> {fib_end:.3f}  50%={midp:.3f}"
                )
            else:
                stats["c4_fail"] += 1
                events.append(f"{fmt_ts(int(h1[i]['time']))}  C4 FAIL (did not print beyond C3) — ignore")
                state = "idle"
                direction = 0
            return
        if state in ("track", "armed"):
            if direction == 1:
                fib_end = max(fib_end, float(h1[i]["high"]))
            else:
                fib_end = min(fib_end, float(h1[i]["low"]))

    def update_forming(h1_time: int, high: float, low: float) -> None:
        nonlocal c4_ok, fib_end
        if state == "wait_c4" and h1_time == c4_h1_time:
            if direction == 1 and high > c3ext:
                c4_ok = True
                fib_end = max(fib_end, high)
            elif direction == -1 and low < c3ext:
                c4_ok = True
                fib_end = min(fib_end, low)
        elif state in ("track", "armed"):
            if direction == 1:
                fib_end = max(fib_end, high)
            else:
                fib_end = min(fib_end, low)

    def maybe_arm(m5_close: float, ts: int = 0) -> None:
        nonlocal state
        if state not in ("wait_c4", "track"):
            return
        if not c4_ok and state != "track":
            return
        if fib_end == swing:
            return
        midp = 0.5 * (swing + fib_end)
        prefix = f"{fmt_ts(ts)}  " if ts else ""
        if direction == 1 and m5_close < midp:
            state = "armed"
            stats["armed_bull"] += 1
            events.append(f"{prefix}M5 close {m5_close:.3f} < 50% {midp:.3f}  ARMED BULL (M5 buys)")
        elif direction == -1 and m5_close > midp:
            state = "armed"
            stats["armed_bear"] += 1
            events.append(f"{prefix}M5 close {m5_close:.3f} > 50% {midp:.3f}  ARMED BEAR (M5 sells)")

    h1_i = 0
    prev_m5 = None
    did_m5 = False
    cur_m5_t = 0

    for m5bar in m5:
        ts = int(m5bar["time"])
        if ts >= trade_to:
            break
        while h1_i + 1 < len(h1) and ts >= int(h1[h1_i + 1]["time"]):
            on_h1_close(h1_i)
            h1_i += 1

        if ts < trade_from:
            prev_m5 = m5bar
            continue

        h1_time = int(h1[h1_i]["time"]) if h1_i < len(h1) else hour_key(ts)
        mh, ml, mc, mo = float(m5bar["high"]), float(m5bar["low"]), float(m5bar["close"]), float(m5bar["open"])
        update_forming(h1_time, mh, ml)

        if ts != cur_m5_t:
            if prev_m5 is not None:
                maybe_arm(float(prev_m5["close"]), ts)
            cur_m5_t = ts
            did_m5 = False

        path = m1_by_m5.get(ts) or [m5bar]
        for pbar in path:
            manage(pbar)

        if position is None and state == "armed" and not did_m5 and not range_halt and prev_m5 is not None:
            if in_session(ts) and not is_news(ts):
                prev_high = float(prev_m5["high"])
                prev_low = float(prev_m5["low"])
                swept_low = False
                swept_high = False
                sweep_low_t = None
                sweep_high_t = None
                for pbar in path:
                    if position is not None or did_m5:
                        break
                    pts = int(pbar["time"])
                    o, h, l = float(pbar["open"]), float(pbar["high"]), float(pbar["low"])
                    run_low = min(ml if False else l, l)
                    # running extremes of current M5 so far: use pbar path cumulative
                    # accumulate
                    # (handled via flags)
                    if l < prev_low and l < mo:
                        if not swept_low:
                            sweep_low_t = pts
                        swept_low = True
                    if h > prev_high and h > mo:
                        if not swept_high:
                            sweep_high_t = pts
                        swept_high = True
                    if direction == 1 and swept_low:
                        if sweep_low_t == pts and o > mo:
                            continue
                        if l <= mo <= h or h >= mo:
                            fill = mo if o <= mo else max(o, mo)
                            if open_trade("buy", pts, fill, min(float(pbar["low"]), ml)):
                                did_m5 = True
                                if float(pbar["high"]) >= position["tp"]:
                                    close_pos(pts, position["tp"], "TP (same bar)")
                    elif direction == -1 and swept_high:
                        if sweep_high_t == pts and o < mo:
                            continue
                        if h >= mo >= l or l <= mo:
                            fill = mo if o >= mo else min(o, mo)
                            if open_trade("sell", pts, fill, max(float(pbar["high"]), mh)):
                                did_m5 = True
                                if position is not None and float(pbar["low"]) <= position["tp"]:
                                    close_pos(pts, position["tp"], "TP (same bar)")

        prev_m5 = m5bar

    if position is not None:
        last = m5[-1]
        close_pos(int(last["time"]), float(last["close"]), "open at end")

    wins = [t for t in trades if t["pnl_ugx"] > 0]
    losses = [t for t in trades if t["pnl_ugx"] < 0]
    flats = [t for t in trades if t["pnl_ugx"] == 0]
    gross_win = sum(t["pnl_ugx"] for t in wins)
    gross_loss = abs(sum(t["pnl_ugx"] for t in losses))
    pf = (gross_win / gross_loss) if gross_loss else None
    net = equity - start_equity

    by = defaultdict(lambda: {"n": 0, "w": 0, "l": 0, "pnl": 0.0})
    for t in trades:
        month = t["entry_time"][:7]
        by[month]["n"] += 1
        by[month]["pnl"] += t["pnl_ugx"]
        if t["pnl_ugx"] > 0:
            by[month]["w"] += 1
        else:
            by[month]["l"] += 1

    window_end = (TO_DT - timedelta(seconds=1)).strftime("%Y-%m-%d")
    window_label = f"{FROM_DT:%Y-%m-%d} through {window_end}"
    out_tag = f"{FROM_DT:%Y%m}-{TO_DT:%Y%m}"

    summary = {
        "symbol": SYMBOL,
        "window": window_label,
        "risk_ugx": RISK_UGX,
        "reward_r": REWARD_R,
        "stats": stats,
        "trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "flats": len(flats),
        "win_rate_pct": round(100.0 * len(wins) / len(trades), 1) if trades else 0.0,
        "profit_factor": round(pf, 2) if pf is not None else None,
        "net_ugx": round(net, 0),
        "max_drawdown_ugx": round(max_dd, 0),
        "expectancy_ugx": round(net / len(trades), 0) if trades else 0,
        "start_equity": round(start_equity, 0),
        "end_equity": round(equity, 0),
        "bull_trades": sum(1 for t in trades if t.get("dir") == "bull"),
        "bear_trades": sum(1 for t in trades if t.get("dir") == "bear"),
        "h1_bars": int(sum(1 for b in h1 if trade_from <= int(b["time"]) < trade_to)),
        "m5_bars": int(sum(1 for b in m5 if trade_from <= int(b["time"]) < trade_to)),
        "m1_bars": int(sum(1 for b in (m1 if m1 is not None else []) if trade_from <= int(b["time"]) < trade_to)),
        "m1_first": fmt_ts(int(m1[0]["time"])) if m1 is not None and len(m1) else None,
        "m1_last": fmt_ts(int(m1[-1]["time"])) if m1 is not None and len(m1) else None,
        "bars_dir": str(BARS_DIR) if BARS_DIR else None,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"h1-range-m5-{SYMBOL.lower()}-{out_tag}.json"
    out.write_text(json.dumps({"summary": summary, "trades": trades, "skipped": skipped[:500], "stats": stats}, indent=2), encoding="utf-8")

    print(f"=== {SYMBOL}  H1 range + fib 50% + M5 sweep  {window_label}  halt -{SEQ_HALT_R:g}R seq ===")
    print(f"H1 / M5 / M1 bars  {summary['h1_bars']} / {summary['m5_bars']} / {summary['m1_bars']}")
    print(f"M1 coverage        {summary['m1_first']} -> {summary['m1_last']}")
    print(f"Patterns   bull {stats['bull_patterns']}  bear {stats['bear_patterns']}  C4 fail {stats['c4_fail']}  replaced {stats['replaced']}")
    print(f"Armed      bull {stats['armed_bull']}  bear {stats['armed_bear']}  halted {stats['halted']}")
    print(f"Trades     {summary['trades']}  W {summary['wins']}  L {summary['losses']}  flat {summary['flats']}")
    print(f"  of which bull {summary['bull_trades']}  bear {summary['bear_trades']}")
    print(f"Win rate   {summary['win_rate_pct']}%")
    print(f"PF         {summary['profit_factor']}")
    print(f"Net        {summary['net_ugx']:,.0f} UGX")
    print(f"Max DD     {summary['max_drawdown_ugx']:,.0f} UGX")
    print(f"Expectancy {summary['expectancy_ugx']:,.0f} UGX / trade")
    print(f"Equity     {summary['start_equity']:,.0f} -> {summary['end_equity']:,.0f} UGX")
    print()
    print(f"{'Month':<10} {'N':>4} {'W':>3} {'L':>3} {'PnL UGX':>14}")
    for month in sorted(by):
        x = by[month]
        print(f"{month:<10} {x['n']:4} {x['w']:3} {x['l']:3} {x['pnl']:14,.0f}")
    print()
    print(f"JSON {out}")
    if TODAY_ONLY:
        print()
        print("=== Event log (today, MT5/UTC) ===")
        for line in events:
            print(line)
        if position is not None:
            print(f"OPEN {position['side'].upper()} still running @ {position['entry']} SL {position['sl']} TP {position['tp']}")
        if not events:
            print("(no range / arm / trade events in window)")


if __name__ == "__main__":
    import sys
    if "--gbpjpy" in sys.argv:
        SYMBOL = "GBPJPYz"
        MIN_RISK_PRICE = 0.08
        MAX_RISK_PRICE = 2.5
        NEWS = list(NEWS) + [n for n in GBPJPY_NEWS if n not in NEWS]
    if "--usdcad" in sys.argv:
        SYMBOL = "USDCADz"
        MIN_RISK_PRICE = 0.0008
        MAX_RISK_PRICE = 0.025
        NEWS = list(NEWS) + [n for n in USDCAD_NEWS if n not in NEWS]
    if "--us100" in sys.argv:
        SYMBOL = "USTECz"
        MIN_RISK_PRICE = 8.0
        MAX_RISK_PRICE = 250.0
    if "--us500" in sys.argv:
        SYMBOL = "US500z"
        MIN_RISK_PRICE = 2.0
        MAX_RISK_PRICE = 80.0
    if "--us30" in sys.argv:
        SYMBOL = "US30z"
        MIN_RISK_PRICE = 15.0
        MAX_RISK_PRICE = 400.0
    if "--eurusd" in sys.argv:
        SYMBOL = "EURUSDz"
        MIN_RISK_PRICE = 0.0008
        MAX_RISK_PRICE = 0.025
        NEWS = list(NEWS) + [n for n in EURUSD_NEWS if n not in NEWS]
    if "--gbpusd" in sys.argv:
        SYMBOL = "GBPUSDz"
        MIN_RISK_PRICE = 0.0008
        MAX_RISK_PRICE = 0.025
        NEWS = list(NEWS) + [n for n in GBPJPY_NEWS if n not in NEWS]
    if "--tp2" in sys.argv:
        REWARD_R = 2.0
    if "--long" in sys.argv:
        FROM_DT = datetime(2025, 6, 1)
        TO_DT = datetime(2026, 9, 1)
        PRELOAD_DT = datetime(2025, 5, 1)
    for arg in sys.argv:
        if arg.startswith("--bars-dir="):
            BARS_DIR = Path(arg.split("=", 1)[1])
        elif arg == "--bars-dir":
            idx = sys.argv.index(arg)
            if idx + 1 < len(sys.argv):
                BARS_DIR = Path(sys.argv[idx + 1])
    if "--today" in sys.argv:
        TODAY_ONLY = True
        FROM_DT = datetime(2026, 9, 7)
        TO_DT = datetime(2026, 9, 8)
        PRELOAD_DT = datetime(2026, 9, 5)
    main()
