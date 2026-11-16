"""
Create a private MT5 window per desk account, log it in, turn on Algo Trading,
install FibToDesk, and attach it to the four desk pairs.

Used when an account is saved and again whenever the executor starts.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CONFIG_PATH = DATA / "mt5.json"
LOG_PATH = DATA / "mt5-terminals.log"
TERMINALS_ROOT = ROOT / "mt5-terminals"
PAIRS = ("USDJPY", "XAUUSD", "EURUSD", "GBPJPY")
FIB_FILES = (
    ("Indicators", "FibToDesk.mq5"),
    ("Indicators", "FibToDesk.ex5"),
    ("Experts", "FibToDesk.mq5"),
    ("Experts", "FibToDesk.ex5"),
    ("Experts", "FibToDeskEA.mq5"),
    ("Scripts", "FibToDeskRun.mq5"),
    ("Scripts", "FibToDeskRun.ex5"),
)


def log(msg: str) -> None:
    line = time.strftime("%H:%M:%S") + " " + msg
    print(line, flush=True)
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except Exception:
        pass


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(value, indent=2), encoding="utf-8")
    tmp.replace(path)


def load_accounts() -> list[dict]:
    raw = read_json(CONFIG_PATH, {})
    rows = raw.get("accounts") if isinstance(raw, dict) else None
    if not isinstance(rows, list):
        return []
    out = []
    for i, row in enumerate(rows[:5]):
        if not isinstance(row, dict):
            continue
        out.append(
            {
                "id": str(row.get("id") or f"acc{i + 1}"),
                "label": str(row.get("label") or f"Account {i + 1}"),
                "enabled": bool(row.get("enabled")),
                "login": str(row.get("login") or "").strip(),
                "server": str(row.get("server") or "").strip(),
                "password": str(row.get("password") or ""),
                "symbolSuffix": str(row.get("symbolSuffix") or "").strip(),
                "terminalPath": str(row.get("terminalPath") or "").strip(),
            }
        )
    return out


def save_terminal_path(account_id: str, terminal_path: str) -> None:
    raw = read_json(CONFIG_PATH, {})
    if not isinstance(raw, dict) or not isinstance(raw.get("accounts"), list):
        return
    changed = False
    for row in raw["accounts"]:
        if str(row.get("id")) == account_id and str(row.get("terminalPath") or "") != terminal_path:
            row["terminalPath"] = terminal_path
            changed = True
    if changed:
        write_json(CONFIG_PATH, raw)


def powershell(command: str) -> str:
    try:
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", command],
            stderr=subprocess.DEVNULL,
            creationflags=0x08000000,
            text=True,
            timeout=20,
        )
        return out.strip()
    except Exception:
        return ""


def running_exe_paths() -> set[str]:
    raw = powershell("Get-Process terminal64 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path")
    return {str(Path(line.strip()).resolve()).lower() for line in raw.splitlines() if line.strip()}


def candidate_installs() -> list[Path]:
    seen: list[Path] = []
    extra = [
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "MetaTrader 5",
        Path(os.environ.get("APPDATA", "")) / "MetaTrader 5",
    ]
    for path in running_exe_paths():
        extra.append(Path(path).parent)
    for folder in extra:
        exe = folder / "terminal64.exe"
        if not exe.exists():
            continue
        resolved = folder.resolve()
        if TERMINALS_ROOT.resolve() in [resolved, *resolved.parents]:
            continue
        if resolved not in seen:
            seen.append(resolved)
    return seen


def source_install() -> Path | None:
    found = candidate_installs()
    program = Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "MetaTrader 5"
    if program in found:
        return program
    return found[0] if found else None


def data_dir_for_exe(exe: Path) -> Path | None:
    app = Path(os.environ.get("APPDATA", "")) / "MetaQuotes" / "Terminal"
    wanted = str(exe.parent.resolve()).rstrip("\\").lower()
    if app.exists():
        for child in app.iterdir():
            if not child.is_dir() or child.name in {"Common", "Community"}:
                continue
            origin = child / "origin.txt"
            if not origin.exists():
                continue
            try:
                text = origin.read_text(encoding="utf-16", errors="ignore").strip()
            except Exception:
                text = origin.read_text(encoding="utf-8", errors="ignore").strip()
            if text.rstrip("\\").lower() == wanted:
                return child
    local = exe.parent / "config" / "common.ini"
    if local.exists():
        return exe.parent
    return None


def ini_value(path: Path, key: str) -> str:
    if not path.exists():
        return ""
    try:
        text = path.read_text(encoding="utf-16", errors="ignore")
    except Exception:
        text = path.read_text(encoding="utf-8", errors="ignore")
    needle = key.lower() + "="
    for line in text.splitlines():
        if line.strip().lower().startswith(needle):
            return line.split("=", 1)[1].strip()
    return ""


def existing_exe_for_login(login: str) -> Path | None:
    if not login:
        return None
    for folder in candidate_installs():
        exe = folder / "terminal64.exe"
        data = data_dir_for_exe(exe)
        if not data:
            continue
        current = ini_value(data / "config" / "common.ini", "Login")
        if current == login:
            return exe
    return None


def clone_dir(account_id: str) -> Path:
    return TERMINALS_ROOT / account_id


def copy_fib_files(dest_mql5: Path) -> None:
    app = Path(os.environ.get("APPDATA", "")) / "MetaQuotes" / "Terminal"
    search = [ROOT / "scripts"]
    if app.exists():
        search.extend(p / "MQL5" for p in app.iterdir() if p.is_dir() and p.name not in {"Common", "Community"})
    copies = {
        "FibToDesk.mq5": ("Indicators", "Experts"),
        "FibToDesk.ex5": ("Indicators", "Experts"),
        "FibToDeskEA.mq5": ("Experts",),
        "FibToDeskEA.ex5": ("Experts",),
        "FibToDeskRun.mq5": ("Scripts",),
        "FibToDeskRun.ex5": ("Scripts",),
        "DeskBoot.mq5": ("Experts",),
        "DeskBoot.ex5": ("Experts",),
        "DeskAgent.mq5": ("Experts",),
        "DeskAgent.ex5": ("Experts",),
        "XAUUSD_H1Range_M5Sweep.mq5": ("Experts",),
        "XAUUSD_H1Range_M5Sweep.ex5": ("Experts",),
        "H1RangeM5.tpl": ("Profiles/Templates",),
        "H1RangeM5.set": ("Presets",),
        "AttachH1RangeM5.mq5": ("Scripts",),
        "AttachH1RangeM5.ex5": ("Scripts",),
    }
    found: dict[str, Path] = {}
    for root in search:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.name in copies and path.is_file() and path.name not in found:
                found[path.name] = path
    for name, folders in copies.items():
        src = found.get(name)
        if not src:
            continue
        for folder in folders:
            dest = dest_mql5 / folder / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)


def compile_desk_boot() -> None:
    editor = None
    install = source_install()
    if install:
        cand = install / "MetaEditor64.exe"
        if cand.exists():
            editor = cand
    if not editor:
        return
    for name in ("DeskBoot.mq5", "DeskAgent.mq5", "XAUUSD_H1Range_M5Sweep.mq5", "FibToDesk.mq5"):
        src = ROOT / "scripts" / name
        if not src.exists():
            continue
        try:
            subprocess.run(
                [str(editor), f"/compile:{src}", "/log"],
                cwd=str(src.parent),
                timeout=40,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as exc:
            log(f"{name} compile skipped: {exc}")


def write_common_ini(folder: Path, account: dict) -> None:
    config = folder / "config"
    config.mkdir(parents=True, exist_ok=True)
    suffix = str(account.get("symbolSuffix") or "")
    common = f"""[Common]
