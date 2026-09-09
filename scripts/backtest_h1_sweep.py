#!/usr/bin/env python3
"""M1-path backtest of XAUUSD_H1_SweepReturn."""
from __future__ import annotations

import html
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import MetaTrader5 as mt5
import numpy as np

SYMBOL = "XAUUSDz"
RISK_UGX = 20_000.0
REWARD_R = 3.0
MOVE_BE_AT_R = 2.0  # lock SL to entry after this many R; 0 = off
SL_BUFFER_POINTS = 30
MIN_RISK_PRICE = 0.30
MAX_RISK_PRICE = 15.0
MAX_SPREAD_POINTS = 80
ONE_POSITION_ONLY = True
ALLOW_BUYS = True
ALLOW_SELLS = True
TRADE_FROM_HOUR = 4    # inclusive, MT5/broker time
TRADE_TO_HOUR = 20      # exclusive start of the no-trade window
NEWS_PAD_HOURS = 1      # skip news H1 + this many hours after
FROM_DT = datetime(2026, 1, 1)
TO_DT = datetime(2026, 9, 8)
PRELOAD_DT = datetime(2025, 12, 31)
OUT_DIR = Path(r"C:\Users\GEORGE\exnessfxbot\data")
MT5_REPORT_DIR = Path(r"C:\Users\GEORGE\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075")
HTML_NAME = "H1Sweep_JanSep2026_BE2R.htm"
JSON_NAME = "h1-sweep-jan-sep-2026-be2r.json"

# Broker time = UTC on Exness-MT5Trial10. 8:30 ET = 13:30 UTC (EST) / 12:30 UTC (EDT).
NEWS = [
    ("2026-01-09 13:30", "USD NFP"),
    ("2026-01-13 13:30", "USD CPI"),
    ("2026-01-14 13:30", "USD PPI"),
    ("2026-01-28 19:00", "USD FOMC rate decision"),
    ("2026-01-30 13:30", "USD Core PCE"),
    ("2026-02-11 13:30", "USD NFP + CPI (same day)"),
    ("2026-02-12 13:30", "USD PPI"),
    ("2026-02-27 13:30", "USD Core PCE"),
    ("2026-03-06 13:30", "USD NFP"),
    ("2026-03-11 12:30", "USD CPI"),
    ("2026-03-12 12:30", "USD PPI"),
    ("2026-03-18 18:00", "USD FOMC rate decision"),
    ("2026-03-27 12:30", "USD Core PCE"),
    ("2026-04-03 12:30", "USD NFP"),
    ("2026-04-10 12:30", "USD CPI"),
    ("2026-04-14 12:30", "USD PPI"),
    ("2026-04-29 18:00", "USD FOMC rate decision"),
    ("2026-04-30 12:30", "USD Core PCE"),
    ("2026-05-08 12:30", "USD NFP"),
    ("2026-05-12 12:30", "USD CPI"),
    ("2026-05-13 12:30", "USD PPI"),
    ("2026-05-29 12:30", "USD Core PCE"),
    ("2026-06-05 12:30", "USD NFP"),
    ("2026-06-10 12:30", "USD CPI"),
    ("2026-06-11 12:30", "USD PPI"),
    ("2026-06-17 18:00", "USD FOMC rate decision"),
    ("2026-06-26 12:30", "USD Core PCE"),
    ("2026-07-02 12:30", "USD NFP"),
    ("2026-07-14 12:30", "USD CPI"),
    ("2026-07-15 12:30", "USD PPI"),
    ("2026-07-29 18:00", "USD FOMC rate decision"),
    ("2026-07-31 12:30", "USD Core PCE"),
    ("2026-08-03 14:00", "USD ISM Manufacturing PMI"),
    ("2026-08-04 14:00", "USD JOLTS Job Openings"),
    ("2026-08-05 12:15", "USD ADP Non-Farm Employment"),
    ("2026-08-05 14:00", "USD ISM Services PMI"),
    ("2026-08-07 12:30", "USD NFP"),
    ("2026-08-12 12:30", "USD CPI"),
    ("2026-08-19 18:00", "USD FOMC Meeting Minutes"),
    ("2026-08-26 12:30", "USD Core PCE / Prelim GDP"),
    ("2026-08-28 14:00", "USD Fed Chair Warsh (Jackson Hole)"),
    ("2026-09-04 12:30", "USD NFP"),
]

