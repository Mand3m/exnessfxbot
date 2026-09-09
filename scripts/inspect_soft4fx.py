#!/usr/bin/env python3
"""Unzip Soft4fx sim_ticks packs and print format clues."""
from __future__ import annotations

import zipfile
from pathlib import Path

SRC = Path(r"C:\Users\GEORGE\Downloads\Telegram Desktop")
DST = Path(r"C:\Users\GEORGE\exnessfxbot\data\soft4fx")
ZIPS = [
    "sim_ticks_XAUUSD.zip",
    "sim_ticks_EURUSD.zip",
    "sim_ticks_NQ100.zip",
]


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    for name in ZIPS:
        zpath = SRC / name
        if not zpath.exists() or zpath.stat().st_size < 1_000_000:
            print(f"SKIP {name} missing/small")
            continue
        out = DST / name.replace("sim_ticks_", "").replace(".zip", "")
        out.mkdir(parents=True, exist_ok=True)
        print(f"\n=== {name}  {zpath.stat().st_size:,} bytes ===")
        with zipfile.ZipFile(zpath) as zf:
            infos = zf.infolist()
            print(f"entries {len(infos)}")
            for info in infos[:30]:
                print(f"  {info.file_size:12,}  {info.filename}")
            if len(infos) > 30:
                print(f"  ... {len(infos) - 30} more")
            zf.extractall(out)
        files = [p for p in out.rglob("*") if p.is_file()]
        print(f"extracted {len(files)} files -> {out}")
        for p in files[:5]:
            raw = p.read_bytes()[:240]
            print(f"--- {p.relative_to(out)} {p.stat().st_size:,} ---")
            try:
                text = raw.decode("utf-8")
                print(text.replace("\r", "")[:240])
            except UnicodeDecodeError:
                print(raw[:80].hex())


if __name__ == "__main__":
    main()