Login={account.get("login") or ""}
Server={account.get("server") or ""}
ProxyEnable=0
NewsEnable=0
KeepPrivate=1
[Charts]
ProfileLast=Desk
MaxBars=50000
TradeLevels=1
PreloadCharts=1
[Experts]
AllowDllImport=1
Enabled=1
Account=1
Profile=1
Chart=1
Api=1
[StartUp]
Expert=DeskAgent
ExpertParameters=DeskBoot.set
Symbol={PAIRS[2]}{suffix}
Period=M5
"""
    presets = folder / "MQL5" / "Presets"
    presets.mkdir(parents=True, exist_ok=True)
    gold = "1" if str(account.get("id") or "") == "acc1" and not gold_ea_off() else "0"
    (presets / "DeskBoot.set").write_text(
        f"AccountId={account.get('id') or ''}\nSuffix={suffix}\nMagic=260818\nEnableGoldEa={gold}\n",
        encoding="utf-8",
    )
    (config / "common.ini").write_text(common, encoding="utf-8")
    start = f"""[Common]
Login={account.get("login") or ""}
Password={account.get("password") or ""}
Server={account.get("server") or ""}
ProxyEnable=0
NewsEnable=0
KeepPrivate=1
[Charts]
ProfileLast=Desk
MaxBars=50000
TradeLevels=1
[Experts]
AllowDllImport=1
Enabled=1
Account=1
Profile=1
Chart=1
Api=1
[StartUp]
Expert=DeskAgent
ExpertParameters=DeskBoot.set
Symbol={PAIRS[2]}{suffix}
Period=M5
"""
    start_path = config / "start.ini"
    start_path.write_text(start, encoding="utf-8")
    try:
        os.chmod(start_path, 0o600)
    except Exception:
        pass
    src_install = source_install()
    if src_install:
        for name in ("servers.dat", "terminal.lic"):
            src = src_install / "Config" / name
            if not src.exists():
                src = src_install / "config" / name
            if src.exists():
                shutil.copy2(src, config / name)


def copy_install(src: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    cmd = [
        "robocopy",
        str(src),
        str(dest),
        "/E",
        "/XD",
        "Bases",
        "logs",
        "temp",
        "/XF",
        "uninstall.exe",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/nc",
        "/ns",
        "/np",
    ]
    result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # robocopy 0-7 = success
    if result.returncode >= 8:
        raise RuntimeError(f"robocopy failed with {result.returncode}")


def ensure_clone(account: dict) -> Path:
    dest = clone_dir(account["id"])
    exe = dest / "terminal64.exe"
    src = source_install()
    if not src:
        raise RuntimeError("No MetaTrader 5 install found to copy.")
    if not exe.exists():
        log(f"Creating private MT5 for {account['label']}…")
        copy_install(src, dest)
    compile_desk_boot()
    write_common_ini(dest, account)
    copy_fib_files(dest / "MQL5")
    return exe


GOLD_EA_NAME = "XAUUSD_H1Range_M5Sweep"
GOLD_EA_FLAG = (
    Path.home()
    / "AppData"
    / "Roaming"
    / "MetaQuotes"
    / "Terminal"
    / "Common"
    / "Files"
    / "exnessfxbot-gold-ea.on"
)
GOLD_EA_OFF = GOLD_EA_FLAG.with_name("exnessfxbot-gold-ea.off")


def gold_symbol(account: dict) -> str:
    return "XAUUSD" + str(account.get("symbolSuffix") or "")


def write_gold_preset(data_dir: Path) -> None:
    presets = data_dir / "MQL5" / "Presets"
    presets.mkdir(parents=True, exist_ok=True)
    src = ROOT / "scripts" / "H1RangeM5.set"
    dest = presets / "H1RangeM5.set"
    if src.exists():
        shutil.copy2(src, dest)
    elif not dest.exists():
        dest.write_text("InpMagic=260918\nInpRiskMoney=20000.0\nInpRewardR=3.0\n", encoding="utf-8")


def gold_ea_off() -> bool:
    return GOLD_EA_OFF.exists()


def write_gold_flag(account: dict) -> None:
    try:
        GOLD_EA_FLAG.parent.mkdir(parents=True, exist_ok=True)
        if gold_ea_off():
            if GOLD_EA_FLAG.exists():
                GOLD_EA_FLAG.unlink()
            return
        GOLD_EA_FLAG.write_text(str(account.get("login") or ""), encoding="utf-8")
    except Exception:
        pass


def write_gold_start_ini(data_dir: Path, account: dict) -> Path:
    """Startup file that attaches the gold EA on XAUUSD M5 when this terminal is launched."""
    config = data_dir / "config"
    config.mkdir(parents=True, exist_ok=True)
    write_gold_preset(data_dir)
    symbol = gold_symbol(account)
    text = f"""[Common]
