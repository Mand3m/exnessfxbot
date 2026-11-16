#!/usr/bin/env python3
"""Insert FibToDesk (and DeskAgent on EURUSD) into Default chart profiles."""
from pathlib import Path

LIVE = Path(r"C:\Users\GEORGE\AppData\Roaming\MetaQuotes\Terminal\5FD4D68F20F0537527D3C23BE07A0C08")
CHARTS = LIVE / "MQL5" / "Profiles" / "Charts" / "Default"

FIB_BLOCK = """<indicator>
name=Custom Indicator
path=Indicators\\FibToDesk.ex5
apply=0
show_data=1
scale_inherit=0
scale_line=0
scale_line_percent=50
scale_line_value=0.000000
scale_fix_min=0
scale_fix_min_val=0.000000
scale_fix_max=0
scale_fix_max_val=0.000000
expertmode=4
fixed_height=-1

<graph>
name=
draw=0
style=0
width=1
arrow=251
color=
</graph>
<inputs>
FileName=exnessfxbot-fib.json
</inputs>
</indicator>
"""

EXPERT_BLOCK = """
<expert>
name=DeskAgent
path=Experts\\DeskAgent.ex5
expertmode=1
<inputs>
AccountId=acc1
Suffix=z
Magic=260818
EnableGoldEa=false
</inputs>
</expert>
"""

FIBEA_BLOCK = """
<expert>
name=FibToDeskEA
path=Experts\\FibToDeskEA.ex5
expertmode=1
<inputs>
FileName=exnessfxbot-fib.json
</inputs>
</expert>
"""


def decode(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw.decode("utf-16"), "utf-16"
    return raw.decode("utf-8"), "utf-8"


def main() -> None:
    for path in sorted(CHARTS.glob("chart0[1-4].chr")):
        text, enc = decode(path)
        symbol = ""
        for line in text.splitlines():
            if line.startswith("symbol="):
                symbol = line.split("=", 1)[1].strip()
                break
        orig = text
        if "FibToDesk.ex5" not in text:
            needle = "</indicator>"
            idx = text.find(needle)
            if idx >= 0:
                idx += len(needle)
                text = text[:idx] + "\n" + FIB_BLOCK + text[idx:]
                print("added FibToDesk to", path.name, symbol)
        w = text.rfind("</window>")
        if w >= 0:
            w += len("</window>")
            if symbol.startswith("EURUSD") and "DeskAgent.ex5" not in text:
                text = text[:w] + "\n" + EXPERT_BLOCK + text[w:]
                print("added DeskAgent to", path.name, symbol)
            elif (not symbol.startswith("EURUSD")) and "FibToDeskEA.ex5" not in text and "<expert>" not in text:
                text = text[:w] + "\n" + FIBEA_BLOCK + text[w:]
                print("added FibToDeskEA to", path.name, symbol)
        if text != orig:
            path.write_text(text, encoding=enc)


if __name__ == "__main__":
    main()
