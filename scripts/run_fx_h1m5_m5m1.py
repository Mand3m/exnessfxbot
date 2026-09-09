#!/usr/bin/env python3
"""Run H1/M5 and M5/M1 swing-break backtests on FX pairs."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import MetaTrader5 as mt5

PAIRS = ["EURUSD", "USDCAD", "GBPUSD", "GBPJPY", "USDJPY"]
SCRIPTS = Path(r"C:\Users\GEORGE\exnessfxbot\scripts")
PY = sys.executable
FROM_D, TO_D = "2026-01-01", "2026-09-01"


def resolve(base: str) -> str | None:
    for name in (base + "z", base + "m", base):
        info = mt5.symbol_info(name)
        if info is None:
            mt5.symbol_select(name, True)
            info = mt5.symbol_info(name)
        if info is not None:
            return name
    return None


def main() -> None:
    if not mt5.initialize():
        raise SystemExit(mt5.last_error())
    resolved = []
    for p in PAIRS:
        s = resolve(p)
        print(f"  {p} -> {s}")
        if s:
            resolved.append(s)
    mt5.shutdown()
    if not resolved:
        raise SystemExit("no symbols")

    jobs = []
    for sym in resolved:
        jobs.append((
            "H1M5",
            [
                PY, str(SCRIPTS / "backtest_h1_swing_m5_break.py"),
                "--symbol", sym, "--from", FROM_D, "--to", TO_D,
                "--out", f"h1-swing-m5-break-{sym.lower()}-jan-aug-2026.json",
            ],
        ))
        jobs.append((
            "M5M1",
            [
                PY, str(SCRIPTS / "backtest_m5_swing_m1_break.py"),
                "--symbol", sym, "--from", FROM_D, "--to", TO_D,
                "--out", f"m5-swing-m1-break-{sym.lower()}-jan-aug-2026.json",
            ],
        ))

    for tag, cmd in jobs:
        print("\n" + "=" * 72)
        print(tag, cmd[cmd.index("--symbol") + 1])
        r = subprocess.run(cmd, cwd=str(SCRIPTS))
        if r.returncode != 0:
            print("FAILED", tag, r.returncode)


if __name__ == "__main__":
    main()