Login={account.get("login") or ""}
Password={account.get("password") or ""}
Server={account.get("server") or ""}
ProxyEnable=0
NewsEnable=0
KeepPrivate=1
[Charts]
MaxBars=50000
TradeLevels=1
PreloadCharts=1
[Experts]
AllowDllImport=1
Enabled=1
Account=1
Profile=1
Chart=1
Api=1
[StartUp]
Expert={GOLD_EA_NAME}
ExpertParameters=H1RangeM5.set
Symbol={symbol}
Period=M5
"""
    path = config / "start-gold.ini"
    path.write_text(text, encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass
    return path


def install_gold_ea(data_dir: Path, account: dict) -> None:
    copy_fib_files(data_dir / "MQL5")
    write_gold_preset(data_dir)
    write_gold_start_ini(data_dir, account)
    write_gold_flag(account)
    src_ex5 = ROOT / "scripts" / f"{GOLD_EA_NAME}.ex5"
    dest = data_dir / "MQL5" / "Experts" / f"{GOLD_EA_NAME}.ex5"
    if src_ex5.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_ex5, dest)
    tpl = ROOT / "scripts" / "H1RangeM5.tpl"
    if tpl.exists():
        tdir = data_dir / "MQL5" / "Profiles" / "Templates"
        tdir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(tpl, tdir / "H1RangeM5.tpl")


def try_enable_autotrading() -> None:
    try:
        import ctypes

        user32 = ctypes.windll.user32
        found = []

        EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

        def each(hwnd, _lparam):
            length = user32.GetWindowTextLengthW(hwnd)
            if length < 4:
                return True
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            title = buf.value.lower()
            if "metatrader" in title or "exness" in title:
                found.append(hwnd)
            return True

        user32.EnumWindows(EnumWindowsProc(each), 0)
        for hwnd in found:
            user32.SetForegroundWindow(hwnd)
            time.sleep(0.15)
            user32.keybd_event(0x11, 0, 0, 0)
            user32.keybd_event(0x45, 0, 0, 0)
            user32.keybd_event(0x45, 0, 2, 0)
            user32.keybd_event(0x11, 0, 2, 0)
    except Exception:
        pass


def wait_login(exe: Path, account: dict, portable: bool, timeout: float = 120.0) -> str:
    try:
        import MetaTrader5 as mt5
    except ImportError:
        return "MetaTrader5 python package missing"
    wanted = int(account["login"]) if str(account.get("login") or "").isdigit() else None
    kwargs = {
        "path": str(exe),
        "timeout": int(timeout * 1000),
        "portable": bool(portable),
    }
    if account.get("login") and account.get("password") and account.get("server"):
        kwargs.update(
            login=int(account["login"]),
            password=account["password"],
            server=account["server"],
        )
    running = str(exe.resolve()).lower() in running_exe_paths()
    data = data_dir_for_exe(exe)
    gold_ini = None
    if data:
        gold_ini = data / "config" / "start-gold.ini"
        if not gold_ini.exists():
            gold_ini = data / "config" / "start.ini"
        if not gold_ini.exists():
            gold_ini = None
    if portable:
        if not running:
            log(f"{account['label']}: starting {exe}")
            args = [str(exe), "/portable"]
            start_ini = exe.parent / "config" / "start.ini"
            if gold_ini and gold_ini.exists() and str(account.get("id") or "") == "acc1" and not gold_ea_off():
                start_ini = gold_ini
            if start_ini.exists():
                args.append(f"/config:{start_ini}")
            subprocess.Popen(
                args,
                cwd=str(exe.parent),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                creationflags=0x00000200 | 0x08000000,
            )
            deadline = time.time() + timeout
            while time.time() < deadline and str(exe.resolve()).lower() not in running_exe_paths():
                time.sleep(1)
        if str(exe.resolve()).lower() in running_exe_paths():
            return f"ready {account.get('login')} @ {account.get('server')} (private window + desk agent)"
        return "private MT5 window did not start"
    if running:
        log(f"{account['label']}: attaching to open MT5")
    else:
        log(f"{account['label']}: starting {exe} with gold EA on {gold_symbol(account)} M5")
        args = [str(exe)]
        if gold_ini and gold_ini.exists():
            args.append(f"/config:{gold_ini}")
        subprocess.Popen(
            args,
            cwd=str(exe.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            creationflags=0x00000200 | 0x08000000,
        )
        deadline = time.time() + timeout
        while time.time() < deadline and str(exe.resolve()).lower() not in running_exe_paths():
            time.sleep(1)
    mt5.shutdown()
    if not mt5.initialize(**kwargs):
        return f"initialize failed: {mt5.last_error()}"
    info = mt5.account_info()
    if info is None:
        err = mt5.last_error()
        mt5.shutdown()
        return f"no account: {err}"
    if wanted and int(info.login) != wanted:
        mt5.shutdown()
        return f"MT5 is on {info.login}, wanted {wanted}"
    term = mt5.terminal_info()
    if term is not None and not getattr(term, "trade_allowed", True):
        try_enable_autotrading()
        time.sleep(1)
        term = mt5.terminal_info()
    if term is not None and not getattr(term, "trade_allowed", True):
        mt5.shutdown()
        return "logged in, but Algo Trading is still off — press the AutoTrading button once"
    last = f"ready {info.login} @ {info.server}"
    mt5.shutdown()
    return last


def provision_account(account: dict) -> dict:
    if not account.get("login") or not account.get("server"):
        return {"ok": False, "message": "login and server required"}
    label = account["label"]
    existing = None
    if account.get("terminalPath"):
        path = Path(account["terminalPath"])
        if path.exists():
            existing = path
    if existing is None:
        existing = existing_exe_for_login(account["login"])
    terminals_root = TERMINALS_ROOT.resolve()
    if existing and terminals_root not in [existing.parent.resolve(), *existing.parent.resolve().parents]:
        exe = existing
        portable = False
        data = data_dir_for_exe(exe)
        if data:
            compile_desk_boot()
            copy_fib_files(data / "MQL5")
            boot_src = ROOT / "scripts" / "DeskBoot.ex5"
            if boot_src.exists():
                dest = data / "MQL5" / "Experts" / "DeskBoot.ex5"
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(boot_src, dest)
            if str(account.get("id") or "") == "acc1" and not gold_ea_off():
                install_gold_ea(data, account)
                log(f"{label}: gold EA staged on {gold_symbol(account)} M5")
        log(f"{label}: reusing {exe}")
    else:
        exe = ensure_clone(account)
        portable = True
    save_terminal_path(account["id"], str(exe))
    message = wait_login(exe, account, portable)
    ok = message.startswith("ready")
    log(f"{label}: {message}")
    return {"ok": ok, "message": message, "terminalPath": str(exe)}


def prepare_all(account_id: str | None = None) -> list[dict]:
    results = []
    accounts = load_accounts()
    wanted = [a for a in accounts if a.get("enabled") and a.get("login") and a.get("server")]
    if account_id:
        wanted = [a for a in accounts if a["id"] == account_id]
    if not wanted:
        log("No linked MT5 accounts to open.")
        return results
    compile_desk_boot()
    for account in wanted:
        try:
            results.append({"id": account["id"], **provision_account(account)})
        except Exception as exc:
            log(f"{account.get('label')}: {exc}")
            results.append({"id": account["id"], "ok": False, "message": str(exc)})
    return results


def main(argv: list[str]) -> int:
    account_id = None
    if "--id" in argv:
        account_id = argv[argv.index("--id") + 1]
    elif argv[1:] and not argv[1].startswith("-"):
        cmd = argv[1]
        if cmd == "provision" and "--id" in argv:
            account_id = argv[argv.index("--id") + 1]
        elif cmd not in {"prepare-all", "provision"}:
            account_id = cmd
    results = prepare_all(account_id)
    failed = [r for r in results if not r.get("ok")]
    return 1 if failed and account_id else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
