#!/usr/bin/env python3
import json
from collections import defaultdict
from pathlib import Path

p = Path(r"C:\Users\GEORGE\exnessfxbot\data")
for f in sorted(p.glob("h1-range-m5-*-202506-202609.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    s = d["summary"]
    print("=" * 72)
    print(f.name)
    keys = [
        "symbol", "window", "trades", "wins", "losses", "win_rate_pct",
        "profit_factor", "net_ugx", "max_drawdown_ugx", "expectancy_ugx",
        "start_equity", "end_equity", "bull_trades", "bear_trades",
        "h1_bars", "m5_bars", "m1_bars", "m1_first", "m1_last",
    ]
    for k in keys:
        print(f"  {k}: {s.get(k)}")
    print("  stats", s.get("stats") or d.get("stats"))
    by = defaultdict(lambda: {"n": 0, "w": 0, "l": 0, "pnl": 0.0})
    for t in d["trades"]:
        m = t["entry_time"][:7]
        by[m]["n"] += 1
        by[m]["pnl"] += t["pnl_ugx"]
        if t["pnl_ugx"] > 0:
            by[m]["w"] += 1
        else:
            by[m]["l"] += 1
    print(f"  {'Month':<10} {'N':>4} {'W':>3} {'L':>3} {'PnL':>14}")
    for m in sorted(by):
        x = by[m]
        print(f"  {m:<10} {x['n']:4} {x['w']:3} {x['l']:3} {x['pnl']:14,.0f}")
    h2 = [t for t in d["trades"] if t["entry_time"][:7] <= "2025-12"]
    y26 = [t for t in d["trades"] if t["entry_time"][:4] == "2026"]
    def wr(ts):
        return 100.0 * sum(1 for t in ts if t["pnl_ugx"] > 0) / len(ts) if ts else 0.0
    print(f"  H2 2025: n={len(h2)} wr={wr(h2):.1f}% pnl={sum(t['pnl_ugx'] for t in h2):,.0f}")
    print(f"  2026:    n={len(y26)} wr={wr(y26):.1f}% pnl={sum(t['pnl_ugx'] for t in y26):,.0f}")
    same = sum(1 for t in d["trades"] if "same" in t.get("reason", "").lower())
    print(f"  same-bar exits: {same}")
