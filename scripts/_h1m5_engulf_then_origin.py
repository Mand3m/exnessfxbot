#!/usr/bin/env python3
"""After H1 through, wait for an M5 to engulf or close beyond the M5 that
printed the sweeping H1 extreme, then trade toward the origin.

Sell: through previous H1 3-bar high. Track the M5 whose high is the current
H1 high. Wait for a later M5 to bearish-engulf that bar or close below its
low. Enter at that close, SL at that High, TP at the M5 origin low.

Buy is the mirror. Risk 20k UGX. Gold Jan-Aug 2026.
"""
from __future__ import annotations

import json
import sys
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
MAX_WAIT = 500
REWARD_R = 3.0 if "--3r" in sys.argv else None
MAX_HOLD = 2000 if REWARD_R else 500
OUT = Path(
    r"C:\Users\GEORGE\exnessfxbot\data\h1m5-engulf-3r-xauusdz-jan-aug-2026.json"
    if REWARD_R
    else r"C:\Users\GEORGE\exnessfxbot\data\h1m5-engulf-then-origin-xauusdz-jan-aug-2026.json"
)


def ohlc(bar) -> tuple[float, float, float, float]:
    return float(bar["open"]), float(bar["high"]), float(bar["low"]), float(bar["close"])


def sell_trigger(cur, ref) -> str | None:
    """Later M5 vs the high-print M5. Trigger checked before promoting a new high."""
    co, ch, cl, cc = ohlc(cur)
    ro, rh, rl, rc = ohlc(ref)
    ref_top = max(ro, rc)
    ref_bot = min(ro, rc)
    close_below = cc < rl
    body_engulf = cc < co and co >= ref_top and cc <= ref_bot
    range_engulf = cc < co and ch >= rh and cl <= rl
    if close_below:
        return "close_below"
    if body_engulf or range_engulf:
        return "engulf"
    return None


def buy_trigger(cur, ref) -> str | None:
    co, ch, cl, cc = ohlc(cur)
    ro, rh, rl, rc = ohlc(ref)
    ref_top = max(ro, rc)
    ref_bot = min(ro, rc)
    close_above = cc > rh
    body_engulf = cc > co and co <= ref_bot and cc >= ref_top
    range_engulf = cc > co and cl <= rl and ch >= rh
    if close_above:
        return "close_above"
    if body_engulf or range_engulf:
        return "engulf"
    return None


def walk_trade(side: str, sl: float, tp: float, start_i: int, m5, m1_by_m5) -> tuple[int, float, str]:
    end_i = min(len(m5), start_i + 1 + MAX_HOLD)
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
    reasons = defaultdict(int)
    trigs = defaultdict(int)
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
        reasons[t["reason"]] += 1
        trigs[t.get("trig", "?")] += 1
    sells = [t for t in trades if t["side"] == "sell"]
    buys = [t for t in trades if t["side"] == "buy"]
    planned = [t["planned_r"] for t in trades]
    risks = [t["risk_price"] for t in trades]
    waits = [t["wait_m5"] for t in trades]
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

    print(f"\n=== {title} ===")
    if not trades:
        print("No trades")
        return {"title": title, "n": 0}
    print(f"Trades {len(trades)}  W {len(wins)}  L {len(losses)}  flat {len(flats)}")
    print(f"Win rate {100 * len(wins) / len(trades):.1f}%")
    print(f"PF {None if pf is None else round(pf, 2)}")
    print(f"Net {net:,.0f} UGX")
    print(f"Max DD (sequential) {max_dd:,.0f} UGX")
    print(f"Expectancy {net / len(trades):,.0f} UGX / trade")
    print(f"Avg R  wins {avg_r_w:.2f}  losses {avg_r_l:.2f}")
    print(
        f"Planned R  median {float(np.median(planned)):.2f}  "
        f"mean {float(np.mean(planned)):.2f}"
    )
    print(
        f"SL distance  median {float(np.median(risks)):.2f}  "
        f"mean {float(np.mean(risks)):.2f}"
    )
    print(
        f"Wait M5  median {float(np.median(waits)):.1f}  "
        f"mean {float(np.mean(waits)):.1f}"
    )
    print("exits", dict(reasons))
    print("trigger", dict(trigs))
    sb = side_block(sells)
    bb = side_block(buys)
    print(f"Sells n={sb['n']} WR {sb['wr']}% PF {sb['pf']} net {sb['pnl']:,.0f}")
    print(f"Buys  n={bb['n']} WR {bb['wr']}% PF {bb['pf']} net {bb['pnl']:,.0f}")
    print(f"{'Month':<10} {'N':>4} {'W':>3} {'L':>3} {'PnL UGX':>12} {'%':>8}")
    monthly = []
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
        "wr": round(100 * len(wins) / len(trades), 1),
        "pf": None if pf is None else round(pf, 2),
        "net": round(net, 0),
        "max_dd": round(max_dd, 0),
        "expectancy": round(net / len(trades), 0),
        "avg_r_win": round(avg_r_w, 2),
        "avg_r_loss": round(avg_r_l, 2),
        "planned_r_median": round(float(np.median(planned)), 2),
        "planned_r_mean": round(float(np.mean(planned)), 2),
        "sl_median": round(float(np.median(risks)), 2),
        "wait_m5_median": round(float(np.median(waits)), 1),
        "exits": dict(reasons),
        "trigger": dict(trigs),
        "sells": sb,
        "buys": bb,
        "monthly": monthly,
        "start_eq": start_eq,
        "end_eq": round(equity, 0),
    }


