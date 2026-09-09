#!/usr/bin/env python3
"""H1 range (C4 + fib 50%) as context, M5Swing_M1Break as the trigger.

Bull range: M5M1 buys only, tagged above vs below the running 50% fib.
Bear range: M5M1 sells only, same split.
Gold, 20k UGX, TP 2.5R. M1 window only (Jul 20-Aug 31 2026).
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import MetaTrader5 as mt5

import backtest_m5_swing_m1_break as m1b

m1b.SYMBOL = "XAUUSDz"
FROM_DT = datetime(2026, 7, 20)
TO_DT = datetime(2026, 9, 1)
PRELOAD = datetime(2026, 7, 15)
RISK = 20_000.0
REWARD_R = 2.5
SL_BUFFER_POINTS = 30
MIN_RISK = 0.30
MAX_RISK = 80.0
OUT = Path(r"C:\Users\GEORGE\exnessfxbot\data\h1range-m5m1-fib50-xauusdz-jul-aug-2026.json")


def side_stats(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0, "w": 0, "wr": None, "pf": None, "pnl": 0.0, "exp": None}
    w = [t for t in rows if t["pnl_ugx"] > 0]
    l = [t for t in rows if t["pnl_ugx"] < 0]
    gw = sum(t["pnl_ugx"] for t in w)
    gl = abs(sum(t["pnl_ugx"] for t in l))
    pnl = sum(t["pnl_ugx"] for t in rows)
    return {
        "n": len(rows),
        "w": len(w),
        "wr": round(100 * len(w) / len(rows), 1),
        "pf": None if not gl else round(gw / gl, 2),
        "pnl": round(pnl, 0),
        "exp": round(pnl / len(rows), 0),
    }


def print_bucket(label: str, rows: list[dict]) -> None:
    s = side_stats(rows)
    print(
        f"{label:<28} n={s['n']:<4} WR {str(s['wr'])+'%' if s['wr'] is not None else 'n/a':>6}  "
        f"PF {str(s['pf']):>5}  net {s['pnl']:>12,.0f}  exp {str(s['exp']):>8}"
    )


def main() -> None:
    if not mt5.initialize():
        raise SystemExit(mt5.last_error())
    acc = mt5.account_info()
    spec = mt5.symbol_info(m1b.SYMBOL)
    h1 = m1b.fetch_range(mt5.TIMEFRAME_H1, PRELOAD, TO_DT)
    m5 = m1b.fetch_range(mt5.TIMEFRAME_M5, PRELOAD, TO_DT)
    m1 = m1b.fetch_range(mt5.TIMEFRAME_M1, PRELOAD, TO_DT)
    mt5.shutdown()
    if h1 is None or m5 is None or m1 is None or len(m1) == 0:
        raise SystemExit("need H1/M5/M1")

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

    trade_from = int(FROM_DT.replace(tzinfo=timezone.utc).timestamp())
    trade_to = int(TO_DT.replace(tzinfo=timezone.utc).timestamp())
    m1_first = int(m1[0]["time"])
    if trade_from < m1_first:
        trade_from = m1_first

    start_eq = float(acc.equity) if acc else 5_152_822.0
    equity = start_eq
    peak = equity
    max_dd = 0.0
    ticket = 0
    position = None
    trades: list[dict] = []
    skipped: list[dict] = []
    stats = defaultdict(int)

    # H1 range
    rng_state = "idle"  # idle / wait_c4 / track
    direction = 0
    swing = 0.0
    c3ext = 0.0
    fib_end = 0.0
    c4_ok = False
    c4_h1_time = 0

    # M5M1
    last_high = last_low = None
    consumed_high = consumed_low = None
    sell = None
    buy = None

    def midp() -> float | None:
        if fib_end == swing:
            return None
        return 0.5 * (swing + fib_end)

    def zone_of(price: float) -> str | None:
        m = midp()
        if m is None:
            return None
        return "below_50" if price < m else "above_50"

    def cancel_pending(why: str) -> None:
        nonlocal sell, buy
        if sell is not None and sell.get("state") == "wait_limit":
            stats["limit_miss"] += 1
        if buy is not None and buy.get("state") == "wait_limit":
            stats["limit_miss"] += 1
        sell = None
        buy = None
        stats[why] += 1

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
        r = pnl / position["risk_ugx"] if position["risk_ugx"] else 0.0
        trades.append({
            **position,
            "exit_time": m1b.fmt_ts(ts),
            "exit": round(price, digits),
            "reason": reason,
            "pnl_ugx": round(pnl, 0),
            "r": round(r, 2),
            "equity_ugx": round(equity, 0),
        })
        position = None

    def manage(bar) -> None:
        if position is None:
            return
        ts = int(bar["time"])
        hi, lo = float(bar["high"]), float(bar["low"])
        sl, tp = position["sl"], position["tp"]
        if position["side"] == "sell":
            hit_sl, hit_tp = hi >= sl, lo <= tp
        else:
            hit_sl, hit_tp = lo <= sl, hi >= tp
        if hit_sl and hit_tp:
            close_pos(ts, sl, "SL (same-bar both)")
        elif hit_sl:
            close_pos(ts, sl, "SL")
        elif hit_tp:
            close_pos(ts, tp, "TP")

    def open_limit(side: str, ts: int, fill: float, sl_raw: float, meta: dict) -> bool:
        nonlocal position, ticket
        if position is not None:
            return False
        if side == "sell":
            sl = sl_raw + sl_buffer
            entry = fill
            risk_price = sl - entry
        else:
            sl = sl_raw - sl_buffer
            entry = fill + spread_price
            risk_price = entry - sl
        if risk_price <= MIN_RISK:
            skipped.append({"t": m1b.fmt_ts(ts), "side": side, "why": f"risk {risk_price:.3f}"})
            return False
        if risk_price > MAX_RISK:
            skipped.append({"t": m1b.fmt_ts(ts), "side": side, "why": "max risk"})
            return False
        sl_ticks = risk_price / tick_size
        raw_lot = RISK / (sl_ticks * tick_value)
        if raw_lot < vmin:
            skipped.append({"t": m1b.fmt_ts(ts), "side": side, "why": "min lot over risk"})
            return False
        lot = m1b.round_lot(raw_lot, step, vmin, vmax)
        actual_risk = sl_ticks * tick_value * lot
        tp = entry - REWARD_R * risk_price if side == "sell" else entry + REWARD_R * risk_price
        ticket += 1
        z_fill = zone_of(entry)
        position = {
            "ticket": ticket,
            "side": side,
            "entry_time": m1b.fmt_ts(ts),
            "entry": round(entry, digits),
            "sl": round(sl, digits),
            "tp": round(tp, digits),
            "lot": lot,
            "risk_price": round(risk_price, digits),
            "risk_ugx": round(actual_risk, 0),
            "dir": "bull" if direction == 1 else "bear",
            "zone_m5": meta.get("zone_m5"),
            "zone_fill": z_fill,
            "fib50": None if midp() is None else round(midp(), digits),
            "swing": round(swing, digits),
            "fib_end": round(fib_end, digits),
            **meta,
        }
        return True

    def on_h1_close(i: int) -> None:
        nonlocal rng_state, direction, swing, c3ext, fib_end, c4_ok, c4_h1_time
        if i < 2:
            return
        left, mid, right = h1[i - 2], h1[i - 1], h1[i]
        bull = float(mid["low"]) < float(left["low"]) and float(mid["low"]) < float(right["low"])
        bear = float(mid["high"]) > float(left["high"]) and float(mid["high"]) > float(right["high"])
        if bull or bear:
            if rng_state != "idle":
                stats["range_replaced"] += 1
                cancel_pending("pending_killed_replace")
            rng_state = "wait_c4"
            direction = 1 if bull else -1
            swing = float(mid["low"]) if bull else float(mid["high"])
            c3ext = float(right["high"]) if bull else float(right["low"])
            fib_end = swing
            c4_ok = False
            c4_h1_time = int(h1[i + 1]["time"]) if i + 1 < len(h1) else int(right["time"]) + 3600
            stats["bull_ranges" if bull else "bear_ranges"] += 1
            return
        if rng_state == "wait_c4" and int(h1[i]["time"]) == c4_h1_time:
            if c4_ok:
                rng_state = "track"
                if direction == 1:
                    fib_end = max(fib_end, float(h1[i]["high"]))
                else:
                    fib_end = min(fib_end, float(h1[i]["low"]))
                stats["c4_ok"] += 1
            else:
                stats["c4_fail"] += 1
                rng_state = "idle"
                direction = 0
                cancel_pending("pending_killed_c4fail")
            return
        if rng_state == "track":
            if direction == 1:
                fib_end = max(fib_end, float(h1[i]["high"]))
            else:
                fib_end = min(fib_end, float(h1[i]["low"]))

    def update_forming(h1_time: int, high: float, low: float) -> None:
        nonlocal c4_ok, fib_end
        if rng_state == "wait_c4" and h1_time == c4_h1_time:
            if direction == 1 and high > c3ext:
                c4_ok = True
                fib_end = max(fib_end, high)
            elif direction == -1 and low < c3ext:
                c4_ok = True
                fib_end = min(fib_end, low)
        elif rng_state == "track":
            if direction == 1:
                fib_end = max(fib_end, high)
            else:
                fib_end = min(fib_end, low)

    def on_m5_close(i: int) -> None:
        nonlocal last_high, last_low, sell, buy
        if i < 2:
            return
        left, mid, right = m5[i - 2], m5[i - 1], m5[i]
        if float(mid["high"]) > float(left["high"]) and float(mid["high"]) > float(right["high"]):
            last_high = float(mid["high"])
            stats["m5_highs"] += 1
            if sell is not None:
                if sell.get("state") == "wait_limit":
                    stats["limit_miss"] += 1
                sell = None
        if float(mid["low"]) < float(left["low"]) and float(mid["low"]) < float(right["low"]):
            last_low = float(mid["low"])
            stats["m5_lows"] += 1
            if buy is not None:
                if buy.get("state") == "wait_limit":
                    stats["limit_miss"] += 1
                buy = None

    h1_i = 0
    m5_i = 0
    for i, bar in enumerate(m1):
        ts = int(bar["time"])
        if ts >= trade_to:
            break
        while h1_i + 1 < len(h1) and ts >= int(h1[h1_i + 1]["time"]):
            on_h1_close(h1_i)
            h1_i += 1
        while m5_i + 1 < len(m5) and ts >= int(m5[m5_i + 1]["time"]):
            on_m5_close(m5_i)
            m5_i += 1

        mh, ml, mc = float(bar["high"]), float(bar["low"]), float(bar["close"])
        h1_time = int(h1[h1_i]["time"]) if h1_i < len(h1) else m1b.hour_key(ts)
        update_forming(h1_time, mh, ml)
        manage(bar)

        if ts < trade_from:
            continue

        in_rng = rng_state == "track" and direction != 0 and midp() is not None
        allow_buy = in_rng and direction == 1
        allow_sell = in_rng and direction == -1

        if last_high is not None and sell is None and mh > last_high and last_high != consumed_high:
            consumed_high = last_high
            stats["sell_through"] += 1
            if allow_sell:
                origin_i, origin_low = m1b.first_swing_low_back(m1, i)
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
                        "zone_m5": zone_of(last_high),
                        "fib50_at_through": None if midp() is None else round(midp(), digits),
                    }

        if last_low is not None and buy is None and ml < last_low and last_low != consumed_low:
            consumed_low = last_low
            stats["buy_through"] += 1
            if allow_buy:
                origin_i, origin_high = m1b.first_swing_high_back(m1, i)
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
                        "zone_m5": zone_of(last_low),
                        "fib50_at_through": None if midp() is None else round(midp(), digits),
                    }

        if sell is not None and sell["state"] == "watch" and mc < sell["origin_low"] and m1b.in_session(ts) and not m1b.is_news(ts):
            skip_highs = m1b.swing_highs_above(m1, sell["origin_i"], i, sell["level"])
            if len(skip_highs) >= 2:
                stats["sell_skip_multi"] += 1
                sell = None
            else:
                highs = m1b.swing_highs_above(m1, sell["origin_i"], sell["cross_i"], sell["level"])
                sl_high = highs[-1][1] if highs else m1b.max_high_above(m1, sell["origin_i"], sell["cross_i"], sell["level"])
                if sl_high is None:
                    sell = None
                else:
                    sell["state"] = "wait_limit"
                    sell["limit"] = sell["origin_low"]
                    sell["sl_ext"] = sl_high
                    sell["arm_i"] = i
                    stats["sell_armed"] += 1
                    stats[f"sell_armed_{sell['zone_m5'] or 'na'}"] += 1

        if buy is not None and buy["state"] == "watch" and mc > buy["origin_high"] and m1b.in_session(ts) and not m1b.is_news(ts):
            skip_lows = m1b.swing_lows_below(m1, buy["origin_i"], i, buy["level"])
            if len(skip_lows) >= 2:
                stats["buy_skip_multi"] += 1
                buy = None
            else:
                lows = m1b.swing_lows_below(m1, buy["origin_i"], buy["cross_i"], buy["level"])
                sl_low = lows[-1][1] if lows else m1b.min_low_below(m1, buy["origin_i"], buy["cross_i"], buy["level"])
                if sl_low is None:
                    buy = None
                else:
                    buy["state"] = "wait_limit"
                    buy["limit"] = buy["origin_high"]
                    buy["sl_ext"] = sl_low
                    buy["arm_i"] = i
                    stats["buy_armed"] += 1
                    stats[f"buy_armed_{buy['zone_m5'] or 'na'}"] += 1

        if position is None and m1b.in_session(ts) and not m1b.is_news(ts):
            if sell is not None and sell["state"] == "wait_limit" and i > sell["arm_i"] and mh >= sell["limit"]:
                stats["limit_touch"] += 1
                meta = {
                    "m5_level": round(sell["level"], digits),
                    "zone_m5": sell["zone_m5"],
                    "fib50_at_through": sell.get("fib50_at_through"),
                }
                if open_limit("sell", ts, sell["limit"], sell["sl_ext"], meta):
                    stats["sell_fill"] += 1
                    stats[f"sell_fill_{sell['zone_m5'] or 'na'}"] += 1
                    sell = None
                    manage(bar)
                else:
                    stats["limit_blocked"] += 1
            if buy is not None and buy["state"] == "wait_limit" and i > buy["arm_i"] and position is None and ml <= buy["limit"]:
                stats["limit_touch"] += 1
                meta = {
                    "m5_level": round(buy["level"], digits),
                    "zone_m5": buy["zone_m5"],
                    "fib50_at_through": buy.get("fib50_at_through"),
                }
                if open_limit("buy", ts, buy["limit"], buy["sl_ext"], meta):
                    stats["buy_fill"] += 1
                    stats[f"buy_fill_{buy['zone_m5'] or 'na'}"] += 1
                    buy = None
                    manage(bar)
                else:
                    stats["limit_blocked"] += 1

    if position is not None:
        last = m1[-1]
        close_pos(int(last["time"]), float(last["close"]), "open at end")

    def bucket(pred) -> list[dict]:
        return [t for t in trades if pred(t)]

    bull_below = bucket(lambda t: t["dir"] == "bull" and t.get("zone_m5") == "below_50")
    bull_above = bucket(lambda t: t["dir"] == "bull" and t.get("zone_m5") == "above_50")
    bear_above = bucket(lambda t: t["dir"] == "bear" and t.get("zone_m5") == "above_50")
    bear_below = bucket(lambda t: t["dir"] == "bear" and t.get("zone_m5") == "below_50")
    with_rule = bull_below + bear_above  # discount buys / premium sells
    against_rule = bull_above + bear_below

    wins = [t for t in trades if t["pnl_ugx"] > 0]
    losses = [t for t in trades if t["pnl_ugx"] < 0]
    gw = sum(t["pnl_ugx"] for t in wins)
    gl = abs(sum(t["pnl_ugx"] for t in losses))
    pf = (gw / gl) if gl else None
    net = equity - start_eq
    by = defaultdict(lambda: {"n": 0, "w": 0, "l": 0, "pnl": 0.0})
    for t in trades:
        m = t["entry_time"][:7]
        by[m]["n"] += 1
        by[m]["pnl"] += t["pnl_ugx"]
        if t["pnl_ugx"] > 0:
            by[m]["w"] += 1
        else:
            by[m]["l"] += 1

    print("=== XAUUSDz  H1 range + M5Swing_M1Break  fib 50% split  20k  2.5R ===")
    print(f"Window {m1b.fmt_ts(trade_from)} through 2026-08-31  (M1 only; no M1 Jan-Jul)")
    print("H1 range = 3-bar swing, C4 beyond C3, fib swing -> running extreme.")
    print("Bull range -> M5M1 buys only. Bear range -> M5M1 sells only.")
    print("Zone = M5 swing level vs running 50% at the M1 through.")
    print()
    print(
        f"H1 ranges  bull {stats['bull_ranges']}  bear {stats['bear_ranges']}  "
        f"C4 ok {stats['c4_ok']}  C4 fail {stats['c4_fail']}  replaced {stats['range_replaced']}"
    )
    print(f"M5 swings  highs {stats['m5_highs']}  lows {stats['m5_lows']}")
    print(
        f"Throughs in range  buy {stats['buy_cross']}  sell {stats['sell_cross']}  "
        f"no origin {stats['no_origin']}  skip multi buy {stats['buy_skip_multi']} sell {stats['sell_skip_multi']}"
    )
    print(
        f"Armed  buy {stats['buy_armed']} (below50 {stats['buy_armed_below_50']} / above50 {stats['buy_armed_above_50']})  "
        f"sell {stats['sell_armed']} (above50 {stats['sell_armed_above_50']} / below50 {stats['sell_armed_below_50']})"
    )
    print(
        f"Fills   buy {stats['buy_fill']} (below50 {stats['buy_fill_below_50']} / above50 {stats['buy_fill_above_50']})  "
        f"sell {stats['sell_fill']} (above50 {stats['sell_fill_above_50']} / below50 {stats['sell_fill_below_50']})"
    )
    print(f"Limit miss {stats['limit_miss']}  blocked {stats['limit_blocked']}")
    print()
    print(f"Trades {len(trades)}  W {len(wins)}  L {len(losses)}")
    print(f"Win rate {100 * len(wins) / len(trades):.1f}%" if trades else "Win rate n/a")
    print(f"PF {None if pf is None else round(pf, 2)}")
    print(f"Net {net:,.0f} UGX")
    print(f"Max DD {max_dd:,.0f} UGX")
    print(f"Equity {start_eq:,.0f} -> {equity:,.0f}")
    print()
    print("By M5-swing vs 50% fib:")
    print_bucket("BULL buys BELOW 50%", bull_below)
    print_bucket("BULL buys ABOVE 50%", bull_above)
    print_bucket("BEAR sells ABOVE 50%", bear_above)
    print_bucket("BEAR sells BELOW 50%", bear_below)
    print()
    print_bucket("WITH 50% rule (disc buy / prem sell)", with_rule)
    print_bucket("AGAINST 50% rule", against_rule)
    print()
    print(f"{'Month':<10} {'N':>4} {'W':>3} {'L':>3} {'PnL UGX':>12}")
    monthly = []
    for month in sorted(by):
        x = by[month]
        print(f"{month:<10} {x['n']:4} {x['w']:3} {x['l']:3} {x['pnl']:12,.0f}")
        monthly.append({"month": month, **x, "pnl": round(x["pnl"], 0)})

    OUT.write_text(json.dumps({
        "stats": dict(stats),
        "n": len(trades),
        "wr": None if not trades else round(100 * len(wins) / len(trades), 1),
        "pf": None if pf is None else round(pf, 2),
        "net": round(net, 0),
        "max_dd": round(max_dd, 0),
        "buckets": {
            "bull_below_50": side_stats(bull_below),
            "bull_above_50": side_stats(bull_above),
            "bear_above_50": side_stats(bear_above),
            "bear_below_50": side_stats(bear_below),
            "with_50_rule": side_stats(with_rule),
            "against_50_rule": side_stats(against_rule),
        },
        "monthly": monthly,
        "trades": trades,
        "skipped": skipped[:200],
        "m1_first": m1b.fmt_ts(int(m1[0]["time"])),
        "m1_last": m1b.fmt_ts(int(m1[-1]["time"])),
    }, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