GBPJPY_NEWS = [
    ("2026-01-23 03:00", "JPY BoJ rate decision"),
    ("2026-02-05 12:00", "GBP BoE rate decision"),
    ("2026-03-19 12:00", "GBP BoE rate decision"),
    ("2026-03-19 03:00", "JPY BoJ rate decision"),
    ("2026-04-28 03:00", "JPY BoJ rate decision"),
    ("2026-05-07 11:00", "GBP BoE rate decision"),
    ("2026-06-18 11:00", "GBP BoE rate decision"),
    ("2026-06-18 03:00", "JPY BoJ rate decision"),
    ("2026-07-31 03:00", "JPY BoJ rate decision"),
    ("2026-08-06 11:00", "GBP BoE rate decision"),
]


def hour_key(ts: int) -> int:
    return ts - (ts % 3600)


def next_month(dt: datetime) -> datetime:
    return datetime(dt.year + 1, 1, 1) if dt.month == 12 else datetime(dt.year, dt.month + 1, 1)


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


def fmt_ts(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


def in_session(ts: int) -> bool:
    hour = datetime.fromtimestamp(ts, tz=timezone.utc).hour
    return TRADE_FROM_HOUR <= hour < TRADE_TO_HOUR


def news_reason(h1_open: int) -> str | None:
    for stamp, label in NEWS:
        news = int(datetime.strptime(stamp, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc).timestamp())
        news_h1 = hour_key(news)
        until = news_h1 + 3600 * (1 + NEWS_PAD_HOURS)
        if news_h1 <= h1_open < until:
            return label
    return None


def round_lot(lot: float, step: float, vmin: float, vmax: float) -> float:
    if step <= 0:
        step = vmin or 0.01
    lot = (lot // step) * step
    if lot < vmin:
        lot = vmin
    if lot > vmax:
        lot = vmax
    return round(lot + 1e-12, 2)


def run_one() -> dict:
    if not mt5.initialize():
        raise SystemExit(f"MT5 initialize failed: {mt5.last_error()}")

    acc = mt5.account_info()
    spec = mt5.symbol_info(SYMBOL)
    if spec is None:
        mt5.symbol_select(SYMBOL, True)
        spec = mt5.symbol_info(SYMBOL)
    if spec is None:
        mt5.shutdown()
        raise SystemExit(f"symbol missing {SYMBOL}: {mt5.last_error()}")

    point = spec.point or 0.001
    tick_size = spec.trade_tick_size or point
    tick_value = spec.trade_tick_value
    vmin = spec.volume_min or 0.01
    vmax = spec.volume_max or 200.0
    step = spec.volume_step or 0.01
    digits = spec.digits
    spread_pts = int(spec.spread) if spec.spread is not None else 20
    spread_price = spread_pts * point
    sl_buffer = SL_BUFFER_POINTS * point

    h1 = fetch_range(mt5.TIMEFRAME_H1, PRELOAD_DT, TO_DT)
    m5 = fetch_range(mt5.TIMEFRAME_M5, PRELOAD_DT, TO_DT)
    m1 = fetch_range(mt5.TIMEFRAME_M1, PRELOAD_DT, TO_DT)
    mt5.shutdown()
    if h1 is None or len(h1) < 2:
        raise SystemExit("not enough H1 history")
    if (m5 is None or len(m5) < 2) and (m1 is None or len(m1) < 2):
        raise SystemExit("not enough M1/M5 history")

    m5_by_hour: dict[int, list] = defaultdict(list)
    m1_by_hour: dict[int, list] = defaultdict(list)
    if m5 is not None:
        for bar in m5:
            m5_by_hour[hour_key(int(bar["time"]))].append(bar)
    if m1 is not None:
        for bar in m1:
            m1_by_hour[hour_key(int(bar["time"]))].append(bar)
    m1_hours = set(m1_by_hour)
    path_note = (
        f"M1 hours={len(m1_by_hour)}  M5-only hours={len(set(m5_by_hour) - m1_hours)}"
    )

    trade_from = int(FROM_DT.replace(tzinfo=timezone.utc).timestamp())
    trade_to = int(TO_DT.replace(tzinfo=timezone.utc).timestamp())

    trades: list[dict] = []
    voids: list[dict] = []
    skipped: list[dict] = []
    position = None
    ticket = 0
    equity = float(acc.equity) if acc else 5_135_933.0
    start_equity = equity
    peak = equity
    max_dd = 0.0

    def close_pos(ts: int, price: float, reason: str) -> None:
        nonlocal position, equity, peak, max_dd
        if position is None:
            return
        side = position["side"]
        if side == "sell":
            pnl = (position["entry"] - price) * (position["lot"] / tick_size) * tick_value
        else:
            pnl = (price - position["entry"]) * (position["lot"] / tick_size) * tick_value
        equity += pnl
        peak = max(peak, equity)
        dd = peak - equity
        max_dd = max(max_dd, dd)
        r_mult = pnl / position["risk_ugx"] if position["risk_ugx"] else 0.0
        trades.append(
            {
                **position,
                "exit_time": fmt_ts(ts),
                "exit": round(price, digits),
                "reason": reason,
                "pnl_ugx": round(pnl, 0),
                "r": round(r_mult, 2),
                "equity_ugx": round(equity, 0),
            }
        )
        position = None

    def manage(bar) -> None:
        nonlocal position
        if position is None:
            return
        ts = int(bar["time"])
        high, low = float(bar["high"]), float(bar["low"])
        sl, tp = position["sl"], position["tp"]
        entry = position["entry"]
        orig_sl = position["orig_sl"]
        risk = position["risk_price"]
        be = position.get("be", False)
        r1 = entry + MOVE_BE_AT_R * risk if position["side"] == "buy" else entry - MOVE_BE_AT_R * risk

        def hit_stop(lo: float, hi: float, stop: float, side: str) -> bool:
            return lo <= stop if side == "buy" else hi >= stop

        def hit_target(lo: float, hi: float, target: float, side: str) -> bool:
            return hi >= target if side == "buy" else lo <= target

        if MOVE_BE_AT_R > 0 and not be:
            if hit_stop(low, high, orig_sl, position["side"]):
                close_pos(ts, orig_sl, "SL")
                return
            if hit_target(low, high, r1, position["side"]):
                position["be"] = True
                position["sl"] = entry
                sl = entry
                be = True
                if hit_target(low, high, tp, position["side"]):
                    close_pos(ts, tp, "TP")
                    return
                if hit_stop(low, high, entry, position["side"]):
                    close_pos(ts, entry, "BE")
                    return
                return

        if hit_stop(low, high, sl, position["side"]) and hit_target(low, high, tp, position["side"]):
            close_pos(ts, sl, "BE" if be else "SL (same-minute both)")
        elif hit_stop(low, high, sl, position["side"]):
            close_pos(ts, sl, "BE" if be else "SL")
        elif hit_target(low, high, tp, position["side"]):
            close_pos(ts, tp, "TP")

    def open_trade(side: str, ts: int, entry: float, extreme: float, h1_open: float, prev_ext: float) -> bool:
        nonlocal position, ticket, equity
        if ONE_POSITION_ONLY and position is not None:
            return False
        if MAX_SPREAD_POINTS > 0 and spread_pts > MAX_SPREAD_POINTS:
            skipped.append({"time": fmt_ts(ts), "why": f"spread {spread_pts} pts"})
            return False
        if side == "sell":
            sl = extreme + sl_buffer
            risk_price = sl - entry
        else:
            sl = extreme - sl_buffer
            entry = entry + spread_price  # buy at ask
            risk_price = entry - sl
        if risk_price <= 0:
            skipped.append({"time": fmt_ts(ts), "why": "non-positive risk"})
            return False
        if risk_price < MIN_RISK_PRICE:
            skipped.append({"time": fmt_ts(ts), "side": side, "why": f"risk {risk_price:.3f} < min {MIN_RISK_PRICE}"})
            return False
        if MAX_RISK_PRICE > 0 and risk_price > MAX_RISK_PRICE:
            skipped.append({"time": fmt_ts(ts), "side": side, "why": f"risk {risk_price:.3f} > max {MAX_RISK_PRICE}"})
            return False
        sl_ticks = risk_price / tick_size
        raw_lot = RISK_UGX / (sl_ticks * tick_value)
        if raw_lot < vmin:
            skipped.append(
                {
                    "time": fmt_ts(ts),
                    "side": side,
                    "why": f"0.01 lot would risk {sl_ticks * tick_value * vmin:.0f} UGX > {RISK_UGX:.0f}",
                }
            )
            return False
        lot = round_lot(raw_lot, step, vmin, vmax)
        actual_risk = sl_ticks * tick_value * lot
        if side == "sell":
            tp = entry - REWARD_R * risk_price
        else:
            tp = entry + REWARD_R * risk_price
        ticket += 1
        position = {
            "ticket": ticket,
            "side": side,
            "entry_time": fmt_ts(ts),
            "h1": fmt_ts(hour_key(ts)),
            "entry": round(entry, digits),
            "orig_sl": round(sl, digits),
            "sl": round(sl, digits),
            "tp": round(tp, digits),
            "be": False,
            "lot": lot,
            "risk_price": round(risk_price, digits),
            "risk_ugx": round(actual_risk, 0),
            "h1_open": round(h1_open, digits),
            "prev_extreme": round(prev_ext, digits),
            "sweep_extreme": round(extreme, digits),
        }
        return True

    for i in range(1, len(h1)):
        cur = h1[i]
        prev = h1[i - 1]
        h_open = int(cur["time"])
        if h_open < trade_from or h_open >= trade_to:
            continue
        prev_high = float(prev["high"])
        prev_low = float(prev["low"])
        h1_open = float(cur["open"])
        bars = m1_by_hour.get(h_open) or m5_by_hour.get(h_open, [])
        if not bars:
            continue

        session_ok = in_session(h_open)
        news_lbl = news_reason(h_open)
        allow_entry = session_ok and news_lbl is None
        if not session_ok:
            skipped.append({"time": fmt_ts(h_open), "why": "session 20:00-04:00 MT5"})
        elif news_lbl:
            skipped.append({"time": fmt_ts(h_open), "why": f"news H1: {news_lbl}"})

        swept_high = False
        swept_low = False
        sold = False
        bought = False
        run_high = h1_open
        run_low = h1_open
        sweep_high_min = None
        sweep_low_min = None

        for bar in bars:
            manage(bar)
            ts = int(bar["time"])
            o, h, l, c = float(bar["open"]), float(bar["high"]), float(bar["low"]), float(bar["close"])
            run_high = max(run_high, h)
            run_low = min(run_low, l)

            if run_high > prev_high and run_high > h1_open:
                if not swept_high:
                    sweep_high_min = ts
                swept_high = True
            if run_low < prev_low and run_low < h1_open:
                if not swept_low:
                    sweep_low_min = ts
                swept_low = True

            if position is not None:
                continue
            if not allow_entry:
                continue

            # Bid-based return to H1 Open, matching the EA.
            sell_now = ALLOW_SELLS and swept_high and not sold and l <= h1_open
            buy_now = ALLOW_BUYS and swept_low and not bought and h >= h1_open
            # Same-minute sequence: only allow if this minute opened on the correct side of Open
            # (so High-then-Low / Low-then-High is the natural path).
            if sell_now and sweep_high_min == ts and o < h1_open:
                sell_now = False
            if buy_now and sweep_low_min == ts and o > h1_open:
                buy_now = False
            if sell_now and buy_now:
                skipped.append({"time": fmt_ts(ts), "why": "ambiguous both sides at Open"})
                continue
            if sell_now:
                sold = True
                fill = h1_open if o >= h1_open else min(o, h1_open)
                if open_trade("sell", ts, fill, run_high, h1_open, prev_high) and position is not None:
                    if float(bar["low"]) <= position["tp"]:
                        close_pos(ts, position["tp"], "TP (same minute)")
                    elif MOVE_BE_AT_R > 0 and float(bar["low"]) <= position["entry"] - MOVE_BE_AT_R * position["risk_price"]:
                        position["be"] = True
                        position["sl"] = position["entry"]
            elif buy_now:
                bought = True
                fill = h1_open if o <= h1_open else max(o, h1_open)
                if open_trade("buy", ts, fill, run_low, h1_open, prev_low) and position is not None:
                    if float(bar["high"]) >= position["tp"]:
                        close_pos(ts, position["tp"], "TP (same minute)")
                    elif MOVE_BE_AT_R > 0 and float(bar["high"]) >= position["entry"] + MOVE_BE_AT_R * position["risk_price"]:
                        position["be"] = True
                        position["sl"] = position["entry"]

        if allow_entry and ALLOW_SELLS and swept_high and not sold:
            voids.append({"h1": fmt_ts(h_open), "side": "sell", "why": "swept prev high, no return to Open before close"})
        if allow_entry and ALLOW_BUYS and swept_low and not bought:
            voids.append({"h1": fmt_ts(h_open), "side": "buy", "why": "swept prev low, no return to Open before close"})

    if position is not None:
        last = None
        if m1 is not None and len(m1):
            last = m1[-1]
        elif m5 is not None and len(m5):
            last = m5[-1]
        if last is not None:
            close_pos(int(last["time"]), float(last["close"]), "open at end of window")

    wins = [t for t in trades if t["pnl_ugx"] > 0]
    losses = [t for t in trades if t["pnl_ugx"] < 0]
    flats = [t for t in trades if t["pnl_ugx"] == 0]
    gross_win = sum(t["pnl_ugx"] for t in wins)
    gross_loss = abs(sum(t["pnl_ugx"] for t in losses))
    pf = (gross_win / gross_loss) if gross_loss else None
    net = equity - start_equity

    summary = {
        "symbol": SYMBOL,
        "account_currency": acc.currency if acc else "UGX",
        "account_login": acc.login if acc else None,
        "window": "2026-01-01 through 2026-09-07",
        "model": path_note + " (M1 where stored; M5 Jan–late May because terminal has no older M1)",
        "session": "entries 04:00-19:59 MT5; blocked 20:00-03:59 MT5",
        "news_filter": "high-impact USD/GBP/JPY H1 + 1 hour after",
        "risk_per_trade_ugx": RISK_UGX,
        "reward_r": REWARD_R,
        "move_be_at_r": MOVE_BE_AT_R,
        "spread_used_points": spread_pts,
        "tick_value_ugx": tick_value,
        "starting_equity_ugx": round(start_equity, 0),
        "ending_equity_ugx": round(equity, 0),
        "net_ugx": round(net, 0),
        "max_drawdown_ugx": round(max_dd, 0),
        "trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "flats": len(flats),
        "win_rate_pct": round(100.0 * len(wins) / len(trades), 1) if trades else 0.0,
        "profit_factor": round(pf, 2) if pf is not None else None,
        "expectancy_ugx": round(net / len(trades), 0) if trades else 0,
        "void_setups": len(voids),
        "skipped": len(skipped),
        "skipped_session": sum(1 for s in skipped if "session" in s["why"]),
        "skipped_news": sum(1 for s in skipped if s["why"].startswith("news")),
        "h1_bars": int(sum(1 for b in h1 if trade_from <= int(b["time"]) < trade_to)),
        "m1_bars": int(sum(1 for b in (m1 if m1 is not None else []) if trade_from <= int(b["time"]) < trade_to)),
        "m5_bars": int(sum(1 for b in (m5 if m5 is not None else []) if trade_from <= int(b["time"]) < trade_to)),
        "exits_tp": sum(1 for t in trades if t["reason"].startswith("TP")),
        "exits_be": sum(1 for t in trades if t["reason"].startswith("BE")),
        "exits_sl": sum(1 for t in trades if t["reason"].startswith("SL")),
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = {"summary": summary, "trades": trades, "voids": voids, "skipped": skipped, "news": NEWS}
    out = OUT_DIR / JSON_NAME
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    html_path = write_html_report(summary, trades, start_equity, digits)

    be_lbl = "static SL" if MOVE_BE_AT_R <= 0 else f"BE@{MOVE_BE_AT_R:g}R"
    print(f"=== {SYMBOL} H1 Sweep-Return  Jan–Sep 2026  20k UGX  {be_lbl}  TP {REWARD_R:g}R ===")
    print(f"Symbol        {SYMBOL}")
    print(f"Window        {summary['window']}")
    print(f"Model         {summary['model']}")
    print(f"H1 / M1 / M5  {summary['h1_bars']} / {summary['m1_bars']} / {summary.get('m5_bars', 0)}")
    print(f"Path          {summary['model']}")
    print(f"Spread        {spread_pts} pts  ({spread_price:.{digits}f})")
    print(f"Tick value    {tick_value:.4f} UGX per {tick_size} per 1.00 lot")
    print()
    print(f"Trades        {summary['trades']}   W {summary['wins']}  L {summary['losses']}  flat {summary['flats']}")
    print(f"Win rate      {summary['win_rate_pct']}%")
    print(f"Profit factor {summary['profit_factor']}")
    print(f"Net           {summary['net_ugx']:,.0f} UGX")
    print(f"Max DD        {summary['max_drawdown_ugx']:,.0f} UGX")
    print(f"Expectancy    {summary['expectancy_ugx']:,.0f} UGX / trade")
    print(f"Equity        {summary['starting_equity_ugx']:,.0f} -> {summary['ending_equity_ugx']:,.0f} UGX")
    print(f"Session       {summary['session']}")
    print(f"News filter   {summary['news_filter']}")
    print(f"Void setups   {summary['void_setups']} (swept, no return to Open before H1 close)")
    print(f"Skipped       {summary['skipped']}  (session {summary['skipped_session']}, news {summary['skipped_news']})")
    print()
    by = defaultdict(lambda: {"n": 0, "w": 0, "l": 0, "pnl": 0.0})
    for t in trades:
        month = t["entry_time"][:7]
        by[month]["n"] += 1
        by[month]["pnl"] += t["pnl_ugx"]
        if t["pnl_ugx"] > 0:
            by[month]["w"] += 1
        else:
            by[month]["l"] += 1
    print()
    print(f"{'Month':<10} {'N':>4} {'W':>3} {'L':>3} {'PnL UGX':>14}")
    for month in sorted(by):
        x = by[month]
        print(f"{month:<10} {x['n']:4} {x['w']:3} {x['l']:3} {x['pnl']:14,.0f}")
    be_n = sum(1 for t in trades if t["reason"].startswith("BE"))
    sl_n = sum(1 for t in trades if t["reason"].startswith("SL"))
    tp_n = sum(1 for t in trades if t["reason"].startswith("TP"))
    print()
    print(f"Exits         TP {tp_n}  BE {be_n}  SL {sl_n}")
    print(f"Trades listed in {out}  ({len(trades)} rows)")
    print()
    print(f"JSON   {out}")
    print(f"HTML   {html_path}")
    print()
    return summary


def write_html_report(summary: dict, trades: list[dict], start_equity: float, digits: int) -> Path:
    pts = [(0, start_equity)]
    for i, t in enumerate(trades, 1):
        pts.append((i, t["equity_ugx"]))
    if len(pts) == 1:
        pts.append((1, start_equity))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    min_y, max_y = min(ys), max(ys)
    pad = max((max_y - min_y) * 0.08, 1)
    min_y -= pad
    max_y += pad
    w, h, l, r, t, b = 920, 280, 64, 16, 16, 36
    iw, ih = w - l - r, h - t - b

    def xy(i: int, y: float) -> tuple[float, float]:
        x = l + (i / max(xs[-1], 1)) * iw
        yy = t + (1 - (y - min_y) / (max_y - min_y)) * ih
        return x, yy

    poly = " ".join(f"{xy(i, y)[0]:.1f},{xy(i, y)[1]:.1f}" for i, y in pts)
    last_x, last_y = xy(xs[-1], ys[-1])
    net = summary["net_ugx"]
    net_color = "#3ddc84" if net >= 0 else "#ff5c7a"
    rows = []
    for tr in trades:
        color = "#3ddc84" if tr["pnl_ugx"] >= 0 else "#ff5c7a"
        rows.append(
            "<tr>"
            f"<td>{tr['ticket']}</td><td>{tr['side'].upper()}</td><td>{tr['h1']}</td>"
            f"<td>{tr['entry']:.{digits}f}</td><td>{tr['sl']:.{digits}f}</td><td>{tr['tp']:.{digits}f}</td>"
            f"<td>{tr['lot']:.2f}</td><td>{tr['risk_ugx']:,.0f}</td>"
            f"<td>{html.escape(tr['reason'])}</td><td>{tr['exit_time']}</td>"
            f"<td style='color:{color}'>{tr['pnl_ugx']:+,.0f}</td><td>{tr['r']:+.2f}</td>"
            "</tr>"
        )
    body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>H1 Sweep-Return — August 2026</title>
<style>
body{{margin:0;background:#1b1e23;color:#e8eaed;font:13px/1.45 Segoe UI,Arial,sans-serif}}
header{{padding:18px 24px;background:#111318;border-bottom:1px solid #2c313a}}
h1{{margin:0 0 4px;font-size:20px}}
.sub{{color:#9aa0a6}}
.grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px 24px}}
.card{{background:#23262d;border:1px solid #2c313a;border-radius:8px;padding:12px 14px}}
.k{{color:#9aa0a6;font-size:11px;text-transform:uppercase;letter-spacing:.04em}}
.v{{font-size:20px;font-weight:600;margin-top:4px}}
.pos{{color:#3ddc84}}.neg{{color:#ff5c7a}}
.chart{{margin:0 24px 16px;background:#23262d;border:1px solid #2c313a;border-radius:8px;padding:8px}}
table{{width:calc(100% - 48px);margin:0 24px 32px;border-collapse:collapse}}
th,td{{padding:6px 8px;text-align:left;border-bottom:1px solid #2c313a;white-space:nowrap}}
th{{color:#9aa0a6;font-weight:600;font-size:11px;text-transform:uppercase}}
</style></head><body>
<header>
<h1>{html.escape(str(summary.get('symbol','?')))} H1 Sweep-Return — {html.escape(str(summary.get('window','')))} (BE {summary.get('move_be_at_r',0):g}R / TP {summary.get('reward_r',3):g}R)</h1>
<div class="sub">MT5 1-minute OHLC · risk {summary['risk_per_trade_ugx']:,.0f} UGX · 3R ·
session 04:00–20:00 MT5 · high-impact news H1 skipped · login {summary.get('account_login','')}</div>
</header>
<div class="grid">
<div class="card"><div class="k">Net profit</div><div class="v {'pos' if net>=0 else 'neg'}">{net:+,.0f} UGX</div></div>
<div class="card"><div class="k">Max drawdown</div><div class="v neg">{summary['max_drawdown_ugx']:,.0f} UGX</div></div>
<div class="card"><div class="k">Trades / win rate</div><div class="v">{summary['trades']} &nbsp; {summary['win_rate_pct']}%</div></div>
<div class="card"><div class="k">Profit factor</div><div class="v">{summary['profit_factor'] if summary['profit_factor'] is not None else '—'}</div></div>
<div class="card"><div class="k">Wins / losses</div><div class="v">{summary['wins']} / {summary['losses']}</div></div>
<div class="card"><div class="k">Expectancy</div><div class="v">{summary['expectancy_ugx']:+,.0f} UGX</div></div>
<div class="card"><div class="k">Start equity</div><div class="v">{summary['starting_equity_ugx']:,.0f} UGX</div></div>
<div class="card"><div class="k">End equity</div><div class="v">{summary['ending_equity_ugx']:,.0f} UGX</div></div>
</div>
<div class="chart">
<svg viewBox="0 0 {w} {h}" width="100%" height="280" preserveAspectRatio="none">
<polyline fill="none" stroke="{net_color}" stroke-width="2" points="{poly}"/>
<circle cx="{last_x:.1f}" cy="{last_y:.1f}" r="4" fill="{net_color}"/>
<text x="{l}" y="{h-8}" fill="#9aa0a6" font-size="11">Trade #</text>
<text x="8" y="{t+8}" fill="#9aa0a6" font-size="11">{max_y:,.0f}</text>
<text x="8" y="{t+ih}" fill="#9aa0a6" font-size="11">{min_y:,.0f}</text>
</svg>
</div>
<table>
<thead><tr><th>#</th><th>Side</th><th>H1</th><th>Entry</th><th>SL</th><th>TP</th><th>Lot</th><th>Risk</th><th>Exit</th><th>Time</th><th>PnL UGX</th><th>R</th></tr></thead>
<tbody>
{''.join(rows)}
</tbody></table>
</body></html>"""
    path = OUT_DIR / HTML_NAME
    path.write_text(body, encoding="utf-8")
    dest = MT5_REPORT_DIR / HTML_NAME
    try:
        dest.write_text(body, encoding="utf-8")
    except OSError:
        pass
    tester_dir = MT5_REPORT_DIR / "tester"
    if tester_dir.is_dir():
        (tester_dir / HTML_NAME).write_text(body, encoding="utf-8")
    return path


def main() -> None:
    global SYMBOL, MOVE_BE_AT_R, HTML_NAME, JSON_NAME, MIN_RISK_PRICE, MAX_RISK_PRICE
    global SL_BUFFER_POINTS, MAX_SPREAD_POINTS, ALLOW_BUYS, ALLOW_SELLS
    SYMBOL = "XAUUSDz"
    ALLOW_BUYS = False
    ALLOW_SELLS = True
    MIN_RISK_PRICE = 0.30
    MAX_RISK_PRICE = 15.0
    SL_BUFFER_POINTS = 30
    MAX_SPREAD_POINTS = 80
    rows = []
    for be, tag in ((0.0, "static"), (1.0, "be1r"), (2.0, "be2r")):
        MOVE_BE_AT_R = be
        HTML_NAME = f"H1Sweep_XAU_sells_JanSep2026_{tag}.htm"
        JSON_NAME = f"h1-sweep-xau-sells-jan-sep-2026-{tag}.json"
        rows.append(run_one())
    print("=== XAUUSDz SELLS ONLY  Jan–Sep 2026  20,000 UGX  TP 3R ===")
    print(f"{'Mode':<14} {'N':>5} {'TP':>5} {'BE':>5} {'SL':>5} {'WR%':>7} {'PF':>6} {'Net UGX':>14} {'Max DD':>12} {'Exp':>10}")
    for s in rows:
        mode = "static -1R" if s["move_be_at_r"] <= 0 else f"BE @ {s['move_be_at_r']:g}R"
        pf = "—" if s["profit_factor"] is None else f"{s['profit_factor']:.2f}"
        print(
            f"{mode:<14} {s['trades']:5} {s['exits_tp']:5} {s['exits_be']:5} {s['exits_sl']:5} "
            f"{s['win_rate_pct']:6.1f}% {pf:>6} {s['net_ugx']:14,.0f} {s['max_drawdown_ugx']:12,.0f} {s['expectancy_ugx']:10,.0f}"
        )


if __name__ == "__main__":
    main()
