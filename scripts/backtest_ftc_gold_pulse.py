#!/usr/bin/env python3
"""Backtest FTC Gold Pulse. Rules are fixed; this file does not retune them.

H1 gold. Longs only when price is above a rising EMA(34) and an H1 bar
touches that EMA then closes back above it. Shorts are the mirror.
Enter at the next bar's open. Stop is beyond the signal bar by 0.15 ATR.
Target is 2R. One trade at a time. If stop and target print on the same
bar, the stop is counted.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

import MetaTrader5 as mt5
import numpy as np

EMA_N = 34
ATR_N = 14
ATR_PAD = 0.15
REWARD_R = 2.0
RISK_PCT = 0.5
HOUR_FROM = 7
HOUR_TO = 17
MAX_HOLD = 30
MIN_RISK = 0.40
MAX_RISK = 40.0
MAX_SPREAD_POINTS = 80
START = datetime(2024, 1, 1, tzinfo=timezone.utc)
END = datetime(2026, 9, 24, tzinfo=timezone.utc)


def ema(close: np.ndarray, n: int) -> np.ndarray:
    out = np.full(len(close), np.nan)
    if len(close) < n:
        return out
    k = 2.0 / (n + 1.0)
    seed = float(np.mean(close[:n]))
    out[n - 1] = seed
    for i in range(n, len(close)):
        out[i] = close[i] * k + out[i - 1] * (1.0 - k)
    return out


def atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, n: int) -> np.ndarray:
    out = np.full(len(close), np.nan)
    tr = np.zeros(len(close))
    tr[0] = high[0] - low[0]
    for i in range(1, len(close)):
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))
    if len(close) < n + 1:
        return out
    out[n] = float(np.mean(tr[1 : n + 1]))
    for i in range(n + 1, len(close)):
        out[i] = (out[i - 1] * (n - 1) + tr[i]) / n
    return out


def summarize(trades: list[dict], start_eq: float) -> dict:
    pnls = [t["pnl"] for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    net = float(sum(pnls))
    gross_win = float(sum(wins))
    gross_loss = float(-sum(losses))
    eq = start_eq
    peak = start_eq
    max_dd = 0.0
    for p in pnls:
        eq += p
        peak = max(peak, eq)
        max_dd = max(max_dd, peak - eq)
    return {
        "trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": (100.0 * len(wins) / len(trades)) if trades else 0.0,
        "profit_factor": (gross_win / gross_loss) if gross_loss > 0 else None,
        "net": net,
        "expectancy": (net / len(trades)) if trades else 0.0,
        "max_dd": max_dd,
        "end_equity": start_eq + net,
    }


def run(symbol: str) -> None:
    path = r"C:\Users\GEORGE\AppData\Roaming\MetaTrader 5\terminal64.exe"
    if not mt5.initialize(path, timeout=180000):
        raise SystemExit(f"MT5 initialize failed: {mt5.last_error()}")
    if not mt5.symbol_select(symbol, True):
        mt5.shutdown()
        raise SystemExit(f"symbol missing: {symbol}")
    spec = None
    for _ in range(10):
        spec = mt5.symbol_info(symbol)
        if spec is not None and spec.trade_tick_value:
            break
        mt5.symbol_select(symbol, True)
    rates = mt5.copy_rates_range(symbol, mt5.TIMEFRAME_H1, START, END)
    acc = mt5.account_info()
    mt5.shutdown()
    if rates is None or len(rates) < ATR_N + EMA_N + 5:
        raise SystemExit(f"not enough H1 bars for {symbol}: {0 if rates is None else len(rates)}")

    point = float(spec.point or 0.01)
    tick_size = float(spec.trade_tick_size or point)
    tick_value = float(spec.trade_tick_value or 0.0)
    vmin = float(spec.volume_min or 0.01)
    step = float(spec.volume_step or 0.01)
    if tick_value <= 0 or tick_size <= 0:
        raise SystemExit("missing tick value")
    ccy = acc.currency if acc else "UGX"
    # Fixed test balance. The live account is too small for gold's 0.01 minimum
    # at 0.5% risk, which would skip every trade and hide the rule's results.
    equity = 5_000_000.0
    start_eq = equity

    h = rates["high"].astype(float)
    l = rates["low"].astype(float)
    c = rates["close"].astype(float)
    o = rates["open"].astype(float)
    spread = rates["spread"].astype(int)
    times = rates["time"].astype(np.int64)
    e = ema(c, EMA_N)
    a = atr(h, l, c, ATR_N)

    trades: list[dict] = []
    pos = None
    for i in range(max(EMA_N + 3, ATR_N + 1), len(rates) - 1):
        if pos is not None:
            held = i - pos["entry_i"]
            hit_sl = l[i] <= pos["sl"] if pos["side"] == "buy" else h[i] >= pos["sl"]
            hit_tp = h[i] >= pos["tp"] if pos["side"] == "buy" else l[i] <= pos["tp"]
            exit_px = None
            reason = ""
            if hit_sl:
                exit_px = pos["sl"]
                reason = "stop"
            elif hit_tp:
                exit_px = pos["tp"]
                reason = "target"
            elif held >= MAX_HOLD:
                exit_px = c[i]
                reason = "time"
            if exit_px is not None:
                if pos["side"] == "buy":
                    diff = exit_px - pos["entry"]
                else:
                    diff = pos["entry"] - exit_px
                pnl = (diff / tick_size) * tick_value * pos["lot"]
                equity += pnl
                trades.append({"pnl": pnl, "reason": reason, "side": pos["side"], "time": int(times[i])})
                pos = None
            continue

        if np.isnan(e[i]) or np.isnan(e[i - 3]) or np.isnan(a[i]) or a[i] <= 0:
            continue
        hour = datetime.fromtimestamp(int(times[i]), tz=timezone.utc).hour
        if hour < HOUR_FROM or hour > HOUR_TO:
            continue
        if int(spread[i]) > MAX_SPREAD_POINTS:
            continue
        long_ok = c[i] > e[i] and e[i] > e[i - 3] and l[i] <= e[i] and c[i] > e[i]
        short_ok = c[i] < e[i] and e[i] < e[i - 3] and h[i] >= e[i] and c[i] < e[i]
        if not long_ok and not short_ok:
            continue
        side = "buy" if long_ok else "sell"
        spr = int(spread[i]) * point
        entry = float(o[i + 1] + spr) if side == "buy" else float(o[i + 1])
        if side == "buy":
            sl = float(l[i] - ATR_PAD * a[i])
            risk = entry - sl
            tp = entry + REWARD_R * risk
        else:
            sl = float(h[i] + ATR_PAD * a[i])
            risk = sl - entry
            tp = entry - REWARD_R * risk
        if risk < MIN_RISK or risk > MAX_RISK:
            continue
        risk_money = equity * (RISK_PCT / 100.0)
        loss_per_lot = (risk / tick_size) * tick_value
        if loss_per_lot <= 0:
            continue
        lot = risk_money / loss_per_lot
        lot = np.floor(lot / step) * step
        if lot < vmin:
            continue
        pos = {"side": side, "entry": entry, "sl": sl, "tp": tp, "lot": float(lot), "entry_i": i + 1}

    stats = summarize(trades, start_eq)
    first = datetime.fromtimestamp(int(times[0]), tz=timezone.utc).date()
    last = datetime.fromtimestamp(int(times[-1]), tz=timezone.utc).date()
    print(f"symbol {symbol}  {first} -> {last}  bars {len(rates)}  currency {ccy}")
    print(
        f"trades {stats['trades']}  win {stats['win_rate']:.1f}%  "
        f"PF {stats['profit_factor']}  net {stats['net']:.2f} {ccy}"
    )
    print(
        f"expectancy {stats['expectancy']:.2f}  maxDD {stats['max_dd']:.2f}  "
        f"equity {start_eq:.2f} -> {stats['end_equity']:.2f}"
    )
    by = {}
    for t in trades:
        key = datetime.fromtimestamp(t["time"], tz=timezone.utc).strftime("%Y-%m")
        row = by.setdefault(key, {"n": 0, "pnl": 0.0})
        row["n"] += 1
        row["pnl"] += t["pnl"]
    for key in sorted(by):
        print(f"  {key}  n={by[key]['n']:3}  pnl={by[key]['pnl']:,.0f}")
    run_asia(symbol, rates, spec, ccy)


def run_asia(symbol: str, rates, spec, ccy: str) -> None:
    """Pre-set alternative. Asian box 00-06, break on an 07-11 close, next open, 1.5R."""
    point = float(spec.point or 0.01)
    tick_size = float(spec.trade_tick_size or point)
    tick_value = float(spec.trade_tick_value or 0.0)
    vmin = float(spec.volume_min or 0.01)
    step = float(spec.volume_step or 0.01)
    h = rates["high"].astype(float)
    l = rates["low"].astype(float)
    c = rates["close"].astype(float)
    o = rates["open"].astype(float)
    spread = rates["spread"].astype(int)
    times = rates["time"].astype(np.int64)
    a = atr(h, l, c, ATR_N)
    equity = 5_000_000.0
    start_eq = equity
    trades: list[dict] = []
    pos = None
    days: dict[str, dict] = {}
    used_day = set()
    for i in range(len(rates)):
        day = datetime.fromtimestamp(int(times[i]), tz=timezone.utc).strftime("%Y-%m-%d")
        hour = datetime.fromtimestamp(int(times[i]), tz=timezone.utc).hour
        box = days.setdefault(day, {"high": None, "low": None})
        if hour <= 6:
            box["high"] = h[i] if box["high"] is None else max(box["high"], h[i])
            box["low"] = l[i] if box["low"] is None else min(box["low"], l[i])
        if pos is not None and i > pos["entry_i"]:
            hit_sl = l[i] <= pos["sl"] if pos["side"] == "buy" else h[i] >= pos["sl"]
            hit_tp = h[i] >= pos["tp"] if pos["side"] == "buy" else l[i] <= pos["tp"]
            exit_px = None
            if hit_sl:
                exit_px = pos["sl"]
            elif hit_tp:
                exit_px = pos["tp"]
            elif i - pos["entry_i"] >= MAX_HOLD:
                exit_px = c[i]
            if exit_px is not None:
                diff = (exit_px - pos["entry"]) if pos["side"] == "buy" else (pos["entry"] - exit_px)
                pnl = (diff / tick_size) * tick_value * pos["lot"]
                equity += pnl
                trades.append({"pnl": pnl, "time": int(times[i])})
                pos = None
        if pos is not None or i >= len(rates) - 1:
            continue
        if day in used_day or hour < 7 or hour > 11:
            continue
        if box["high"] is None or box["low"] is None or np.isnan(a[i]) or a[i] <= 0:
            continue
        if int(spread[i]) > MAX_SPREAD_POINTS:
            continue
        height = box["high"] - box["low"]
        if height < 0.6 * a[i] or height > 2.5 * a[i]:
            continue
        side = None
        if c[i] > box["high"]:
            side = "buy"
        elif c[i] < box["low"]:
            side = "sell"
        if side is None:
            continue
        used_day.add(day)
        spr = int(spread[i]) * point
        entry = float(o[i + 1] + spr) if side == "buy" else float(o[i + 1])
        if side == "buy":
            sl = float(box["low"])
            risk = entry - sl
            tp = entry + 1.5 * risk
        else:
            sl = float(box["high"])
            risk = sl - entry
            tp = entry - 1.5 * risk
        if risk < MIN_RISK or risk > MAX_RISK:
            continue
        loss_per_lot = (risk / tick_size) * tick_value
        if loss_per_lot <= 0:
            continue
        lot = np.floor((equity * (RISK_PCT / 100.0) / loss_per_lot) / step) * step
        if lot < vmin:
            continue
        pos = {"side": side, "entry": entry, "sl": sl, "tp": tp, "lot": float(lot), "entry_i": i + 1}
    stats = summarize(trades, start_eq)
    print("--- Asia box break (preset alternative) ---")
    print(
        f"trades {stats['trades']}  win {stats['win_rate']:.1f}%  "
        f"PF {stats['profit_factor']}  net {stats['net']:.2f} {ccy}"
    )
    print(
        f"expectancy {stats['expectancy']:.2f}  maxDD {stats['max_dd']:.2f}  "
        f"equity {start_eq:.2f} -> {stats['end_equity']:.2f}"
    )


if __name__ == "__main__":
    symbol = sys.argv[1] if len(sys.argv) > 1 else "XAUUSDz"
    run(symbol)
