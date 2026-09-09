#!/usr/bin/env python3
"""H1 3-bar through -> M5 highest-wick through candle.

Sell: previous H1 3-bar high is swept. On M5, the candle with the highest
wick of that through is the reference. Wait for a later M5 to close below
(or take) that candle's LOW. Then sell LIMIT at that low, SL at that high,
TP 3R.

Buy is the mirror. Gold Jan-Aug 2026, 20k UGX.
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
REWARD_R = 3.0
MIN_RISK = 0.30
MAX_WAIT = 500
MAX_PEND = 500
MAX_HOLD = 2000
OUT = Path(r"C:\Users\GEORGE\exnessfxbot\data\h1m5-through-m5-limit-3r-xauusdz-jan-aug-2026.json")


def ohlc(bar):
    return float(bar["open"]), float(bar["high"]), float(bar["low"]), float(bar["close"])


def next_h1_ts(h1, h1_i: int) -> int | None:
    if h1_i + 1 < len(h1):
        return int(h1[h1_i + 1]["time"])
    return None


def size_trade(side: str, entry: float, sl: float, tick_size: float, tick_value: float,
               vmin: float, vmax: float, step: float, spread_price: float) -> dict | None:
    fill = entry + spread_price if side == "buy" else entry
    risk_price = (sl - fill) if side == "sell" else (fill - sl)
    if risk_price <= MIN_RISK:
        return None
    sl_ticks = risk_price / tick_size
    raw_lot = RISK / (sl_ticks * tick_value)
    lot = vmin if raw_lot < vmin else bt.round_lot(raw_lot, step, vmin, vmax)
    actual_risk = sl_ticks * tick_value * lot
    tp = fill - REWARD_R * risk_price if side == "sell" else fill + REWARD_R * risk_price
    return {"fill": fill, "lot": lot, "risk_price": risk_price, "risk_ugx": actual_risk, "tp": tp}


def pnl_ugx(side: str, fill: float, exit_px: float, lot: float, tick_size: float, tick_value: float) -> float:
    if side == "sell":
        return (fill - exit_px) * (lot / tick_size) * tick_value
    return (exit_px - fill) * (lot / tick_size) * tick_value


def manage_from(side: str, sl: float, tp: float, start_k: int, m5, m1_by_m5,
                skip_first_path: int = 0) -> tuple[int, float, str]:
    """Manage after fill. skip_first_path = M1 index already used for the fill."""
    end_i = min(len(m5), start_k + 1 + MAX_HOLD)
    for k in range(start_k, end_i):
        ts = int(m5[k]["time"])
        path = m1_by_m5.get(ts) or [m5[k]]
        start_p = skip_first_path if k == start_k else 0
        for pbar in path[start_p:]:
            hi, lo = float(pbar["high"]), float(pbar["low"])
            pts = int(pbar["time"])
            if side == "sell":
                hit_sl, hit_tp = hi >= sl, lo <= tp
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


def walk_setup(side: str, through_i: int, h1_end_ts: int | None, m5, m1_by_m5) -> dict:
    """Highest-wick through M5, wait for later M5 to take/close beyond its far wick,
    then LIMIT at that far wick, SL at the extreme wick, TP 3R.
    """
    ref_i = through_i
    trig_i = None
    trig = None
    end_trig = min(len(m5), through_i + 1 + MAX_WAIT)

    for k in range(through_i + 1, end_trig):
        bar = m5[k]
        ts = int(bar["time"])
        _o, h, l, c = ohlc(bar)
        rh, rl = float(m5[ref_i]["high"]), float(m5[ref_i]["low"])
        same_h1 = h1_end_ts is None or ts < h1_end_ts

        if side == "sell":
            new_ext = h > rh
        else:
            new_ext = l < rl

        if new_ext:
            if same_h1:
                ref_i = k
                continue
            return {"status": "extreme_broken", "ref_i": ref_i, "k": k, "wait_m5": k - through_i}

        if side == "sell":
            if c < rl:
                trig = "close_below"
            elif l < rl:
                trig = "engulf_low"
        else:
            if c > rh:
                trig = "close_above"
            elif h > rh:
                trig = "engulf_high"

        if trig:
            # Only a close beyond the far wick leaves price on the correct side
            # of a LIMIT at that wick. A wick-only engulf keeps watching.
            if trig in ("engulf_low", "engulf_high"):
                continue
            trig_i = k
            break
    else:
        return {"status": "timeout_trigger", "ref_i": ref_i, "wait_m5": end_trig - 1 - through_i}

    ref = m5[ref_i]
    rh, rl = float(ref["high"]), float(ref["low"])
    limit = rl if side == "sell" else rh
    sl = rh if side == "sell" else rl
    if sl == limit:
        return {"status": "flat_range", "ref_i": ref_i, "trig_i": trig_i, "trig": trig}

    end_pend = min(len(m5), trig_i + 1 + MAX_PEND)
    for k in range(trig_i + 1, end_pend):
        ts = int(m5[k]["time"])
        path = m1_by_m5.get(ts) or [m5[k]]
        for pi, pbar in enumerate(path):
            po, ph, pl, _pc = ohlc(pbar)
            if side == "sell":
                # From below the limit: a gap through the high invalidates.
                if po >= sl:
                    return {
                        "status": "gap_through_sl", "ref_i": ref_i, "trig_i": trig_i,
                        "trig": trig, "k": k, "wait_m5": trig_i - through_i,
                    }
                if ph >= limit:
                    fill_px = limit
                    sized_ok = True
                    return {
                        "status": "fill",
                        "ref_i": ref_i,
                        "trig_i": trig_i,
                        "trig": trig,
                        "fill_k": k,
                        "fill_pi": pi,
                        "fill_ts": int(pbar["time"]),
                        "limit": limit,
                        "sl": sl,
                        "fill_px": fill_px,
                        "wait_m5": trig_i - through_i,
                        "pend_m5": k - trig_i,
                        "same_h1_trig": h1_end_ts is None or int(m5[trig_i]["time"]) < h1_end_ts,
                    }
            else:
                if po <= sl:
                    return {
                        "status": "gap_through_sl", "ref_i": ref_i, "trig_i": trig_i,
                        "trig": trig, "k": k, "wait_m5": trig_i - through_i,
                    }
                if pl <= limit:
                    return {
                        "status": "fill",
                        "ref_i": ref_i,
                        "trig_i": trig_i,
                        "trig": trig,
                        "fill_k": k,
                        "fill_pi": pi,
                        "fill_ts": int(pbar["time"]),
                        "limit": limit,
                        "sl": sl,
                        "fill_px": limit,
                        "wait_m5": trig_i - through_i,
                        "pend_m5": k - trig_i,
                        "same_h1_trig": h1_end_ts is None or int(m5[trig_i]["time"]) < h1_end_ts,
                    }
    return {
        "status": "limit_miss",
        "ref_i": ref_i,
        "trig_i": trig_i,
        "trig": trig,
        "wait_m5": trig_i - through_i,
    }


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
    sells = [t for t in trades if t["side"] == "sell"]
    buys = [t for t in trades if t["side"] == "buy"]
    planned = [t["planned_r"] for t in trades]
    risks = [t["risk_price"] for t in trades]
    avg_r_w = (sum(t["r"] for t in wins) / len(wins)) if wins else 0.0
    avg_r_l = (sum(t["r"] for t in losses) / len(losses)) if losses else 0.0

    def side_block(rows):
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
    print(f"Planned R  median {float(np.median(planned)):.2f}  mean {float(np.mean(planned)):.2f}")
    print(f"SL distance (M5 range)  median {float(np.median(risks)):.2f}  mean {float(np.mean(risks)):.2f}")
    print("exits", dict(reasons))
    sb, bb = side_block(sells), side_block(buys)
    print(f"Sells n={sb['n']} WR {sb['wr']}% PF {sb['pf']} net {sb['pnl']:,.0f}")
    print(f"Buys  n={bb['n']} WR {bb['wr']}% PF {bb['pf']} net {bb['pnl']:,.0f}")
    print(f"{'Month':<10} {'N':>4} {'W':>3} {'L':>3} {'PnL UGX':>12} {'%':>8}")
    monthly = []
    for month in sorted(by):
        x = by[month]
        pct = x["pnl"] / x["eq0"] * 100 if x["eq0"] else 0.0
        print(f"{month:<10} {x['n']:4} {x['w']:3} {x['l']:3} {x['pnl']:12,.0f} {pct:+7.2f}%")
        monthly.append({"month": month, "n": x["n"], "w": x["w"], "l": x["l"],
                        "pnl": round(x["pnl"], 0), "pct": round(pct, 2)})
    print(f"Equity {start_eq:,.0f} -> {equity:,.0f} UGX")
    return {
        "title": title, "n": len(trades), "wins": len(wins), "losses": len(losses),
        "wr": round(100 * len(wins) / len(trades), 1),
        "pf": None if pf is None else round(pf, 2),
        "net": round(net, 0), "max_dd": round(max_dd, 0),
        "expectancy": round(net / len(trades), 0),
        "avg_r_win": round(avg_r_w, 2), "avg_r_loss": round(avg_r_l, 2),
        "sl_median": round(float(np.median(risks)), 2),
        "exits": dict(reasons), "sells": sb, "buys": bb, "monthly": monthly,
        "start_eq": start_eq, "end_eq": round(equity, 0),
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
        if float(mid["low"]) < float(left["low"]) and float(mid["low"]) < float(right["low"]):
            last_low = float(mid["low"])

    def record(side: str, i: int) -> None:
        occ = occ_sell if side == "sell" else occ_buy
        occ["through"] += 1
        h1_end = next_h1_ts(h1, h1_i)
        result = walk_setup(side, i, h1_end, m5, m1_by_m5)
        occ[result["status"]] += 1
        if result.get("trig"):
            occ[result["trig"]] += 1
        if result["status"] != "fill":
            return
        trig_ts = int(m5[result["trig_i"]]["time"])
        if not bt.in_session(trig_ts) or bt.is_news(trig_ts):
            occ["trigger_off_session"] += 1
            skipped.append({"t": bt.fmt_ts(trig_ts), "side": side, "why": "session/news"})
            return
        sized = size_trade(side, result["fill_px"], result["sl"], tick_size, tick_value,
                           vmin, vmax, step, spread_price)
        if sized is None:
            occ["skip_risk"] += 1
            skipped.append({"t": bt.fmt_ts(result["fill_ts"]), "side": side, "why": "risk"})
            return
        occ["traded"] += 1
        sl_used = result["sl"] if side == "sell" else sized["fill"] - sized["risk_price"]
        exit_ts, exit_px, reason = manage_from(
            side, sl_used, sized["tp"], result["fill_k"], m5, m1_by_m5,
            skip_first_path=result["fill_pi"] + 1,
        )
        pnl = pnl_ugx(side, sized["fill"], exit_px, sized["lot"], tick_size, tick_value)
        r = pnl / sized["risk_ugx"] if sized["risk_ugx"] else 0.0
        setups.append({
            "side": side,
            "trig": result["trig"],
            "wait_m5": result["wait_m5"],
            "pend_m5": result["pend_m5"],
            "same_h1_trig": bool(result.get("same_h1_trig")),
            "through_time": bt.fmt_ts(int(m5[i]["time"])),
            "ref_t": bt.fmt_ts(int(m5[result["ref_i"]]["time"])),
            "trig_t": bt.fmt_ts(trig_ts),
            "entry_time": bt.fmt_ts(result["fill_ts"]),
            "ts": result["fill_ts"],
            "fill": round(sized["fill"], digits),
            "sl": round(sl_used if side == "buy" else result["sl"], digits),
            "tp": round(sized["tp"], digits),
            "lot": sized["lot"],
            "risk_price": round(sized["risk_price"], digits),
            "risk_ugx": round(sized["risk_ugx"], 0),
            "planned_r": REWARD_R,
            "exit_time": bt.fmt_ts(exit_ts),
            "exit": round(exit_px, digits),
            "reason": reason,
            "pnl_ugx": round(pnl, 0),
            "r": round(r, 2),
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
            record("sell", i)
        if last_low is not None and ml < last_low and last_low != consumed_low:
            consumed_low = last_low
            record("buy", i)

    independent = setups
    one_at_a_time = []
    busy_until = 0
    skipped_busy = 0
    for t in independent:
        if t["ts"] < busy_until:
            skipped_busy += 1
            continue
        one_at_a_time.append(t)
        busy_until = datetime.strptime(t["exit_time"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc).timestamp()

    def print_occ(label, occ):
        through = occ.get("through", 0)
        trig = occ.get("close_below", 0) + occ.get("close_above", 0)
        print(f"{label} throughs {through}")
        print(
            f"  later M5 closed beyond the through-M5 low/high  {trig}"
            + (f"  ({100 * trig / through:.1f}% of throughs)" if through else "")
        )
        print(
            f"  fills {occ.get('fill', 0)}  traded {occ.get('traded', 0)}"
            f"  limit miss {occ.get('limit_miss', 0)}"
            f"  extreme broken {occ.get('extreme_broken', 0)}"
            f"  timeout {occ.get('timeout_trigger', 0)}"
            f"  gap SL {occ.get('gap_through_sl', 0)}"
            f"  off session {occ.get('trigger_off_session', 0)}"
            f"  skip risk {occ.get('skip_risk', 0)}"
            f"  flat {occ.get('flat_range', 0)}"
        )

    print("=== XAUUSDz  through-M5 high/low LIMIT  TP=3R  20k UGX ===")
    print("Window 2026-01-01 through 2026-08-31")
    print("Ref = M5 with the highest (lowest) wick of the H1 through.")
    print("Trigger = a later M5 CLOSES below that M5's low (buys: above its high).")
    print("Wick-only through the low is not enough (would make the limit marketable the wrong way).")
    print("Then LIMIT at that low/high, SL at the through-M5 high/low, TP 3R.")
    print("Fill = retest of the limit after the trigger close. Manage from the fill tick.")
    print()
    print_occ("SELLS", occ_sell)
    print()
    print_occ("BUYS ", occ_buy)
    print()
    print(f"Fills sized {len(setups)}  skipped {len(skipped)}  one-at-a-time busy {skipped_busy}")

    r_ind = summarize(independent, start_eq, "INDEPENDENT (every fill, overlapping OK)")
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