def next_h1_ts(h1, h1_i: int) -> int | None:
    if h1_i + 1 < len(h1):
        return int(h1[h1_i + 1]["time"])
    return None


def walk_watch(side: str, through_i: int, origin: float | None, h1_end_ts: int | None, m5):
    """From the bar after through, track the extreme M5 of this H1 until trigger/kill."""
    ref_i = through_i
    end_i = min(len(m5), through_i + 1 + MAX_WAIT)
    for k in range(through_i + 1, end_i):
        bar = m5[k]
        ts = int(bar["time"])
        ref = m5[ref_i]
        same_h1 = h1_end_ts is None or ts < h1_end_ts
        trig = sell_trigger(bar, ref) if side == "sell" else buy_trigger(bar, ref)
        if trig:
            hi, lo = float(bar["high"]), float(bar["low"])
            sl = max(float(ref["high"]), hi) if side == "sell" else min(float(ref["low"]), lo)
            return {
                "status": "trigger",
                "trig": trig,
                "k": k,
                "ref_i": ref_i,
                "wait_m5": k - through_i,
                "same_h1": same_h1,
                "sl": sl,
                "entry": float(bar["close"]),
            }
        if side == "sell":
            if origin is not None and float(bar["low"]) <= origin:
                return {"status": "origin_first", "k": k, "wait_m5": k - through_i}
            if float(bar["high"]) > float(ref["high"]):
                if same_h1:
                    ref_i = k
                else:
                    return {"status": "high_broken", "k": k, "wait_m5": k - through_i}
        else:
            if origin is not None and float(bar["high"]) >= origin:
                return {"status": "origin_first", "k": k, "wait_m5": k - through_i}
            if float(bar["low"]) < float(ref["low"]):
                if same_h1:
                    ref_i = k
                else:
                    return {"status": "low_broken", "k": k, "wait_m5": k - through_i}
    return {"status": "timeout", "k": end_i - 1, "wait_m5": end_i - 1 - through_i}


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
    occ_sell = defaultdict(int)
    occ_buy = defaultdict(int)
    setups: list[dict] = []
    skipped = []

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

    def record_through(side: str, i: int, origin_i, origin: float) -> None:
        ts = int(m5[i]["time"])
        occ = occ_sell if side == "sell" else occ_buy
        occ["through"] += 1
        if origin_i is None and REWARD_R is None:
            occ["no_origin"] += 1
            return
        h1_end = next_h1_ts(h1, h1_i)
        watch_origin = None if REWARD_R is not None else origin
        result = walk_watch(side, i, watch_origin, h1_end, m5)
        occ[result["status"]] += 1
        if result["status"] != "trigger":
            return
        occ[result["trig"]] += 1
        if result.get("same_h1"):
            occ["trigger_same_h1"] += 1
        else:
            occ["trigger_after_h1"] += 1
        k = result["k"]
        trig_ts = int(m5[k]["time"])
        entry_close = result["entry"]
        sl = result["sl"]
        if not bt.in_session(trig_ts) or bt.is_news(trig_ts):
            occ["trigger_off_session"] += 1
            skipped.append({"t": bt.fmt_ts(trig_ts), "side": side, "why": "session/news"})
            return
        sized = size_trade(side, entry_close, sl, tick_size, tick_value, vmin, vmax, step, spread_price)
        if sized is None:
            occ["skip_risk"] += 1
            skipped.append({
                "t": bt.fmt_ts(trig_ts), "side": side,
                "why": f"risk {(sl - entry_close) if side == 'sell' else (entry_close - sl):.3f}",
            })
            return
        if REWARD_R is not None:
            tp = (
                sized["fill"] - REWARD_R * sized["risk_price"]
                if side == "sell"
                else sized["fill"] + REWARD_R * sized["risk_price"]
            )
            tp_dist = REWARD_R * sized["risk_price"]
        else:
            tp = origin
            if (side == "sell" and sized["fill"] <= tp) or (side == "buy" and sized["fill"] >= tp):
                occ["already_at_tp"] += 1
                skipped.append({"t": bt.fmt_ts(trig_ts), "side": side, "why": "already at TP"})
                return
            tp_dist = (sized["fill"] - tp) if side == "sell" else (tp - sized["fill"])
        occ["traded"] += 1
        setups.append({
            "i": k,
            "through_i": i,
            "ts": trig_ts,
            "side": side,
            "trig": result["trig"],
            "wait_m5": result["wait_m5"],
            "same_h1": bool(result.get("same_h1")),
            "entry_time": bt.fmt_ts(trig_ts),
            "through_time": bt.fmt_ts(ts),
            "h1": bt.fmt_ts(int(h1[h1_i]["time"])),
            "origin_t": bt.fmt_ts(int(m5[origin_i]["time"])) if origin_i is not None else None,
            "ref_t": bt.fmt_ts(int(m5[result["ref_i"]]["time"])),
            "fill_close": round(entry_close, digits),
            "fill": round(sized["fill"], digits),
            "sl": round(sl, digits),
            "tp": round(tp, digits),
            "lot": sized["lot"],
            "risk_price": round(sized["risk_price"], digits),
            "risk_ugx": round(sized["risk_ugx"], 0),
            "planned_r": round(tp_dist / sized["risk_price"], 2) if sized["risk_price"] else 0.0,
        })

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

        mh, ml = float(bar["high"]), float(bar["low"])

        if last_high is not None and mh > last_high and last_high != consumed_high:
            consumed_high = last_high
            origin_i, origin_low = bt.first_swing_low_back(m5, i)
            record_through("sell", i, origin_i, origin_low if origin_i is not None else 0.0)

        if last_low is not None and ml < last_low and last_low != consumed_low:
            consumed_low = last_low
            origin_i, origin_high = bt.first_swing_high_back(m5, i)
            record_through("buy", i, origin_i, origin_high if origin_i is not None else 0.0)

    independent = []
    for s in setups:
        exit_ts, exit_px, reason = walk_trade(s["side"], s["sl"], s["tp"], s["i"], m5, m1_by_m5)
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

    def print_occ(label: str, occ: dict) -> None:
        through = occ.get("through", 0)
        trig = occ.get("trigger", 0)
        print(f"{label} throughs {through}")
        print(
            f"  pattern (engulf or close beyond) {trig}"
            + (f"  ({100 * trig / through:.1f}% of throughs)" if through else "")
        )
        print(
            f"    close_below/above {occ.get('close_below', 0) + occ.get('close_above', 0)}"
            f"  engulf {occ.get('engulf', 0)}"
            f"  same H1 {occ.get('trigger_same_h1', 0)}"
            f"  after H1 {occ.get('trigger_after_h1', 0)}"
        )
        print(
            f"  killed  origin first {occ.get('origin_first', 0)}"
            f"  high/low broken {occ.get('high_broken', 0) + occ.get('low_broken', 0)}"
            f"  timeout {occ.get('timeout', 0)}"
            f"  no origin {occ.get('no_origin', 0)}"
        )
        print(
            f"  of patterns: traded {occ.get('traded', 0)}"
            f"  already at TP {occ.get('already_at_tp', 0)}"
            f"  off session/news {occ.get('trigger_off_session', 0)}"
            f"  skip risk {occ.get('skip_risk', 0)}"
        )

    tp_lbl = f"{REWARD_R:g}R" if REWARD_R else "origin"
    print(f"=== XAUUSDz  wait engulf/close-beyond high-M5  TP={tp_lbl}  20k UGX ===")
    print("Window 2026-01-01 through 2026-08-31")
    print("After H1 3-bar through, track the M5 that holds the sweeping H1 extreme.")
    print("New extreme inside that H1 updates the reference bar.")
    print("Trigger = later M5 body/range-engulfs that bar, or closes beyond its far wick.")
    print("Trigger is checked before promoting a new extreme (reversal bar can fire).")
    print(f"Entry = trigger M5 close. SL = that High/Low. TP = {tp_lbl}. Manage next bar.")
    print()
    print_occ("SELLS", occ_sell)
    print()
    print_occ("BUYS ", occ_buy)
    print()
    print(f"Setups sized {len(setups)}  skipped {len(skipped)}  one-at-a-time busy {skipped_busy}")

    r_ind = summarize(independent, start_eq, "INDEPENDENT (every pattern, overlapping OK)")
    r_seq = summarize(one_at_a_time, start_eq, "ONE-AT-A-TIME (EA style)")
    if skipped[:8]:
        print("skip sample", skipped[:8])

    OUT.write_text(json.dumps({
        "occ_sell": dict(occ_sell),
        "occ_buy": dict(occ_buy),
        "skipped_busy": skipped_busy,
        "independent": r_ind,
        "one_at_a_time": r_seq,
        "trades_independent": independent,
        "trades_one_at_a_time": one_at_a_time,
    }, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
