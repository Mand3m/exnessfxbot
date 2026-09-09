#!/usr/bin/env python3
"""v2 of the H1 swing / M5 break backtest.

Matches XAUUSD_H1Swing_M5Break_v2.mq5: skips a trade when the broker minimum
lot would risk more than the budget, and blocks the payrolls hour by rule
(first Friday) so the filter does not go inert when the table runs out.

H1 3-bar high/low retest: M5 first swing, close through, limit 2.5R on XAUUSDz.

Sell: last H1 3-bar high (middle highest). When current H1 trades above it,
look back on M5 from the crossing bar to the first 3-bar M5 swing low.
When an M5 closes below that low, sell limit at the low. SL = last M5 swing
high that traded above the H1 high. Skip if 2+ M5 swing highs printed above
the H1 high before the low is taken. Buy is the mirror. TP 2.5R.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import MetaTrader5 as mt5
import numpy as np

SYMBOL = "XAUUSDz"
RISK_UGX = 20_000.0
REWARD_R = 2.5
SL_BUFFER_POINTS = 30
MIN_RISK_PRICE = 0.30
MAX_RISK_PRICE = 80.0
MAX_SPREAD_POINTS = 80
SKIP_IF_MIN_LOT_OVER = True
TRADE_FROM_HOUR = 4
TRADE_TO_HOUR = 20
NEWS_PAD_HOURS = 1
LOOKBACK_M5 = 80
FROM_DT = datetime(2026, 1, 1)
TO_DT = datetime(2026, 9, 1)
PRELOAD_DT = datetime(2025, 12, 30)
OUT_DIR = Path(r"C:\Users\GEORGE\exnessfxbot\data")

NEWS = [
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
]


def hour_key(ts: int, sec: int = 3600) -> int:
    return ts - (ts % sec)


def next_month(dt: datetime) -> datetime:
    return datetime(dt.year + 1, 1, 1) if dt.month == 12 else datetime(dt.year, dt.month + 1, 1)


def fmt_ts(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


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


def is_nfp_hour(ts: int) -> bool:
    """First Friday of the month: payrolls at 13:30 UTC (EST) or 12:30 (EDT).

    Block both candidate hours plus the pad, so the filter keeps working once
    the hardcoded NEWS table runs out.
    """
    d = datetime.fromtimestamp(ts, tz=timezone.utc)
    first = d.replace(day=1)
    friday_day = 1 + ((4 - first.weekday()) % 7)
    if d.day != friday_day:
        return False
    return 12 <= d.hour <= 13 + NEWS_PAD_HOURS


def is_news(ts: int) -> bool:
    if is_nfp_hour(ts):
        return True
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


def swing_low_idx(bars, j: int) -> bool:
    if j < 1 or j + 1 >= len(bars):
        return False
    lo = float(bars[j]["low"])
    return lo < float(bars[j - 1]["low"]) and lo < float(bars[j + 1]["low"])


def swing_high_idx(bars, j: int) -> bool:
    if j < 1 or j + 1 >= len(bars):
        return False
    hi = float(bars[j]["high"])
    return hi > float(bars[j - 1]["high"]) and hi > float(bars[j + 1]["high"])


def first_swing_low_back(bars, end_i: int, lookback: int = LOOKBACK_M5):
    """Nearest completed M5 3-bar swing low fully formed before the through bar.

    Middle j needs left j-1 and right j+1, and j+1 must be before end_i so the
    through candle is not the right neighbour.
    """
    start = max(1, end_i - lookback)
    for j in range(end_i - 2, start - 1, -1):
        if j + 1 >= end_i or j + 1 >= len(bars):
            continue
        if swing_low_idx(bars, j):
            return j, float(bars[j]["low"])
    return None, None


def first_swing_high_back(bars, end_i: int, lookback: int = LOOKBACK_M5):
    """Nearest completed M5 3-bar swing high fully formed before the through bar."""
    start = max(1, end_i - lookback)
    for j in range(end_i - 2, start - 1, -1):
        if j + 1 >= end_i or j + 1 >= len(bars):
            continue
        if swing_high_idx(bars, j):
            return j, float(bars[j]["high"])
    return None, None


def swing_highs_above(bars, a: int, b: int, level: float) -> list[tuple[int, float]]:
    out = []
    lo = max(1, a)
    hi = min(len(bars) - 2, b)
    for j in range(lo, hi + 1):
        if swing_high_idx(bars, j) and float(bars[j]["high"]) > level:
            out.append((j, float(bars[j]["high"])))
    return out


def swing_lows_below(bars, a: int, b: int, level: float) -> list[tuple[int, float]]:
    out = []
    lo = max(1, a)
    hi = min(len(bars) - 2, b)
    for j in range(lo, hi + 1):
        if swing_low_idx(bars, j) and float(bars[j]["low"]) < level:
            out.append((j, float(bars[j]["low"])))
    return out


def max_high_above(bars, a: int, b: int, level: float) -> float | None:
    mx = None
    for j in range(max(0, a), min(len(bars) - 1, b) + 1):
        h = float(bars[j]["high"])
        if h > level:
            mx = h if mx is None else max(mx, h)
    return mx


def min_low_below(bars, a: int, b: int, level: float) -> float | None:
    mn = None
    for j in range(max(0, a), min(len(bars) - 1, b) + 1):
        l = float(bars[j]["low"])
        if l < level:
            mn = l if mn is None else min(mn, l)
    return mn


def parse_args(argv: list[str] | None = None):
    p = argparse.ArgumentParser(description="H1 swing + M5 3-bar break backtest")
    p.add_argument("--from", dest="from_dt", default=None, help="YYYY-MM-DD")
    p.add_argument("--to", dest="to_dt", default=None, help="YYYY-MM-DD exclusive")
    p.add_argument("--out", dest="out_name", default=None, help="json filename")
    p.add_argument("--symbol", default=None, help="MT5 symbol e.g. EURUSDz")
    p.add_argument("--risk", type=float, default=None, help="risk budget per trade in account currency")
    return p.parse_args(argv)


def risk_bounds(symbol: str, digits: int, point: float) -> tuple[float, float]:
    if "XAU" in symbol.upper() or "GOLD" in symbol.upper():
        return MIN_RISK_PRICE, MAX_RISK_PRICE
    if digits <= 3:
        return 0.02, 8.0
    return max(20 * point, 0.00020), max(8000 * point, 0.08)


def main(argv: list[str] | None = None) -> None:
    global SYMBOL, RISK_UGX
    args = parse_args(argv)
    if args.risk:
        RISK_UGX = args.risk
    if args.symbol:
        SYMBOL = args.symbol
    from_dt = datetime.strptime(args.from_dt, "%Y-%m-%d") if args.from_dt else FROM_DT
    to_dt = datetime.strptime(args.to_dt, "%Y-%m-%d") if args.to_dt else TO_DT
    preload = from_dt - timedelta(days=3)

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
    min_risk, max_risk = risk_bounds(SYMBOL, digits, point)
    max_spread = 250 if "JPY" in SYMBOL.upper() else MAX_SPREAD_POINTS

    h1 = fetch_range(mt5.TIMEFRAME_H1, preload, to_dt)
    m5 = fetch_range(mt5.TIMEFRAME_M5, preload, to_dt)
    m1 = fetch_range(mt5.TIMEFRAME_M1, preload, to_dt)
    mt5.shutdown()
    if h1 is None or m5 is None:
        raise SystemExit("not enough history")

    m1_by_m5: dict[int, list] = defaultdict(list)
    if m1 is not None:
        for bar in m1:
            m1_by_m5[hour_key(int(bar["time"]), 300)].append(bar)

    trade_from = int(from_dt.replace(tzinfo=timezone.utc).timestamp())
    trade_to = int(to_dt.replace(tzinfo=timezone.utc).timestamp())

    last_high = None
    last_low = None
    consumed_high = None
    consumed_low = None
    sell = None
    buy = None
    stats = {
        "h1_highs": 0,
        "h1_lows": 0,
        "sell_cross": 0,
        "buy_cross": 0,
        "sell_skip_multi": 0,
        "buy_skip_multi": 0,
        "sell_armed": 0,
        "buy_armed": 0,
        "limit_miss": 0,
        "no_origin": 0,
        "limit_touch": 0,
        "limit_blocked": 0,
        "skip_min_lot": 0,
    }
    trades: list[dict] = []
    skipped: list[dict] = []
    position = None
    ticket = 0
    equity = float(acc.equity) if acc else 5_167_928.0
    start_equity = equity
    peak = equity
    max_dd = 0.0

    def close_pos(ts: int, price: float, reason: str) -> None:
        nonlocal position, equity, peak, max_dd
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

    def open_limit_fill(side: str, ts: int, fill: float, sl_raw: float, meta: dict | None = None) -> bool:
        nonlocal position, ticket
        if position is not None:
            return False
        if max_spread > 0 and spread_pts > max_spread:
            return False
        if side == "sell":
            sl = sl_raw + sl_buffer
            entry = fill
            risk_price = sl - entry
        else:
            sl = sl_raw - sl_buffer
            entry = fill + spread_price
            risk_price = entry - sl
        if risk_price <= 0 or risk_price < min_risk:
            skipped.append({"time": fmt_ts(ts), "side": side, "why": f"risk {risk_price:.5f}"})
            return False
        if max_risk > 0 and risk_price > max_risk:
            skipped.append({"time": fmt_ts(ts), "side": side, "why": "max risk", "risk_price": round(risk_price, digits)})
            return False
        sl_ticks = risk_price / tick_size
        raw_lot = RISK_UGX / (sl_ticks * tick_value)
        if raw_lot < vmin:
            if SKIP_IF_MIN_LOT_OVER:
                skipped.append({
                    "time": fmt_ts(ts),
                    "side": side,
                    "why": "min lot over risk",
                    "min_lot_risk_ugx": round(sl_ticks * tick_value * vmin, 0),
                    "budget_ugx": RISK_UGX,
                })
                stats["skip_min_lot"] = stats.get("skip_min_lot", 0) + 1
                return False
            lot = vmin
        else:
            lot = round_lot(raw_lot, step, vmin, vmax)
        actual_risk = sl_ticks * tick_value * lot
        tp = entry - REWARD_R * risk_price if side == "sell" else entry + REWARD_R * risk_price
        ticket += 1
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
            "dir": "bear" if side == "sell" else "bull",
        }
        if meta:
            position.update(meta)
        return True

    def on_h1_close(i: int) -> None:
        nonlocal last_high, last_low, sell, buy
        if i < 2:
            return
        left, mid, right = h1[i - 2], h1[i - 1], h1[i]
        bull = float(mid["low"]) < float(left["low"]) and float(mid["low"]) < float(right["low"])
        bear = float(mid["high"]) > float(left["high"]) and float(mid["high"]) > float(right["high"])
        if bear:
            last_high = float(mid["high"])
            stats["h1_highs"] += 1
            if sell is not None and sell.get("state") != "filled":
                if sell.get("state") == "wait_limit":
                    stats["limit_miss"] += 1
                sell = None
        if bull:
            last_low = float(mid["low"])
            stats["h1_lows"] += 1
            if buy is not None and buy.get("state") != "filled":
                if buy.get("state") == "wait_limit":
                    stats["limit_miss"] += 1
                buy = None

    h1_i = 0
    for i, bar in enumerate(m5):
        ts = int(bar["time"])
        if ts >= trade_to:
            break
        while h1_i + 1 < len(h1) and ts >= int(h1[h1_i + 1]["time"]):
            on_h1_close(h1_i)
            h1_i += 1

        path = m1_by_m5.get(ts) or [bar]
        for pbar in path:
            manage(pbar)

        if ts < trade_from:
            continue

        mh, ml, mc = float(bar["high"]), float(bar["low"]), float(bar["close"])

        if last_high is not None and sell is None and mh > last_high and last_high != consumed_high:
            origin_i, origin_low = first_swing_low_back(m5, i)
            consumed_high = last_high
            if origin_i is None:
                stats["no_origin"] += 1
            else:
                stats["sell_cross"] += 1
                sell = {
                    "state": "watch",
                    "level": last_high,
                    "origin_i": origin_i,
                    "origin_low": origin_low,
                    "cross_i": i,
                    "origin_t": fmt_ts(int(m5[origin_i]["time"])),
                    "cross_t": fmt_ts(ts),
                }

        if last_low is not None and buy is None and ml < last_low and last_low != consumed_low:
            origin_i, origin_high = first_swing_high_back(m5, i)
            consumed_low = last_low
            if origin_i is None:
                stats["no_origin"] += 1
            else:
                stats["buy_cross"] += 1
                buy = {
                    "state": "watch",
                    "level": last_low,
                    "origin_i": origin_i,
                    "origin_high": origin_high,
                    "cross_i": i,
                    "origin_t": fmt_ts(int(m5[origin_i]["time"])),
                    "cross_t": fmt_ts(ts),
                }

        if sell is not None and sell["state"] == "watch" and mc < sell["origin_low"] and in_session(ts) and not is_news(ts):
            skip_highs = swing_highs_above(m5, sell["origin_i"], i, sell["level"])
            if len(skip_highs) >= 2:
                stats["sell_skip_multi"] += 1
                skipped.append({"time": fmt_ts(ts), "side": "sell", "why": f"multi highs {len(skip_highs)}"})
                sell = None
            else:
                highs = swing_highs_above(m5, sell["origin_i"], sell["cross_i"], sell["level"])
                sl_high = highs[-1][1] if highs else max_high_above(m5, sell["origin_i"], sell["cross_i"], sell["level"])
                if sl_high is None:
                    sell = None
                else:
                    sell["state"] = "wait_limit"
                    sell["limit"] = sell["origin_low"]
                    sell["sl_ext"] = sl_high
                    sell["arm_i"] = i
                    stats["sell_armed"] += 1

        if buy is not None and buy["state"] == "watch" and mc > buy["origin_high"] and in_session(ts) and not is_news(ts):
            skip_lows = swing_lows_below(m5, buy["origin_i"], i, buy["level"])
            if len(skip_lows) >= 2:
                stats["buy_skip_multi"] += 1
                skipped.append({"time": fmt_ts(ts), "side": "buy", "why": f"multi lows {len(skip_lows)}"})
                buy = None
            else:
                lows = swing_lows_below(m5, buy["origin_i"], buy["cross_i"], buy["level"])
                sl_low = lows[-1][1] if lows else min_low_below(m5, buy["origin_i"], buy["cross_i"], buy["level"])
                if sl_low is None:
                    buy = None
                else:
                    buy["state"] = "wait_limit"
                    buy["limit"] = buy["origin_high"]
                    buy["sl_ext"] = sl_low
                    buy["arm_i"] = i
                    stats["buy_armed"] += 1

        if position is None and in_session(ts) and not is_news(ts):
            if sell is not None and sell["state"] == "wait_limit" and i > sell["arm_i"]:
                for pbar in path:
                    if float(pbar["high"]) >= sell["limit"]:
                        stats["limit_touch"] += 1
                        meta = {
                            "origin_t": sell.get("origin_t"),
                            "cross_t": sell.get("cross_t"),
                            "h1_level": round(sell["level"], digits),
                            "sl_raw": round(sell["sl_ext"], digits),
                        }
                        if open_limit_fill("sell", int(pbar["time"]), sell["limit"], sell["sl_ext"], meta):
                            sell = None
                            manage(pbar)
                        else:
                            stats["limit_blocked"] += 1
                        break
            if buy is not None and buy["state"] == "wait_limit" and i > buy["arm_i"] and position is None:
                for pbar in path:
                    if float(pbar["low"]) <= buy["limit"]:
                        stats["limit_touch"] += 1
                        meta = {
                            "origin_t": buy.get("origin_t"),
                            "cross_t": buy.get("cross_t"),
                            "h1_level": round(buy["level"], digits),
                            "sl_raw": round(buy["sl_ext"], digits),
                        }
                        if open_limit_fill("buy", int(pbar["time"]), buy["limit"], buy["sl_ext"], meta):
                            buy = None
                            manage(pbar)
                        else:
                            stats["limit_blocked"] += 1
                        break

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

    window_label = f"{from_dt:%Y-%m-%d} through {(to_dt - timedelta(seconds=1)):%Y-%m-%d}"
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
        "m1_first": fmt_ts(int(m1[0]["time"])) if m1 is not None and len(m1) else None,
        "m1_last": fmt_ts(int(m1[-1]["time"])) if m1 is not None and len(m1) else None,
        "m5_bars": int(sum(1 for b in m5 if trade_from <= int(b["time"]) < trade_to)),
        "h1_bars": int(sum(1 for b in h1 if trade_from <= int(b["time"]) < trade_to)),
        "m1_bars": int(sum(1 for b in (m1 if m1 is not None else []) if trade_from <= int(b["time"]) < trade_to)),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if args.out_name:
        out = OUT_DIR / args.out_name
    else:
        out = OUT_DIR / f"h1-swing-m5-break-{SYMBOL.lower()}-{from_dt:%Y-%m-%d}-{to_dt:%Y-%m-%d}.json"
    out.write_text(json.dumps({"summary": summary, "trades": trades, "skipped": skipped[:400], "stats": stats}, indent=2), encoding="utf-8")

    print(f"=== {SYMBOL}  H1 swing retest + M5 break  {window_label}  TP {REWARD_R:g}R ===")
    print(f"H1 / M5 / M1 bars  {summary['h1_bars']} / {summary['m5_bars']} / {summary['m1_bars']}")
    print(f"M1 coverage        {summary['m1_first']} -> {summary['m1_last']}")
    print(f"H1 swings  highs {stats['h1_highs']}  lows {stats['h1_lows']}")
    print(f"Crosses    sell {stats['sell_cross']}  buy {stats['buy_cross']}  no origin {stats['no_origin']}")
    print(f"Skip multi sell {stats['sell_skip_multi']}  buy {stats['buy_skip_multi']}  limit miss {stats['limit_miss']}")
    print(f"Armed      sell {stats['sell_armed']}  buy {stats['buy_armed']}  limit touch {stats['limit_touch']}  blocked {stats['limit_blocked']}")
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


if __name__ == "__main__":
    main(sys.argv[1:])
