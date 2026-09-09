#!/usr/bin/env python3
"""H1 through -> trade toward M5 origin.

Sell: entry = through M5 close, SL = sweeping H1 high known at that close,
TP = origin M5 3-bar low. Buy is the mirror. Risk 20k UGX.
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import MetaTrader5 as mt5
import numpy as np

import backtest_h1_swing_m5_break as bt

bt.SYMBOL = "XAUUSDz"
FROM_DT = datetime(2026, 1, 1)
TO_DT = datetime(2026, 9, 1)
PRELOAD = datetime(2025, 12, 28)
RISK = 20_000.0
MIN_RISK = 0.30
MAX_M5 = 500
OUT = Path(r"C:\Users\GEORGE\exnessfxbot\data\h1m5-sell-to-origin-xauusdz-jan-aug-2026.json")


def h1_extreme_so_far(m5, i: int, h1_open_ts: int, side: str) -> float:
    """High/low of the current H1 from its open through this M5 bar (no look-ahead)."""
    j = i
    ext = float(m5[i]["high"] if side == "sell" else m5[i]["low"])
    while j >= 0 and int(m5[j]["time"]) >= h1_open_ts:
        if side == "sell":
            ext = max(ext, float(m5[j]["high"]))
        else:
            ext = min(ext, float(m5[j]["low"]))
        j -= 1
    return ext


def walk_trade(side: str, entry: float, sl: float, tp: float, start_i: int, m5, m1_by_m5) -> tuple[int, float, str]:
    """Manage from the bar AFTER entry. Same-bar SL+TP = SL first. Returns ts, price, reason."""
    end_i = min(len(m5), start_i + 1 + MAX_M5)
    for k in range(start_i + 1, end_i):
        ts = int(m5[k]["time"])
        path = m1_by_m5.get(ts) or [m5[k]]
        for pbar in path:
            hi, lo = float(pbar["high"]), float(pbar["low"])
            pts = int(pbar["time"])
            if side == "sell":
                hit_sl, hit_tp = hi >= sl, lo <= tp
                if hit_sl and hit_tp:
                    return pts, sl, "SL (same-bar both)"
                if hit_sl:
                    return pts, sl, "SL"
                if hit_tp:
                    return pts, tp, "TP"
            else:
                hit_sl, hit_tp = lo <= sl, hi >= tp
                if hit_sl and hit_tp:
                    return pts, sl, "SL (same-bar both)"
                if hit_sl:
                    return pts, sl, "SL"
                if hit_tp:
                    return pts, tp, "TP"
    last = m5[end_i - 1]
    return int(last["time"]), float(last["close"]), "time"


def size_trade(side: str, entry: float, sl: float, tick_size: float, tick_value: float,
               vmin: float, vmax: float, step: float, spread_price: float) -> dict | None:
    fill = entry + spread_price if side == "buy" else entry
    risk_price = (sl - fill) if side == "sell" else (fill - sl)
    if risk_price <= MIN_RISK:
        return None
    sl_ticks = risk_price / tick_size
    raw_lot = RISK / (sl_ticks * tick_value)
    if raw_lot < vmin:
        lot = vmin
    else:
        lot = bt.round_lot(raw_lot, step, vmin, vmax)
    actual_risk = sl_ticks * tick_value * lot
    return {"fill": fill, "lot": lot, "risk_price": risk_price, "risk_ugx": actual_risk}


def pnl_ugx(side: str, fill: float, exit_px: float, lot: float, tick_size: float, tick_value: float) -> float:
    if side == "sell":
        return (fill - exit_px) * (lot / tick_size) * tick_value
    return (exit_px - fill) * (lot / tick_size) * tick_value


def summarize(trades: list[dict], start_eq: float, title: str) -> dict:
    wins = [t for t in trades if t["pnl_ugx"] > 0]
    losses = [t for t in trades if t["pnl_ugx"] < 0]
    flats = [t for t in trades if t["pnl_ugx"] == 0]
    gw = sum(t["pnl_ugx"] for t in wins)
    gl = abs(sum(t["pnl_ugx"] for t in losses))
    pf = (gw / gl) if gl else None
    net = sum(t["pnl_ugx"] for t in trades)
    equity = start_eq
    peak = start_eq
    max_dd = 0.0
    by = defaultdict(lambda: {"n": 0, "w": 0, "l": 0, "pnl": 0.0, "eq0": 0.0})
    for t in trades:
        m = t["entry_time"][:7]
        if by[m]["n"] == 0:
            by[m]["eq0"] = equity
        by[m]["n"] += 1
        by[m]["pnl"] += t["pnl_ugx"]
        if t["pnl_ugx"] > 0:
            by[m]["w"] += 1
        else:
            by[m]["l"] += 1
        equity += t["pnl_ugx"]
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
    reasons = defaultdict(int)
    for t in trades:
        reasons[t["reason"]] += 1
    sells = [t for t in trades if t["side"] == "sell"]
    buys = [t for t in trades if t["side"] == "buy"]
    planned = [t["planned_r"] for t in trades]
    risks = [t["risk_price"] for t in trades]
    avg_r_w = (sum(t["r"] for t in wins) / len(wins)) if wins else 0.0
    avg_r_l = (sum(t["r"] for t in losses) / len(losses)) if losses else 0.0

    def side_block(rows: list[dict]) -> dict:
        if not rows:
            return {"n": 0, "w": 0, "wr": None, "pnl": 0.0, "pf": None}
        w = [t for t in rows if t["pnl_ugx"] > 0]
        l = [t for t in rows if t["pnl_ugx"] < 0]
        gww = sum(t["pnl_ugx"] for t in w)
        gll = abs(sum(t["pnl_ugx"] for t in l))
        return {
            "n": len(rows),
            "w": len(w),
            "wr": round(100 * len(w) / len(rows), 1),
            "pnl": round(sum(t["pnl_ugx"] for t in rows), 0),
            "pf": None if not gll else round(gww / gll, 2),
        }

    monthly = []
    print(f"\n=== {title} ===")
    print(f"Trades {len(trades)}  W {len(wins)}  L {len(losses)}  flat {len(flats)}")
    print(f"Win rate {100 * len(wins) / len(trades):.1f}%" if trades else "Win rate n/a")
    print(f"PF {None if pf is None else round(pf, 2)}")
    print(f"Net {net:,.0f} UGX")
    print(f"Max DD (sequential) {max_dd:,.0f} UGX")
    print(f"Expectancy {net / len(trades):,.0f} UGX / trade" if trades else "")
    print(f"Avg R  wins {avg_r_w:.2f}  losses {avg_r_l:.2f}")
    if planned:
        print(
            f"Planned R  median {float(np.median(planned)):.2f}  "
            f"mean {float(np.mean(planned)):.2f}"
        )
    if risks:
        print(
            f"SL distance  median {float(np.median(risks)):.2f}  "
            f"mean {float(np.mean(risks)):.2f}"
        )
    print("exits", dict(reasons))
    sb = side_block(sells)
    bb = side_block(buys)
    print(f"Sells n={sb['n']} WR {sb['wr']}% PF {sb['pf']} net {sb['pnl']:,.0f}")
    print(f"Buys  n={bb['n']} WR {bb['wr']}% PF {bb['pf']} net {bb['pnl']:,.0f}")
    print(f"{'Month':<10} {'N':>4} {'W':>3} {'L':>3} {'PnL UGX':>12} {'%':>8}")
    for month in sorted(by):
        x = by[month]
        pct = x["pnl"] / x["eq0"] * 100 if x["eq0"] else 0.0
        print(f"{month:<10} {x['n']:4} {x['w']:3} {x['l']:3} {x['pnl']:12,.0f} {pct:+7.2f}%")
        monthly.append({
            "month": month, "n": x["n"], "w": x["w"], "l": x["l"],
            "pnl": round(x["pnl"], 0), "pct": round(pct, 2),
        })
    print(f"Equity {start_eq:,.0f} -> {equity:,.0f} UGX")
    return {
        "title": title,
        "n": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "flats": len(flats),
        "wr": None if not trades else round(100 * len(wins) / len(trades), 1),
        "pf": None if pf is None else round(pf, 2),
        "net": round(net, 0),
        "max_dd": round(max_dd, 0),
        "expectancy": None if not trades else round(net / len(trades), 0),
        "avg_r_win": round(avg_r_w, 2),
        "avg_r_loss": round(avg_r_l, 2),
        "planned_r_median": None if not planned else round(float(np.median(planned)), 2),
        "planned_r_mean": None if not planned else round(float(np.mean(planned)), 2),
        "sl_median": None if not risks else round(float(np.median(risks)), 2),
        "exits": dict(reasons),
        "sells": sb,
        "buys": bb,
        "monthly": monthly,
        "start_eq": start_eq,
        "end_eq": round(equity, 0),
    }


def main() -> None:
    if not mt5.initialize():
        raise SystemExit(mt5.last_error())
    acc = mt5.account_info()
    spec = mt5.symbol_info(bt.SYMBOL)
    h1 = bt.fetch_range(mt5.TIMEFRAME_H1, PRELOAD, TO_DT)
    m5 = bt.fetch_range(mt5.TIMEFRAME_M5, PRELOAD, TO_DT)
    m1 = bt.fetch_range(mt5.TIMEFRAME_M1, PRELOAD, TO_DT)
    mt5.shutdown()
    if h1 is None or m5 is None:
        raise SystemExit("no history")

    point = spec.point or 0.001
    tick_size = spec.trade_tick_size or point
    tick_value = spec.trade_tick_value
    vmin = spec.volume_min or 0.01
    vmax = spec.volume_max or 200.0
    step = spec.volume_step or 0.01
    digits = spec.digits
    spread_pts = int(spec.spread) if spec.spread is not None else 50
    spread_price = spread_pts * point

    m1_by_m5: dict[int, list] = defaultdict(list)
    if m1 is not None:
        for bar in m1:
            m1_by_m5[bt.hour_key(int(bar["time"]), 300)].append(bar)

    trade_from = int(FROM_DT.replace(tzinfo=timezone.utc).timestamp())
    trade_to = int(TO_DT.replace(tzinfo=timezone.utc).timestamp())
    start_eq = float(acc.equity) if acc else 5_152_822.0

    last_high = last_low = None
    consumed_high = consumed_low = None
    h1_i = 0
    stats = defaultdict(int)
    skipped = []
    setups: list[dict] = []

    def on_h1_close(i: int) -> None:
        nonlocal last_high, last_low
        if i < 2:
            return
        left, mid, right = h1[i - 2], h1[i - 1], h1[i]
        if float(mid["high"]) > float(left["high"]) and float(mid["high"]) > float(right["high"]):
            last_high = float(mid["high"])
            stats["h1_highs"] += 1
        if float(mid["low"]) < float(left["low"]) and float(mid["low"]) < float(right["low"]):
            last_low = float(mid["low"])
            stats["h1_lows"] += 1

    for i, bar in enumerate(m5):
        ts = int(bar["time"])
        if ts >= trade_to:
            break
        while h1_i + 1 < len(h1) and ts >= int(h1[h1_i + 1]["time"]):
            on_h1_close(h1_i)
            h1_i += 1
        if ts < trade_from:
            continue
        if not bt.in_session(ts) or bt.is_news(ts):
            continue

        mh, ml, mc = float(bar["high"]), float(bar["low"]), float(bar["close"])
        h1_open_ts = int(h1[h1_i]["time"])
        h1_t = bt.fmt_ts(h1_open_ts)

        if last_high is not None and mh > last_high and last_high != consumed_high:
            origin_i, origin_low = bt.first_swing_low_back(m5, i)
            consumed_high = last_high
            stats["sell_cross"] += 1
            if origin_i is None:
                stats["no_origin"] += 1
            elif mc <= origin_low:
                stats["already_at_tp"] += 1
            else:
                sl = h1_extreme_so_far(m5, i, h1_open_ts, "sell")
                sized = size_trade("sell", mc, sl, tick_size, tick_value, vmin, vmax, step, spread_price)
                if sized is None:
                    skipped.append({"t": bt.fmt_ts(ts), "side": "sell", "why": f"risk {sl - mc:.3f}"})
                    stats["skip_risk"] += 1
                else:
                    tp_dist = sized["fill"] - origin_low
                    setups.append({
                        "i": i,
                        "ts": ts,
                        "side": "sell",
                        "entry_time": bt.fmt_ts(ts),
                        "h1": h1_t,
                        "origin_t": bt.fmt_ts(int(m5[origin_i]["time"])),
                        "h1_level": round(last_high, digits),
                        "entry_close": round(mc, digits),
                        "fill": round(sized["fill"], digits),
                        "sl": round(sl, digits),
                        "tp": round(origin_low, digits),
                        "lot": sized["lot"],
                        "risk_price": round(sized["risk_price"], digits),
                        "risk_ugx": round(sized["risk_ugx"], 0),
                        "planned_r": round(tp_dist / sized["risk_price"], 2) if sized["risk_price"] else 0.0,
                    })

        if last_low is not None and ml < last_low and last_low != consumed_low:
            origin_i, origin_high = bt.first_swing_high_back(m5, i)
            consumed_low = last_low
            stats["buy_cross"] += 1
            if origin_i is None:
                stats["no_origin"] += 1
            elif mc >= origin_high:
                stats["already_at_tp"] += 1
            else:
                sl = h1_extreme_so_far(m5, i, h1_open_ts, "buy")
                sized = size_trade("buy", mc, sl, tick_size, tick_value, vmin, vmax, step, spread_price)
                if sized is None:
                    skipped.append({"t": bt.fmt_ts(ts), "side": "buy", "why": f"risk {mc + spread_price - sl:.3f}"})
                    stats["skip_risk"] += 1
                else:
                    tp_dist = origin_high - sized["fill"]
                    setups.append({
                        "i": i,
                        "ts": ts,
                        "side": "buy",
                        "entry_time": bt.fmt_ts(ts),
                        "h1": h1_t,
                        "origin_t": bt.fmt_ts(int(m5[origin_i]["time"])),
                        "h1_level": round(last_low, digits),
                        "entry_close": round(mc, digits),
                        "fill": round(sized["fill"], digits),
                        "sl": round(sl, digits),
                        "tp": round(origin_high, digits),
                        "lot": sized["lot"],
                        "risk_price": round(sized["risk_price"], digits),
                        "risk_ugx": round(sized["risk_ugx"], 0),
                        "planned_r": round(tp_dist / sized["risk_price"], 2) if sized["risk_price"] else 0.0,
                    })

    independent = []
    for s in setups:
        exit_ts, exit_px, reason = walk_trade(s["side"], s["fill"], s["sl"], s["tp"], s["i"], m5, m1_by_m5)
        pnl = pnl_ugx(s["side"], s["fill"], exit_px, s["lot"], tick_size, tick_value)
        r = pnl / s["risk_ugx"] if s["risk_ugx"] else 0.0
        independent.append({
            **s,
            "exit_time": bt.fmt_ts(exit_ts),
            "exit": round(exit_px, digits),
            "reason": reason,
            "pnl_ugx": round(pnl, 0),
            "r": round(r, 2),
        })

    one_at_a_time = []
    busy_until = 0
    skipped_busy = 0
    for t in independent:
        if t["ts"] < busy_until:
            skipped_busy += 1
            continue
        one_at_a_time.append(t)
        busy_until = datetime.strptime(t["exit_time"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc).timestamp()

    print("=== XAUUSDz  toward M5 origin  SL=H1 high-so-far  TP=origin  20k UGX ===")
    print("Window 2026-01-01 through 2026-08-31  entry = through M5 close")
    print("SL = sweeping H1 candle extreme known at that M5 close (no rest-of-hour look-ahead)")
    print("Manage from next bar. Same-bar SL+TP = SL first. Timeout 500 M5 (~41h).")
    print(
        f"Crosses sell {stats['sell_cross']} buy {stats['buy_cross']}  "
        f"no origin {stats['no_origin']}  already at TP {stats['already_at_tp']}  "
        f"skip risk {stats['skip_risk']}"
    )
    print(f"Setups sized {len(setups)}  skipped {len(skipped)}")
    print(f"One-at-a-time skipped because busy {skipped_busy}")

    r_ind = summarize(independent, start_eq, "INDEPENDENT (every through, overlapping OK)")
    r_seq = summarize(one_at_a_time, start_eq, "ONE-AT-A-TIME (EA style)")
    if skipped[:8]:
        print("skip sample", skipped[:8])

    OUT.write_text(json.dumps({
        "stats": dict(stats),
        "skipped_busy": skipped_busy,
        "independent": r_ind,
        "one_at_a_time": r_seq,
        "trades_independent": independent,
        "trades_one_at_a_time": one_at_a_time,
    }, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
