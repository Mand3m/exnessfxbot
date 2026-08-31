"""
Open (or cancel) ExnessfxBot desk signals on a logged-in MT5 account.

The desk starts this script when a signal is sent. It exits by itself when
there are no queued jobs, no pending orders, and no open positions.
MetaTrader 5 must already be open with Algo Trading enabled.
"""

from __future__ import annotations

import atexit
import json
import os
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CONFIG_PATH = DATA / "mt5.json"
QUEUE_PATH = DATA / "mt5-queue.json"
STATUS_PATH = DATA / "mt5-status.json"
TRAIL_PATH = DATA / "mt5-trails.json"
SIGNALS_PATH = DATA / "signals.json"
QUOTES_PATH = DATA / "mt5-quotes.json"
PNL_PATH = DATA / "mt5-pnl.json"
EAT = timezone(timedelta(hours=3))
PID_PATH = DATA / "mt5-executor.pid"
LOG_PATH = DATA / "mt5-executor.log"
IDLE_EXIT_SECONDS = 25
COMMON_QUEUE = (
    Path.home()
    / "AppData"
    / "Roaming"
    / "MetaQuotes"
    / "Terminal"
    / "Common"
    / "Files"
    / "exnessfxbot-queue.json"
)

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Install the MT5 bridge first:")
    print("  python -m pip install MetaTrader5")
    sys.exit(1)


def load_dotenv() -> None:
    env = ROOT / ".env.local"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def push_live_signals() -> None:
    base = (os.environ.get("LIVE_SITE_URL") or "").strip().rstrip("/")
    secret = (os.environ.get("LIVE_SYNC_SECRET") or "").strip()
    if not base or not secret or not SIGNALS_PATH.exists():
        return
    try:
        payload = SIGNALS_PATH.read_bytes()
        req = Request(
            base + "/api/sync/live",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + secret,
            },
            method="POST",
        )
        with urlopen(req, timeout=12) as resp:
            resp.read()
    except Exception as exc:
        log(f"Live sync failed: {exc}")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str) -> None:
    line = f"{datetime.now().strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    # When the desk spawns us, stdout is already the log file.
    if not sys.stdout.isatty():
        return
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except Exception:
        pass


def pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def another_instance_running() -> bool:
    if not PID_PATH.exists():
        return False
    try:
        pid = int(PID_PATH.read_text(encoding="utf-8").strip())
    except Exception:
        return False
    if pid == os.getpid():
        return False
    return pid_alive(pid)


def write_pid() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    PID_PATH.write_text(str(os.getpid()), encoding="utf-8")


def clear_pid() -> None:
    try:
        if PID_PATH.exists() and PID_PATH.read_text(encoding="utf-8").strip() == str(os.getpid()):
            PID_PATH.unlink()
    except Exception:
        pass


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, indent=2)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    tmp.write_text(payload, encoding="utf-8")
    last: Exception | None = None
    for _ in range(10):
        try:
            os.replace(tmp, path)
            if path.resolve() == SIGNALS_PATH.resolve():
                push_live_signals()
            return
        except PermissionError as exc:
            last = exc
            time.sleep(0.05)
    try:
        path.write_text(payload, encoding="utf-8")
        tmp.unlink(missing_ok=True)
        if path.resolve() == SIGNALS_PATH.resolve():
            push_live_signals()
    except Exception as exc:
        last = last or exc
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass
        raise last


def normalize_account(raw: dict, index: int) -> dict:
    return {
        "id": str(raw.get("id") or f"acc{index + 1}"),
        "label": str(raw.get("label") or f"Account {index + 1}"),
        "enabled": bool(raw.get("enabled")),
        "login": str(raw.get("login") or "").strip(),
        "server": str(raw.get("server") or "").strip(),
        "password": str(raw.get("password") or ""),
        "riskPct": float(raw.get("riskPct") or 1),
        "deviation": int(raw.get("deviation") or 20),
        "magic": int(raw.get("magic") or 260818 + index),
        "symbolSuffix": str(raw.get("symbolSuffix") or "").strip(),
        "terminalPath": str(raw.get("terminalPath") or "").strip(),
    }


def load_accounts() -> list[dict]:
    raw = read_json(CONFIG_PATH, {})
    if isinstance(raw, dict) and isinstance(raw.get("accounts"), list):
        return [normalize_account(row, i) for i, row in enumerate(raw["accounts"][:5])]
    if isinstance(raw, dict) and (raw.get("login") or raw.get("enabled")):
        return [normalize_account(raw, 0)]
    return []


def write_status(accounts: list[dict], message: str) -> None:
    connected = [a for a in accounts if a.get("connected")]
    first = connected[0] if connected else (accounts[0] if accounts else {})
    write_json(
        STATUS_PATH,
        {
            "updatedAt": now_iso(),
            "pid": os.getpid(),
            "ok": any(a.get("ok") for a in accounts),
            "connected": bool(connected),
            "message": message,
            "login": first.get("login"),
            "server": first.get("server"),
            "name": first.get("name"),
            "balance": first.get("balance"),
            "equity": first.get("equity"),
            "accounts": accounts,
        },
    )


def heartbeat(message: str | None = None) -> None:
    """Keep a live stamp so the desk can restart this process if MT5 hangs."""
    prev = read_json(STATUS_PATH, {})
    if not isinstance(prev, dict):
        prev = {}
    prev["updatedAt"] = now_iso()
    prev["pid"] = os.getpid()
    if message:
        prev["message"] = message
    elif not prev.get("message"):
        prev["message"] = "Executor running"
    write_json(STATUS_PATH, prev)


def load_queue() -> dict:
    data = read_json(QUEUE_PATH, {"jobs": []})
    if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
        return {"jobs": []}
    return data


def save_queue(queue: dict) -> None:
    write_json(QUEUE_PATH, queue)
    try:
        COMMON_QUEUE.parent.mkdir(parents=True, exist_ok=True)
        write_json(COMMON_QUEUE, queue)
    except Exception:
        pass


def current_login() -> int | None:
    info = mt5.account_info()
    return int(info.login) if info else None


def connect(cfg: dict, force: bool = False) -> dict:
    status = {
        "id": cfg["id"],
        "label": cfg["label"],
        "ok": False,
        "connected": False,
        "message": "",
    }
    wanted = int(cfg["login"]) if str(cfg.get("login") or "").isdigit() else None
    if not force and wanted and current_login() == wanted:
        account = mt5.account_info()
        if account is not None:
            status.update(
                {
                    "ok": True,
                    "connected": True,
                    "login": account.login,
                    "server": account.server,
                    "name": account.name,
                    "balance": account.balance,
                    "equity": account.equity,
                    "currency": str(getattr(account, "currency", None) or ""),
                    "message": "Watching the desk queue",
                }
            )
            return status
    mt5.shutdown()
    kwargs = {}
    if cfg["terminalPath"]:
        kwargs["path"] = cfg["terminalPath"]
    if not mt5.initialize(**kwargs):
        status["message"] = f"initialize failed: {mt5.last_error()}"
        return status
    if cfg["login"] and cfg["password"] and cfg["server"]:
        ok = mt5.login(int(cfg["login"]), password=cfg["password"], server=cfg["server"])
        if not ok:
            status["message"] = f"login failed: {mt5.last_error()}"
            return status
    account = mt5.account_info()
    if account is None:
        status["message"] = f"no account info: {mt5.last_error()}"
        return status
    status.update(
        {
            "ok": True,
            "connected": True,
            "login": account.login,
            "server": account.server,
            "name": account.name,
            "balance": account.balance,
            "equity": account.equity,
            "currency": str(getattr(account, "currency", None) or ""),
            "message": "Watching the desk queue",
        }
    )
    return status


GOLD_MIN_USD = 500.0
PAIR_META = {
    "USDJPY": {"pip_size": 0.01, "pip_value": 6.8},
    "XAUUSD": {"pip_size": 0.1, "pip_value": 10.0},
    "EURUSD": {"pip_size": 0.0001, "pip_value": 10.0},
    "GBPJPY": {"pip_size": 0.01, "pip_value": 6.8},
}
_FX_CACHE: dict[str, tuple[float, float]] = {}


def _tick_mid(name: str) -> float | None:
    mt5.symbol_select(name, True)
    tick = mt5.symbol_info_tick(name)
    if tick is None:
        return None
    bid = float(tick.bid or 0)
    ask = float(tick.ask or 0)
    if bid > 0 and ask > 0:
        return (bid + ask) / 2.0
    if bid > 0:
        return bid
    if ask > 0:
        return ask
    return None


def _yahoo_usd_cross(currency: str) -> float | None:
    """Return units of `currency` per 1 USD (e.g. UGX per USD). Cached 10 minutes."""
    now = time.time()
    cached = _FX_CACHE.get(currency)
    if cached and now - cached[1] < 600:
        return cached[0]
    url = "https://query1.finance.yahoo.com/v8/finance/chart/USD" + currency + "=X?interval=1d&range=5d"
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 ExnessfxBot/1.0", "Accept": "application/json"})
        with urlopen(req, timeout=8) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        price = payload.get("chart", {}).get("result", [{}])[0].get("meta", {}).get("regularMarketPrice")
        if isinstance(price, (int, float)) and price > 0:
            _FX_CACHE[currency] = (float(price), now)
            return float(price)
    except Exception:
        pass
    return cached[0] if cached else None


def fx_to_usd(amount: float, currency: str, suffix: str = "") -> tuple[float | None, str]:
    """Convert account equity into USD. Never treat UGX (or other) as if it were dollars."""
    cur = (currency or "USD").upper().strip()
    if cur in {"USD", "USDT", "USDC"}:
        return float(amount), "USD"
    names = []
    if suffix:
        names.extend([f"USD{cur}{suffix}", f"{cur}USD{suffix}"])
    names.extend([f"USD{cur}", f"USD{cur}m", f"USD{cur}.a", f"{cur}USD", f"{cur}USDm", f"{cur}USD.a"])
    for name in names:
        px = _tick_mid(name)
        if not px:
            continue
        if name.upper().startswith("USD"):
            return float(amount) / px, f"{name} {px:g}"
        return float(amount) * px, f"{name} {px:g}"
    web = _yahoo_usd_cross(cur)
    if web:
        return float(amount) / web, f"USD{cur}=X {web:g}"
    return None, f"no USD{cur} rate"


def account_size_usd(suffix: str = "") -> tuple[float | None, str, float, str]:
    """Returns (usd, currency, native_equity, rate_note). usd is None if conversion failed."""
    info = mt5.account_info()
    if info is None:
        return None, "USD", 0.0, "no account"
    native = float(info.equity if info.equity else info.balance or 0)
    currency = str(getattr(info, "currency", None) or "USD").upper()
    usd, note = fx_to_usd(native, currency, suffix)
    return usd, currency, native, note


def stop_pips(pair: str, entry: float, stop_loss: float) -> float:
    meta = PAIR_META.get(pair) or {"pip_size": 0.01}
    size = float(meta["pip_size"]) or 0.01
    return abs(float(entry) - float(stop_loss)) / size


def position_lots(balance: float, stop: float, pair: str, risk_pct: float) -> float:
    """Same formula as src/lib/calc.ts positionForRisk()."""
    pip_value = float((PAIR_META.get(pair) or {}).get("pip_value") or 10)
    if stop <= 0 or pip_value <= 0 or balance <= 0 or risk_pct <= 0:
        return 0.0
    risk_money = balance * (risk_pct / 100.0)
    units = round(risk_money / (stop * (pip_value / 100000.0)) / 100.0) * 100
    return units / 100000.0


def snap_lot(raw: float, info) -> float | None:
    step = float(info.volume_step or 0.01)
    vmin = float(info.volume_min or 0.01)
    vmax = float(info.volume_max or 100)
    if raw <= 0:
        return None
    stepped = round(raw / step) * step
    if stepped < vmin:
        return None
    return min(vmax, max(vmin, round(stepped / step) * step))


def resolve_symbol(pair: str, suffix: str) -> str | None:
    candidates = []
    if suffix:
        candidates.append(pair + suffix)
    candidates.extend([pair, pair + "m", pair + ".pro", pair + ".a"])
    if pair == "XAUUSD":
        candidates.extend(["XAUUSDm", "GOLD", "XAUUSD.s"])
    if pair == "EURUSD":
        candidates.extend(["EURUSDm", "EURUSD.s"])
    seen = set()
    for name in candidates:
        if not name or name in seen:
            continue
        seen.add(name)
        info = mt5.symbol_info(name)
        if info is None:
            mt5.symbol_select(name, True)
            info = mt5.symbol_info(name)
        if info is not None:
            if not info.visible:
                mt5.symbol_select(name, True)
            return name
    matches = mt5.symbols_get("*" + pair + "*") or []
    if matches:
        name = matches[0].name
        mt5.symbol_select(name, True)
        return name
    return None


def filling_modes(info) -> list[int]:
    modes = []
    filling = int(getattr(info, "filling_mode", 0) or 0)
    if filling & 2:
        modes.append(mt5.ORDER_FILLING_IOC)
    if filling & 1:
        modes.append(mt5.ORDER_FILLING_FOK)
    if filling & 4:
        modes.append(mt5.ORDER_FILLING_RETURN)
    if not modes:
        modes = [mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]
    return modes


def comment_for(signal_id: str) -> str:
    return ("fx:" + signal_id)[:31]


def order_type_for(side: str, entry: float, bid: float, ask: float, point: float) -> tuple[int, float]:
    """Market if already at entry; limit if we buy/sell cheaper; stop if we buy/sell through."""
    slack = max(float(point) * 8, 0.0)
    ask = float(ask or 0)
    bid = float(bid or 0)
    if side == "buy":
        if abs(ask - entry) <= slack:
            return mt5.ORDER_TYPE_BUY, ask
        if entry < ask:
            return mt5.ORDER_TYPE_BUY_LIMIT, entry
        return mt5.ORDER_TYPE_BUY_STOP, entry
    if abs(bid - entry) <= slack:
        return mt5.ORDER_TYPE_SELL, bid
    if entry > bid:
        return mt5.ORDER_TYPE_SELL_LIMIT, entry
    return mt5.ORDER_TYPE_SELL_STOP, entry


def order_kind_from_type(order_type: int) -> str:
    if order_type in (mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_SELL):
        return "market"
    if order_type in (mt5.ORDER_TYPE_BUY_STOP, mt5.ORDER_TYPE_SELL_STOP):
        return "stop"
    return "limit"


def tick_hits_entry(trail: dict, tick) -> bool:
    entry = float(trail.get("signalEntry") or trail.get("entry") or 0)
    side = str(trail.get("side") or "")
    kind = str(trail.get("orderKind") or "limit")
    bid = float(tick.bid or 0)
    ask = float(tick.ask or 0)
    last = float(getattr(tick, "last", 0) or 0)
    if kind == "market":
        return True
    if side == "buy":
        if kind == "stop":
            return ask >= entry or last >= entry or bid >= entry
        return ask <= entry or bid <= entry or (last > 0 and last <= entry)
    if kind == "stop":
        return bid <= entry or last <= entry or ask <= entry
    return bid >= entry or ask >= entry or (last > 0 and last >= entry)


def levels_wrong_side(side: str, entry: float, sl: float, tp: float) -> str | None:
    if side == "buy":
        if sl >= entry:
            return "for a buy, SL must be below entry"
        if tp <= entry:
            return "for a buy, TP must be above entry"
    else:
        if sl <= entry:
            return "for a sell, SL must be above entry"
        if tp >= entry:
            return "for a sell, TP must be below entry"
    return None


def nudge_stops(info, tick, side: str, order_type: int, price: float, sl: float, tp: float) -> tuple[float, float]:
    digits = int(info.digits)
    point = float(info.point)
    level = max(int(getattr(info, "trade_stops_level", 0) or 0), 10) * point
    market = order_type in (mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_SELL)
    ref = float(tick.ask if side == "buy" else tick.bid) if market else price
    if side == "buy":
        sl = min(sl, ref - level)
        tp = max(tp, ref + level)
    else:
        sl = max(sl, ref + level)
        tp = min(tp, ref - level)
    return round(sl, digits), round(tp, digits)


def send_request(request: dict, modes: list[int]):
    last = None
    for mode in modes:
        request = {**request, "type_filling": mode}
        result = mt5.order_send(request)
        last = result
        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
            return result
        if result is not None and result.retcode == mt5.TRADE_RETCODE_INVALID_FILL:
            continue
        return result
    return last


def attach_desk_trail(
    job: dict,
    cfg: dict,
    symbol: str,
    entry: float,
    sl: float,
    tp: float,
    order_kind: str,
    ticket: int = 0,
    virtual: bool = False,
) -> None:
    pending = order_kind != "market"
    register_trail(
        {
            "accountId": cfg["id"],
            "login": cfg.get("login"),
            "signalId": job["signalId"],
            "ticket": int(ticket or 0),
            "symbol": symbol,
            "side": job["side"],
            "entry": entry,
            "signalEntry": float(job["entry"]),
            "originalSL": sl,
            "originalTP": tp,
            "orderKind": order_kind,
            "pending": pending,
            "virtual": bool(virtual),
        }
    )
    if not pending:
        notify_desk_entered(str(job.get("signalId") or ""), int(ticket or 0))


def open_trade(job: dict, cfg: dict) -> tuple[str, int | None, str]:
    pair = str(job.get("pair") or "")
    equity_usd, currency, native, rate_note = account_size_usd(str(cfg.get("symbolSuffix") or ""))
    if equity_usd is None:
        return (
            "error",
            None,
            f"cannot convert {native:.0f} {currency} to USD ({rate_note}) — lot size not calculated",
        )
    sized = f"{native:,.0f} {currency} = ${equity_usd:,.2f} via {rate_note}"

    symbol = resolve_symbol(pair, cfg["symbolSuffix"])
    if not symbol:
        return "error", None, f"symbol not found for {pair}"
    info = mt5.symbol_info(symbol)
    tick = mt5.symbol_info_tick(symbol)
    if info is None or tick is None:
        return "error", None, f"no quote for {symbol}: {mt5.last_error()}"

    risk_pct = float(job.get("riskPct") or cfg.get("riskPct") or 1)
    pips = stop_pips(pair, job["entry"], job["stopLoss"])
    raw_lot = position_lots(equity_usd, pips, pair, risk_pct)
    lot = snap_lot(raw_lot, info)
    digits = int(info.digits)
    point = float(info.point)
    entry = round(float(job["entry"]), digits)
    sl = round(float(job["stopLoss"]), digits)
    tp = round(float(job["takeProfit"]), digits)
    side = str(job.get("side") or "")
    bad = levels_wrong_side(side, entry, sl, tp)
    if bad:
        return "error", None, f"10016 Invalid stops — {bad} (entry {entry}, sl {sl}, tp {tp})"
    order_type, price = order_type_for(side, entry, tick.bid, tick.ask, point)
    price = round(price, digits)
    order_kind = order_kind_from_type(order_type)

    if pair == "XAUUSD" and equity_usd < GOLD_MIN_USD:
        attach_desk_trail(job, cfg, symbol, entry, sl, tp, order_kind, virtual=True)
        return (
            "skipped",
            None,
            f"{sized} is under ${GOLD_MIN_USD:.0f} — gold not opened on MT5. Card stays live and is tracked without a ticket.",
        )
    if lot is None:
        attach_desk_trail(job, cfg, symbol, entry, sl, tp, order_kind, virtual=True)
        return (
            "skipped",
            None,
            f"calculated {raw_lot:.4f} lot from {sized} @ {risk_pct:g}% / {pips:.0f} pips is below broker minimum {info.volume_min}. Card stays live and is tracked without a ticket.",
        )

    request = {
        "action": mt5.TRADE_ACTION_DEAL
        if order_type in (mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_SELL)
        else mt5.TRADE_ACTION_PENDING,
        "symbol": symbol,
        "volume": lot,
        "type": order_type,
        "price": price,
        "sl": sl,
        "tp": tp,
        "deviation": cfg["deviation"],
        "magic": cfg["magic"],
        "comment": comment_for(job["signalId"]),
        "type_time": mt5.ORDER_TIME_GTC,
    }
    result = send_request(request, filling_modes(info))
    if result is not None and result.retcode == 10016:
        sl2, tp2 = nudge_stops(info, tick, side, order_type, price, sl, tp)
        if (sl2, tp2) != (sl, tp):
            request["sl"] = sl2
            request["tp"] = tp2
            sl, tp = sl2, tp2
            result = send_request(request, filling_modes(info))
    if result is None:
        return "error", None, f"order_send failed: {mt5.last_error()}"
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return "error", None, f"{result.retcode} {result.comment}"
    ticket = int(result.order or result.deal or 0)
    attach_desk_trail(job, cfg, symbol, entry, sl, tp, order_kind, ticket=ticket, virtual=False)
    return (
        "sent",
        ticket,
        f"{order_kind} {job['side']} {lot} {symbol} @ {price} sl={sl} tp={tp} "
        f"(auto {risk_pct:g}% of {sized}, {pips:.0f} pip SL)",
    )


def load_trails() -> dict:
    data = read_json(TRAIL_PATH, {"trails": []})
    if not isinstance(data, dict) or not isinstance(data.get("trails"), list):
        return {"trails": []}
    return data


def save_trails(store: dict) -> None:
    write_json(TRAIL_PATH, store)


def register_trail(row: dict) -> None:
    risk = abs(float(row["entry"]) - float(row["originalSL"]))
    if risk <= 0:
        return
    reward = abs(float(row["originalTP"]) - float(row["entry"]))
    store = load_trails()
    store["trails"] = [
        t
        for t in store["trails"]
        if not (t.get("signalId") == row["signalId"] and str(t.get("accountId")) == str(row["accountId"]))
    ]
    store["trails"].append(
        {
            **row,
            "risk": risk,
            "tpR": reward / risk,
            "stage": 0,
            "createdAt": now_iso(),
        }
    )
    save_trails(store)


def desk_pair_from_symbol(symbol: str) -> str:
    s = (symbol or "").upper()
    for pair in ("XAUUSD", "GBPJPY", "USDJPY", "EURUSD"):
        if pair in s:
            return pair
    return ""


def write_live_quotes() -> None:
    quotes = {}
    names: list[str] = []
    for trail in load_trails().get("trails") or []:
        if trail.get("symbol"):
            names.append(str(trail["symbol"]))
    names.extend(["USDJPYz", "GBPJPYz", "XAUUSDz", "EURUSDz", "USDJPY", "GBPJPY", "XAUUSD", "EURUSD"])
    for name in names:
        pair = desk_pair_from_symbol(name)
        if not pair or pair in quotes:
            continue
        mt5.symbol_select(name, True)
        tick = mt5.symbol_info_tick(name)
        if tick is None or not (tick.bid or tick.ask):
            continue
        bid = float(tick.bid or tick.ask)
        ask = float(tick.ask or tick.bid)
        quotes[pair] = {
            "bid": bid,
            "ask": ask,
            "mid": (bid + ask) / 2.0,
            "symbol": name,
            "at": now_iso(),
        }
    try:
        write_json(QUOTES_PATH, {"updatedAt": now_iso(), "quotes": quotes})
    except Exception as exc:
        log(f"Could not write quotes: {exc}")


def master_cfg() -> dict | None:
    enabled = [a for a in load_accounts() if a["enabled"]]
    return enabled[0] if enabled else None


def native_to_usd(amount: float, currency: str, suffix: str) -> tuple[float | None, str]:
    return fx_to_usd(amount, currency, suffix)


def write_master_pnl(cfg: dict) -> None:
    """Closed + floating P/L in USD for the first enabled (master) account only."""
    master = master_cfg()
    if not master or master["id"] != cfg["id"]:
        return
    info = mt5.account_info()
    if info is None:
        return
    wanted = int(master["login"]) if str(master.get("login") or "").isdigit() else None
    if wanted and int(info.login) != wanted:
        return
    currency = str(getattr(info, "currency", None) or "USD").upper()
    suffix = str(master.get("symbolSuffix") or "")
    magic = int(master.get("magic") or 0)
    sample, rate_note = native_to_usd(1.0 if currency not in {"USD", "USDT", "USDC"} else 1.0, currency, suffix)
    if sample is None:
        sample = 1.0
        rate_note = "no USD rate"
    # sample is 1 native → USD for FX quotes; for USD it's 1.
    if currency in {"USD", "USDT", "USDC"}:
        native_per_usd = 1.0
        usd_per_native = 1.0
    else:
        usd_per_native = float(sample)
        native_per_usd = 1.0 / usd_per_native if usd_per_native else 0.0

    def to_usd(native: float) -> float:
        return round(float(native) * usd_per_native, 4)

    now = datetime.now(timezone.utc)
    deals = mt5.history_deals_get(now - timedelta(days=400), now + timedelta(hours=2)) or []
    out_kinds = {mt5.DEAL_ENTRY_OUT, getattr(mt5, "DEAL_ENTRY_INOUT", 2), getattr(mt5, "DEAL_ENTRY_OUT_BY", 3)}
    skip_types = {getattr(mt5, "DEAL_TYPE_BALANCE", 2), getattr(mt5, "DEAL_TYPE_CREDIT", 3)}

    tickets: dict[str, dict] = {}
    signals: dict[str, dict] = {}

    def add_row(key_ticket: int, signal_id: str, usd: float, at: str, closed: bool, floating: bool = False):
        row = {
            "usd": round(usd, 4),
            "closed": closed,
            "floating": floating,
            "at": at,
        }
        if key_ticket:
            prev = tickets.get(str(key_ticket))
            if prev:
                row["usd"] = round(float(prev["usd"]) + usd, 4)
                row["closed"] = prev["closed"] or closed
                row["floating"] = prev.get("floating") and floating
            tickets[str(key_ticket)] = row
        if signal_id:
            prev = signals.get(signal_id)
            if prev:
                signals[signal_id] = {
                    "usd": round(float(prev["usd"]) + usd, 4),
                    "closed": prev["closed"] or closed,
                    "floating": prev.get("floating") and floating,
                    "at": at,
                }
            else:
                signals[signal_id] = dict(row)

    week_start = (datetime.now(EAT) - timedelta(days=datetime.now(EAT).weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    month_start = datetime.now(EAT).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = datetime.now(EAT).replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    week_usd = 0.0
    month_usd = 0.0
    year_usd = 0.0

    for deal in deals:
        if int(getattr(deal, "type", -1)) in skip_types:
            continue
        comment = str(deal.comment or "")
        ours = int(deal.magic or 0) == magic or comment.startswith("fx:")
        if not ours:
            continue
        if int(deal.entry) not in out_kinds:
            continue
        native = float(deal.profit or 0)
        usd = to_usd(native)
        at = datetime.fromtimestamp(int(deal.time), tz=timezone.utc).isoformat()
        eat = datetime.fromtimestamp(int(deal.time), tz=timezone.utc).astimezone(EAT)
        if eat >= week_start:
            week_usd += usd
        if eat >= month_start:
            month_usd += usd
        if eat >= year_start:
            year_usd += usd
        sig = ""
        if comment.startswith("fx:") and len(comment) > 3:
            sig = comment[3:].split()[0][:16]
        add_row(int(deal.order or deal.position_id or deal.ticket or 0), sig, usd, at, True, False)
        row = tickets.get(str(int(deal.order or deal.position_id or deal.ticket or 0)))
        if row:
            for key in (int(deal.order or 0), int(deal.position_id or 0), int(deal.ticket or 0)):
                if key > 0:
                    tickets[str(key)] = row

    open_usd = 0.0
    for pos in mt5.positions_get() or []:
        comment = str(pos.comment or "")
        ours = int(pos.magic or 0) == magic or comment.startswith("fx:")
        if not ours:
            continue
        native = float(pos.profit or 0)
        usd = to_usd(native)
        open_usd += usd
        sig = ""
        if comment.startswith("fx:") and len(comment) > 3:
            sig = comment[3:].split()[0][:12]
        add_row(int(pos.ticket), sig, usd, now_iso(), False, True)
        row = tickets.get(str(int(pos.ticket)))
        ident = int(getattr(pos, "identifier", 0) or 0)
        if row and ident:
            tickets[str(ident)] = row

    write_json(
        PNL_PATH,
        {
            "updatedAt": now_iso(),
            "accountId": master["id"],
            "login": int(info.login),
            "currency": currency,
            "rateNote": rate_note,
            "openUsd": round(open_usd, 2),
            "weekUsd": round(week_usd, 2),
            "monthUsd": round(month_usd, 2),
            "yearUsd": round(year_usd, 2),
            "tickets": tickets,
            "signals": signals,
        },
    )


def notify_desk_cancel(signal_id: str, note: str) -> None:
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict) or not isinstance(data.get("signals"), list):
        return
    now = now_iso()
    found = False
    for row in data["signals"]:
        if row.get("id") != signal_id:
            continue
        if row.get("status") != "active":
            return
        mt5row = row.get("mt5") if isinstance(row.get("mt5"), dict) else {}
        entered = bool(row.get("enteredAt")) or str(mt5row.get("message") or "").startswith("market ")
        if entered:
            log(f"Skip desk cancel {signal_id}: entry already triggered — treat as fill")
            return
        row["status"] = "cancelled"
        row["note"] = note
        row["updatedAt"] = now
        found = True
        break
    if found:
        write_json(SIGNALS_PATH, data)
        log(f"Desk cancel: {signal_id} — {note}")


def remove_pending_ticket(ticket: int) -> bool:
    if ticket <= 0:
        return False
    result = mt5.order_send({"action": mt5.TRADE_ACTION_REMOVE, "order": int(ticket)})
    return bool(result and result.retcode == mt5.TRADE_RETCODE_DONE)


def pending_tp_tapped(trail: dict, tick, high: float | None, low: float | None) -> bool:
    tp = float(trail.get("originalTP") or 0)
    if tp <= 0:
        return False
    side = str(trail.get("side") or "")
    if side == "buy":
        return tick.bid >= tp or tick.ask >= tp or (high is not None and high >= tp)
    return tick.bid <= tp or tick.ask <= tp or (low is not None and low <= tp)


def manage_virtual_trails() -> None:
    """Track limit / stop / market cards with no MT5 ticket (lot too small, gold skip, etc.)."""
    store = load_trails()
    if not store["trails"]:
        return
    kept = []
    dirty = False
    for trail in store["trails"]:
        if not trail.get("virtual"):
            kept.append(trail)
            continue
        symbol = str(trail.get("symbol") or "")
        tick = mt5.symbol_info_tick(symbol) if symbol else None
        if tick is None:
            kept.append(trail)
            continue
        sid = str(trail.get("signalId") or "")
        side = str(trail.get("side") or "")
        buy = side == "buy"
        entry = float(trail.get("signalEntry") or trail.get("entry") or 0)
        sl = float(trail.get("originalSL") or 0)
        tp = float(trail.get("originalTP") or 0)
        risk = float(trail.get("risk") or 0)
        if risk <= 0:
            risk = abs(entry - sl)
            trail["risk"] = risk
        if trail.get("pending"):
            if pending_tp_tapped(trail, tick, None, None):
                notify_desk_cancel(sid, "Cancelled: TP was tapped before entry.")
                dirty = True
                continue
            if tick_hits_entry(trail, tick):
                trail["pending"] = False
                trail["filledAt"] = now_iso()
                notify_desk_entered(sid, 0)
                dirty = True
            else:
                kept.append(trail)
                continue
        stage = int(trail.get("stage") or 0)
        r1 = entry + risk if buy else entry - risk
        r2 = entry + 2 * risk if buy else entry - 2 * risk
        cur_sl = sl
        if stage >= 1:
            cur_sl = float(trail.get("beSl") or entry)
        if stage >= 2:
            cur_sl = r1
        if tp and tick_prints(tick, tp, buy):
            notify_desk_fill(sid, tp, "tp")
            dirty = True
            continue
        sl_hit = tick.bid <= cur_sl or tick.ask <= cur_sl if buy else tick.bid >= cur_sl or tick.ask >= cur_sl
        if cur_sl and sl_hit:
            notify_desk_fill(sid, cur_sl, "sl")
            dirty = True
            continue
        if stage < 2 and risk and tick_prints(tick, r2, buy):
            trail["stage"] = 2
            trail["halfTaken"] = True
            notify_desk_sl(sid, r1, "lock1r")
            dirty = True
        elif stage < 1 and risk and tick_prints(tick, r1, buy):
            trail["stage"] = 1
            trail["beSl"] = entry
            notify_desk_sl(sid, entry, "be")
            dirty = True
        kept.append(trail)
    if dirty or len(kept) != len(store["trails"]):
        store["trails"] = kept
        save_trails(store)


def manage_pending_invalidation() -> None:
    """A pending order will not self-cancel when price hits TP. Pull it and kill the card."""
    store = load_trails()
    if not store["trails"]:
        return
    kept = []
    dirty = False
    for trail in store["trails"]:
        if trail.get("virtual"):
            kept.append(trail)
            continue
        if not trail.get("pending"):
            kept.append(trail)
            continue
        orders, positions = matching_entities(trail["signalId"], trail)
        if positions:
            kept.append(trail)
            continue
        if trail.get("filledAt"):
            kept.append(trail)
            continue
        kind, price = history_exit(
            str(trail.get("signalId") or ""),
            int(trail.get("ticket") or 0),
            float(trail.get("originalSL") or 0),
            float(trail.get("originalTP") or 0),
            str(trail.get("createdAt") or ""),
        )
        if kind and price:
            notify_desk_fill(str(trail.get("signalId") or ""), price, kind)
            dirty = True
            continue
        symbol = str(trail.get("symbol") or "")
        tick = mt5.symbol_info_tick(symbol) if symbol else None
        if tick is None:
            kept.append(trail)
            continue
        high, low = excursion(symbol, str(trail.get("createdAt") or ""))
        if not pending_tp_tapped(trail, tick, high, low):
            kept.append(trail)
            continue
        ticket = int(trail.get("ticket") or 0)
        removed = remove_pending_ticket(ticket)
        if not removed:
            for order in orders:
                if remove_pending_ticket(int(order.ticket)):
                    removed = True
        note = "Cancelled: TP was tapped before entry."
        notify_desk_cancel(str(trail.get("signalId") or ""), note)
        stamp_signal_mt5(
            str(trail.get("signalId") or ""),
            "sent" if removed else "skipped",
            "pending pulled — TP before entry" if removed else "TP before entry, pending already gone",
            ticket or None,
        )
        log(
            f"Pending invalid: {trail.get('symbol')} #{ticket} TP {trail.get('originalTP')} "
            f"hit before entry {trail.get('signalEntry') or trail.get('entry')} — "
            f"{'removed' if removed else 'already gone'}"
        )
        dirty = True
    if dirty:
        store["trails"] = kept
        save_trails(store)


def open_commission_native(ticket: int, signal_id: str) -> float | None:
    """Opening commission+fee in account currency. None if the IN deal is not in history yet."""
    start = datetime.now(timezone.utc) - timedelta(days=3)
    deals = mt5.history_deals_get(start, datetime.now(timezone.utc) + timedelta(hours=1)) or []
    tag = comment_for(signal_id)
    short = signal_id[:12]
    native = 0.0
    found = False
    in_kind = int(getattr(mt5, "DEAL_ENTRY_IN", 0))
    for deal in deals:
        if int(deal.entry) != in_kind:
            continue
        comment = str(deal.comment or "")
        hit_ticket = ticket and (
            int(deal.position_id or 0) == ticket
            or int(deal.order or 0) == ticket
            or int(deal.ticket or 0) == ticket
        )
        if hit_ticket or tag in comment or short in comment:
            native += float(deal.commission or 0) + float(getattr(deal, "fee", 0) or 0)
            found = True
    if not found:
        return None
    return native


def open_commission(ticket: int, signal_id: str) -> tuple[float | None, str]:
    native = open_commission_native(ticket, signal_id)
    if native is None:
        return None, ""
    info = mt5.account_info()
    currency = str(getattr(info, "currency", None) or "USD").upper() if info else "USD"
    suffix = ""
    master = master_cfg()
    if master:
        suffix = str(master.get("symbolSuffix") or "")
    usd, note = fx_to_usd(native, currency, suffix)
    if usd is None:
        return native, f"{native:g} {currency}"
    return usd, f"{native:g} {currency} → ${usd:.4f} ({note})"


def is_commission_symbol(symbol: str) -> bool:
    return str(symbol or "").rstrip().lower().endswith("z")


def price_offset_for_cover(pos, cover_native: float) -> float:
    """Price distance whose gross profit equals `cover_native` in deposit currency."""
    if cover_native <= 0:
        return 0.0
    info = mt5.symbol_info(pos.symbol)
    if info is None:
        return 0.0
    vol = float(pos.volume or 0)
    tick_size = float(info.trade_tick_size or info.point or 0)
    tick_value = float(info.trade_tick_value or 0)
    if vol <= 0 or tick_size <= 0 or tick_value <= 0:
        return 0.0
    return cover_native * tick_size / (vol * tick_value)


def commission_be_sl(pos, signal_entry: float, trail: dict) -> tuple[float, str]:
    """1R SL: signal entry, or entry ± offset on z-suffix so a stop-out covers open+close commission."""
    info = mt5.symbol_info(pos.symbol)
    digits = int(info.digits) if info else 5
    entry = float(signal_entry)
    if not is_commission_symbol(str(pos.symbol or trail.get("symbol") or "")):
        return round(entry, digits), "entry"
    native = open_commission_native(int(pos.ticket), str(trail.get("signalId") or ""))
    if native is None:
        native = 0.0
    cover = abs(float(native)) * 2.0
    offset = price_offset_for_cover(pos, cover)
    buy = pos.type == mt5.POSITION_TYPE_BUY
    sl = entry + offset if buy else entry - offset
    sl = round(sl, digits)
    if offset <= 0:
        return sl, "entry (no commission yet)"
    return sl, f"entry {entry:g} + commission cover {cover:g} → {sl:g}"


def attach_open_commission(signal_id: str, ticket: int = 0) -> None:
    if not signal_id:
        return
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict) or not isinstance(data.get("signals"), list):
        return
    usd, note = open_commission(ticket, signal_id)
    if usd is None:
        return
    changed = False
    for row in data["signals"]:
        if row.get("id") != signal_id:
            continue
        mt5row = row.get("mt5") if isinstance(row.get("mt5"), dict) else {}
        if mt5row.get("commissionAt"):
            return
        native = open_commission_native(ticket, signal_id)
        mt5row["commissionUsd"] = round(float(usd), 4)
        if native is not None:
            mt5row["commissionNative"] = round(float(native), 4)
        mt5row["commissionNote"] = note
        mt5row["commissionAt"] = now_iso()
        row["mt5"] = mt5row
        changed = True
        break
    if changed:
        write_json(SIGNALS_PATH, data)
        log(f"Commission at trigger {signal_id}: {note}")


def notify_desk_entered(signal_id: str, ticket: int = 0) -> None:
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict) or not isinstance(data.get("signals"), list):
        return
    now = now_iso()
    found = False
    for row in data["signals"]:
        if row.get("id") != signal_id:
            continue
        if row.get("status") != "active":
            return
        if row.get("enteredAt"):
            attach_open_commission(signal_id, ticket)
            return
        row["enteredAt"] = now
        row["updatedAt"] = now
        found = True
        break
    if found:
        write_json(SIGNALS_PATH, data)
        log(f"Desk entry filled: {signal_id}")
        attach_open_commission(signal_id, ticket)


def rebuild_monthly(data: dict) -> None:
    months: dict[str, dict[str, int]] = {}
    labels = {
        "01": "January",
        "02": "February",
        "03": "March",
        "04": "April",
        "05": "May",
        "06": "June",
        "07": "July",
        "08": "August",
        "09": "September",
        "10": "October",
        "11": "November",
        "12": "December",
    }
    now_key = datetime.now(EAT).strftime("%Y-%m")
    for row in data.get("pipLedger") or []:
        key = str(row.get("eatMonth") or "")
        if not key:
            continue
        bucket = months.setdefault(key, {"ALL": 0, "USDJPY": 0, "XAUUSD": 0, "EURUSD": 0, "GBPJPY": 0})
        pips = int(row.get("pips") or 0)
        pair = str(row.get("pair") or "")
        bucket["ALL"] += pips
        if pair in bucket:
            bucket[pair] += pips
    monthly = []
    for key in sorted(months.keys(), reverse=True):
        y, m = key.split("-")
        name = labels.get(m, m)
        label = f"Month-to-date · {name} {y}" if key == now_key else f"{name} {y}"
        monthly.append({"key": key, "label": label, "totals": months[key]})
    data["monthly"] = monthly


def notify_desk_fill(signal_id: str, exit_price: float, kind: str) -> None:
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict) or not isinstance(data.get("signals"), list):
        return
    now = now_iso()
    found = None
    for row in data["signals"]:
        if row.get("id") == signal_id and row.get("status") == "active":
            found = row
            break
    if not found:
        return
    entry = float(found.get("filledEntry") or found.get("entry") or 0)
    pair = str(found.get("pair") or "")
    side = str(found.get("side") or "")
    pip_size = float((PAIR_META.get(pair) or {}).get("pip_size") or 0.01)
    raw = round(abs(entry - float(exit_price)) / pip_size) if pip_size else 0
    direction = 1 if side == "buy" else -1
    move = 0 if float(exit_price) == entry else (1 if float(exit_price) > entry else -1)
    pips = int(direction * move * raw)
    half = bool(found.get("halfTaken")) or any(
        isinstance(r, dict) and r.get("reason") == "lock1r" for r in (found.get("levelRevisions") or [])
    )
    found["status"] = "filled"
    found["filledEntry"] = entry
    found["filledExit"] = float(exit_price)
    found["pips"] = pips
    found["updatedAt"] = now
    if half and kind == "sl":
        found["note"] = "Half closed at 2R, remainder filled at stop loss."
    elif half and kind == "tp":
        found["note"] = "Half closed at 2R, remainder filled at take profit."
    elif kind == "sl":
        found["note"] = "Filled at stop loss."
    elif kind == "tp":
        found["note"] = "Filled at take profit."
    else:
        found["note"] = "Filled at market."
    ledger = data.setdefault("pipLedger", [])
    if not any(x.get("signalId") == signal_id for x in ledger):
        eat = datetime.now(EAT)
        ledger.append(
            {
                "signalId": signal_id,
                "pair": pair,
                "pips": pips,
                "at": now,
                "eatDay": eat.strftime("%Y-%m-%d"),
                "eatMonth": eat.strftime("%Y-%m"),
            }
        )
    rebuild_monthly(data)
    write_json(SIGNALS_PATH, data)
    log(f"Desk fill: {signal_id} {kind} exit {exit_price} ({pips} pips)")


def history_exit(
    signal_id: str,
    ticket: int,
    sl: float,
    tp: float,
    created_iso: str,
) -> tuple[str, float] | tuple[None, None]:
    start = datetime.now(timezone.utc) - timedelta(days=5)
    if created_iso:
        try:
            start = datetime.fromisoformat(created_iso.replace("Z", "+00:00")) - timedelta(minutes=5)
        except Exception:
            pass
    deals = mt5.history_deals_get(start, datetime.now(timezone.utc) + timedelta(hours=1)) or []
    out_kinds = {mt5.DEAL_ENTRY_OUT, getattr(mt5, "DEAL_ENTRY_INOUT", 2), getattr(mt5, "DEAL_ENTRY_OUT_BY", 3)}
    tag = comment_for(signal_id)
    short = signal_id[:12]
    outs = []
    for deal in deals:
        if int(deal.entry) not in out_kinds:
            continue
        comment = str(deal.comment or "")
        hit_ticket = ticket and (
            int(deal.position_id or 0) == ticket
            or int(deal.order or 0) == ticket
            or int(deal.ticket or 0) == ticket
        )
        if hit_ticket or tag in comment or short in comment:
            outs.append(deal)
    if not outs:
        return None, None
    best = outs[-1]
    last_price = float(best.price)
    vol = sum(float(d.volume or 0) for d in outs)
    if vol > 0:
        price = sum(float(d.price) * float(d.volume or 0) for d in outs) / vol
    else:
        price = last_price
    reason = int(getattr(best, "reason", 0) or 0)
    if reason in (
        getattr(mt5, "DEAL_REASON_SL", 4),
        getattr(mt5, "DEAL_REASON_SO", 6),
    ):
        return "sl", price
    if reason == getattr(mt5, "DEAL_REASON_TP", 5):
        return "tp", price
    return "manual", price


def reconcile_closed_signals() -> None:
    """If MT5 already closed a desk ticket, mark the card filled. Do not wait for Yahoo."""
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict) or not isinstance(data.get("signals"), list):
        return
    for row in data["signals"]:
        if row.get("status") != "active":
            continue
        mt5row = row.get("mt5") if isinstance(row.get("mt5"), dict) else {}
        if mt5row.get("status") != "sent":
            continue
        sid = str(row.get("id") or "")
        ticket = int(mt5row.get("ticket") or 0)
        orders, positions = matching_entities(sid, {"ticket": ticket, "signalId": sid})
        if orders or positions:
            continue
        kind, price = history_exit(
            sid,
            ticket,
            float(row.get("stopLoss") or 0),
            float(row.get("takeProfit") or 0),
            str(row.get("publishedAt") or ""),
        )
        if kind and price:
            notify_desk_fill(sid, price, kind)


def notify_desk_sl(signal_id: str, new_sl: float, reason: str) -> None:
    """Push a level revision so premium cards show the new SL immediately."""
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict) or not isinstance(data.get("signals"), list):
        return
    now = now_iso()
    found = False
    for row in data["signals"]:
        if row.get("id") != signal_id or row.get("status") != "active":
            continue
        last = (row.get("levelRevisions") or [None])[-1]
        if isinstance(last, dict) and last.get("reason") == reason:
            return
        revs = list(row.get("levelRevisions") or [])
        if not revs:
            revs.append(
                {
                    "stopLoss": row.get("stopLoss"),
                    "takeProfit": row.get("takeProfit"),
                    "at": row.get("publishedAt") or now,
                }
            )
        revs.append(
            {
                "stopLoss": float(new_sl),
                "takeProfit": row.get("takeProfit"),
                "at": now,
                "reason": reason,
            }
        )
        row["stopLoss"] = float(new_sl)
        row["levelRevisions"] = revs
        row["updatedAt"] = now
        if reason == "lock1r":
            row["halfTaken"] = True
        found = True
        break
    if found:
        write_json(SIGNALS_PATH, data)
        print(f"Premium notice: {signal_id} SL → {new_sl} ({reason})")


def drop_trails_for_signal(signal_id: str) -> None:
    store = load_trails()
    next_rows = [t for t in store["trails"] if t.get("signalId") != signal_id]
    if len(next_rows) != len(store["trails"]):
        store["trails"] = next_rows
        save_trails(store)


def _sltp(pos, sl: float, tp: float):
    return mt5.order_send(
        {
            "action": mt5.TRADE_ACTION_SLTP,
            "position": int(pos.ticket),
            "symbol": pos.symbol,
            "sl": float(sl),
            "tp": float(tp),
            "magic": int(pos.magic or 0),
        }
    )


def position_sl(ticket: int) -> float | None:
    rows = mt5.positions_get(ticket=ticket)
    if not rows:
        return None
    return float(rows[0].sl)


def set_position_sl(pos, new_sl: float) -> tuple[bool, str]:
    info = mt5.symbol_info(pos.symbol)
    if info is None:
        return False, "no symbol info"
    digits = int(info.digits)
    point = float(info.point)
    sl = round(float(new_sl), digits)
    current = float(pos.sl or 0)
    if abs(current - sl) <= point:
        return True, "already at that SL"
    result = _sltp(pos, sl, pos.tp)
    if result and result.retcode in (mt5.TRADE_RETCODE_DONE, 10025):
        live = position_sl(int(pos.ticket))
        if live is None or abs(live - sl) <= point * 2:
            return True, f"sl={sl}"
    stops = int(getattr(info, "trade_stops_level", 0) or 0) * point
    if stops > 0:
        nudged = round(sl + stops, digits) if pos.type == mt5.POSITION_TYPE_BUY else round(sl - stops, digits)
        result = _sltp(pos, nudged, pos.tp)
        if result and result.retcode in (mt5.TRADE_RETCODE_DONE, 10025):
            return True, f"sl={nudged} (stops level)"
    err = mt5.last_error()
    comment = result.comment if result is not None else err
    code = result.retcode if result is not None else "?"
    return False, f"{code} {comment}"


def close_half_position(pos) -> tuple[bool, str]:
    """Market-close half the lot. Skip if the remainder would be below min lot."""
    info = mt5.symbol_info(pos.symbol)
    tick = mt5.symbol_info_tick(pos.symbol)
    if info is None or tick is None:
        return False, "no quote to close half"
    step = float(info.volume_step or 0.01)
    vmin = float(info.volume_min or step)
    vol = float(pos.volume)
    half = round(int((vol / 2.0) / step + 1e-12) * step, 8)
    remain = round(vol - half, 8)
    if half + 1e-12 < vmin or remain + 1e-12 < vmin:
        return False, "lot too small to split"
    close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
    price = tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask
    result = send_request(
        {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": half,
            "type": close_type,
            "position": int(pos.ticket),
            "price": price,
            "deviation": 40,
            "magic": int(pos.magic or 0),
            "comment": "fx:half2r",
        },
        filling_modes(info),
    )
    if result and result.retcode == mt5.TRADE_RETCODE_DONE:
        return True, f"closed {half:g} of {vol:g}"
    err = result.comment if result is not None else mt5.last_error()
    code = result.retcode if result is not None else "?"
    return False, f"{code} {err}"


def refresh_position(signal_id: str, trail: dict, ticket: int):
    _orders, positions = matching_entities(signal_id, trail)
    if positions:
        return positions[0]
    rows = mt5.positions_get(ticket=ticket) or []
    return rows[0] if rows else None


def excursion(symbol: str, since_iso: str | None = None) -> tuple[float | None, float | None]:
    """High/low only after `since_iso` (fill time). Older wicks do not count."""
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 240)
    tick = mt5.symbol_info_tick(symbol)
    if rates is None or len(rates) == 0:
        if tick is None:
            return None, None
        return float(tick.bid), float(tick.ask)
    since = 0.0
    if since_iso:
        try:
            since = datetime.fromisoformat(since_iso.replace("Z", "+00:00")).timestamp()
        except Exception:
            since = 0.0
    highs = []
    lows = []
    for row in rates:
        if since and float(row["time"]) + 60 < since:
            continue
        highs.append(float(row["high"]))
        lows.append(float(row["low"]))
    if tick is not None:
        highs.append(float(tick.bid or tick.ask))
        lows.append(float(tick.ask or tick.bid))
    if not highs:
        return None, None
    return max(highs), min(lows)


def tick_prints(tick, level: float, buy: bool) -> bool:
    """True the moment bid, ask, or last prints the level. No hold."""
    bid = float(tick.bid or 0)
    ask = float(tick.ask or 0)
    last = float(getattr(tick, "last", 0) or 0)
    if buy:
        return bid >= level or ask >= level or last >= level
    if bid and bid <= level:
        return True
    if ask and ask <= level:
        return True
    return bool(last) and last <= level


def watch_sleep() -> float:
    store = load_trails()
    if store.get("trails"):
        return 0.35
    return 1.5


def manage_trails() -> None:
    """After fill: 1R → SL to entry. 2R → close half and SL to 1R. Rest runs to TP.
    Close only if price later comes back to the new SL (broker SL), not from old bars."""
    store = load_trails()
    if not store["trails"]:
        return
    kept = []
    dirty = False
    for trail in store["trails"]:
        if trail.get("virtual"):
            kept.append(trail)
            continue
        orders, positions = matching_entities(trail["signalId"], trail)
        pos = positions[0] if positions else None
        if pos is None:
            if orders:
                kept.append(trail)
                continue
            stage_now = int(trail.get("stage") or 0)
            se = float(trail.get("signalEntry") or trail.get("entry") or 0)
            risk = float(trail.get("risk") or 0)
            buy = str(trail.get("side") or "") == "buy"
            cur_sl = float(trail.get("originalSL") or 0)
            if stage_now >= 1 and se:
                cur_sl = float(trail.get("beSl") or se)
            if stage_now >= 2 and se and risk:
                cur_sl = se + risk if buy else se - risk
            kind, price = history_exit(
                str(trail.get("signalId") or ""),
                int(trail.get("ticket") or 0),
                cur_sl,
                float(trail.get("originalTP") or 0),
                str(trail.get("filledAt") or trail.get("createdAt") or ""),
            )
            if kind and price:
                notify_desk_fill(str(trail.get("signalId") or ""), price, kind)
                dirty = True
                continue
            kept.append(trail)
            continue
        if trail.get("pending") or trail.get("ticket") != pos.ticket:
            dirty = True
        was_pending = bool(trail.get("pending"))
        if was_pending or not trail.get("filledAt"):
            if not trail.get("filledAt"):
                trail["filledAt"] = now_iso()
            notify_desk_entered(str(trail.get("signalId") or ""), int(pos.ticket))
        trail["pending"] = False
        trail["ticket"] = int(pos.ticket)
        attach_open_commission(str(trail.get("signalId") or ""), int(pos.ticket))
        signal_entry = float(trail.get("signalEntry") or trail.get("entry") or 0)
        fill = float(pos.price_open or signal_entry)
        risk = float(trail.get("risk") or 0)
        if risk <= 0:
            risk = abs(signal_entry - float(trail["originalSL"]))
            trail["risk"] = risk
        if risk <= 0:
            kept.append(trail)
            continue
        tick = mt5.symbol_info_tick(pos.symbol)
        if tick is None:
            kept.append(trail)
            continue
        buy = pos.type == mt5.POSITION_TYPE_BUY
        info = mt5.symbol_info(pos.symbol)
        point = float(info.point) if info else 0.001
        stops = int(getattr(info, "trade_stops_level", 0) or 0) * point if info else 0.0
        # 1R from the card entry (what the desk published) and from the fill.
        r1_card = signal_entry + risk if buy else signal_entry - risk
        r1_fill = fill + risk if buy else fill - risk
        r1 = r1_card
        r2 = signal_entry + 2 * risk if buy else signal_entry - 2 * risk
        hit_1r_now = tick_prints(tick, r1_card, buy) or tick_prints(tick, r1_fill, buy)
        hit_2r_now = tick_prints(tick, r2, buy)
        stage = int(trail.get("stage") or 0)
        be, be_note = commission_be_sl(pos, signal_entry if signal_entry > 0 else fill, trail)

        def sl_still_safe(new_sl: float, live) -> bool:
            pad = max(point * 10, stops, 0.0)
            if buy:
                return float(live.bid) > float(new_sl) + pad
            return float(live.ask) < float(new_sl) - pad

        # First live print of 2R — no hold. Same loop: half off, SL to 1R.
        if stage < 2 and hit_2r_now:
            lock = r1
            if sl_still_safe(lock, tick):
                notes = []
                if not trail.get("halfTaken"):
                    closed, half_detail = close_half_position(pos)
                    if closed:
                        trail["halfTaken"] = True
                        notes.append(half_detail)
                        dirty = True
                        nxt = refresh_position(str(trail.get("signalId") or ""), trail, int(pos.ticket))
                        if nxt is None:
                            trail["stage"] = 2
                            trail["lastError"] = ""
                            log(
                                f"Trail 1:2 → half close finished the book on {pos.symbol} #{pos.ticket} ({half_detail})"
                            )
                            notify_desk_sl(trail["signalId"], lock, "lock1r")
                            kept.append(trail)
                            continue
                        pos = nxt
                    elif "too small to split" in half_detail:
                        trail["halfTaken"] = True
                        notes.append(half_detail)
                        dirty = True
                    else:
                        trail["lastError"] = half_detail
                        dirty = True
                        log(f"Trail 1:2 half-close failed on {pos.symbol} #{pos.ticket}: {half_detail}")
                ok, detail = set_position_sl(pos, lock)
                extra = f", {'; '.join(notes)}" if notes else ""
                if ok:
                    trail["stage"] = 2
                    stage = 2
                    trail["lastError"] = ""
                    dirty = True
                    log(
                        f"Trail 1:2 → half off then SL to 1:1 {lock} on {pos.symbol} #{pos.ticket} ({detail}{extra})"
                    )
                    notify_desk_sl(trail["signalId"], lock, "lock1r")
                else:
                    trail["lastError"] = detail
                    dirty = True
                    log(f"Trail 1:2 SL lock failed on {pos.symbol} #{pos.ticket}: {detail}{extra}")
            elif not trail.get("unsafe2rLogged"):
                trail["unsafe2rLogged"] = True
                dirty = True
                log(
                    f"Trail 1:2 skipped — 2R printed but new SL {lock} is through live price on {pos.symbol} #{pos.ticket}"
                )

        if stage < 1 and hit_1r_now:
            if not sl_still_safe(be, tick):
                kept.append(trail)
                continue
            ok, detail = set_position_sl(pos, be)
            if ok:
                trail["stage"] = 1
                trail["beSl"] = be
                stage = 1
                trail["lastError"] = ""
                dirty = True
                log(
                    f"Trail 1:1 → SL to break-even {be} on {pos.symbol} #{pos.ticket} ({detail}; {be_note})"
                )
                notify_desk_sl(trail["signalId"], be, "be")
            else:
                trail["lastError"] = detail
                dirty = True
                log(f"Trail 1:1 failed on {pos.symbol} #{pos.ticket}: {detail}")

        kept.append(trail)
    if dirty or len(kept) != len(store["trails"]):
        store["trails"] = kept
        save_trails(store)


def matching_entities(signal_id: str, trail: dict | None = None):
    tag = comment_for(signal_id)
    short = signal_id[:12]
    want_ticket = int((trail or {}).get("ticket") or 0)
    want_symbol = str((trail or {}).get("symbol") or "")

    def is_ours(row) -> bool:
        comment = str(row.comment or "")
        if tag in comment or short in comment:
            return True
        if want_ticket and int(row.ticket) == want_ticket:
            return True
        ident = int(getattr(row, "identifier", 0) or 0)
        if want_ticket and ident == want_ticket:
            return True
        return False

    orders = [o for o in (mt5.orders_get() or []) if is_ours(o)]
    positions = [p for p in (mt5.positions_get() or []) if is_ours(p)]
    if not positions and want_ticket:
        by_ticket = mt5.positions_get(ticket=want_ticket)
        if by_ticket:
            positions = list(by_ticket)
    if not positions and want_symbol:
        for p in mt5.positions_get(symbol=want_symbol) or []:
            if is_ours(p) or (want_ticket and int(getattr(p, "identifier", 0) or 0) == want_ticket):
                positions.append(p)
    return orders, positions


def modify_trade(job: dict, cfg: dict) -> tuple[str, int | None, str]:
    orders, positions = matching_entities(job["signalId"])
    if not orders and not positions:
        return "skipped", None, "no matching MT5 order or position"
    changed = 0
    last_ticket = None
    for order in orders:
        info = mt5.symbol_info(order.symbol)
        digits = int(info.digits) if info else 5
        result = mt5.order_send(
            {
                "action": mt5.TRADE_ACTION_MODIFY,
                "order": order.ticket,
                "price": order.price_open,
                "sl": round(float(job["stopLoss"]), digits),
                "tp": round(float(job["takeProfit"]), digits),
                "type_time": mt5.ORDER_TIME_GTC,
            }
        )
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            changed += 1
            last_ticket = order.ticket
    for pos in positions:
        info = mt5.symbol_info(pos.symbol)
        digits = int(info.digits) if info else 5
        result = mt5.order_send(
            {
                "action": mt5.TRADE_ACTION_SLTP,
                "position": pos.ticket,
                "symbol": pos.symbol,
                "sl": round(float(job["stopLoss"]), digits),
                "tp": round(float(job["takeProfit"]), digits),
            }
        )
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            changed += 1
            last_ticket = pos.ticket
    if changed:
        return "sent", last_ticket, f"updated SL/TP on {changed} order(s)"
    return "error", None, f"modify failed: {mt5.last_error()}"


def cancel_trade(job: dict, cfg: dict) -> tuple[str, int | None, str]:
    signal_id = job["signalId"]
    magic = cfg["magic"]
    removed = 0
    wanted = {int(t.get("ticket") or 0) for t in load_trails().get("trails") or [] if t.get("signalId") == signal_id}
    wanted.discard(0)
    for order in mt5.orders_get() or []:
        comment = str(order.comment or "")
        ours = (
            comment_for(signal_id) in comment
            or signal_id[:12] in comment
            or int(order.ticket) in wanted
        )
        if not ours:
            continue
        result = mt5.order_send({"action": mt5.TRADE_ACTION_REMOVE, "order": order.ticket})
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            removed += 1
    closed = 0
    for pos in mt5.positions_get() or []:
        comment = str(pos.comment or "")
        ident = int(getattr(pos, "identifier", 0) or 0)
        ours = (
            comment_for(signal_id) in comment
            or signal_id[:12] in comment
            or int(pos.ticket) in wanted
            or ident in wanted
        )
        if not ours:
            continue
        tick = mt5.symbol_info_tick(pos.symbol)
        info = mt5.symbol_info(pos.symbol)
        if tick is None or info is None:
            continue
        close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
        price = tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask
        result = send_request(
            {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": pos.symbol,
                "volume": pos.volume,
                "type": close_type,
                "position": pos.ticket,
                "price": price,
                "deviation": cfg["deviation"],
                "magic": magic,
                "comment": "fx:close",
            },
            filling_modes(info),
        )
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            closed += 1
    if removed or closed:
        drop_trails_for_signal(signal_id)
        return "sent", None, f"removed {removed} pending, closed {closed} position(s)"
    return "skipped", None, "no matching MT5 order or position"


def stamp_signal_mt5(signal_id: str, status: str, message: str, ticket: int | None) -> None:
    if not signal_id:
        return
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict) or not isinstance(data.get("signals"), list):
        return
    found = False
    for row in data["signals"]:
        if row.get("id") != signal_id:
            continue
        prev = row.get("mt5") if isinstance(row.get("mt5"), dict) else {}
        payload = {**prev, "status": status, "message": message, "at": now_iso()}
        if ticket:
            payload["ticket"] = ticket
        row["mt5"] = payload
        found = True
        break
    if found:
        write_json(SIGNALS_PATH, data)


def process_job(job: dict, cfg: dict) -> dict:
    try:
        action = job.get("action") or "open"
        if action == "cancel":
            status, ticket, message = cancel_trade(job, cfg)
        elif action == "modify":
            status, ticket, message = modify_trade(job, cfg)
        else:
            status, ticket, message = open_trade(job, cfg)
    except Exception as exc:
        status, ticket, message = "error", None, str(exc)
        traceback.print_exc()
    job["status"] = status
    job["message"] = message
    job["doneAt"] = now_iso()
    if ticket:
        job["ticket"] = ticket
    stamp_signal_mt5(str(job.get("signalId") or ""), status, message, ticket)
    log(f"[{status}] {job['action']} {job.get('pair', '')} {job.get('side', '')} {message}")
    return job


def our_book_open(cfg: dict) -> bool:
    magic = int(cfg.get("magic") or 0)
    for order in mt5.orders_get() or []:
        comment = str(order.comment or "")
        if order.magic == magic or comment.startswith("fx:"):
            return True
    for pos in mt5.positions_get() or []:
        comment = str(pos.comment or "")
        if pos.magic == magic or comment.startswith("fx:"):
            return True
    return False


def desk_has_live_tickets() -> bool:
    data = read_json(SIGNALS_PATH, None)
    if not isinstance(data, dict):
        return False
    for row in data.get("signals") or []:
        if row.get("status") == "active":
            return True
    return False


def desk_still_busy(enabled: list[dict], connected_cfg: dict | None) -> bool:
    queue = load_queue()
    if any(j.get("status") == "queued" for j in queue.get("jobs") or []):
        return True
    if load_trails().get("trails"):
        return True
    if connected_cfg and our_book_open(connected_cfg):
        return True
    if desk_has_live_tickets():
        return True
    return False


def account_for_job(job: dict, accounts: list[dict]) -> dict | None:
    wanted = str(job.get("accountId") or "")
    if wanted:
        match = next((a for a in accounts if a["id"] == wanted), None)
        if match:
            return match
    enabled = [a for a in accounts if a["enabled"]]
    return enabled[0] if enabled else None


def main() -> int:
    if another_instance_running():
        log("Executor already running — this copy will exit.")
        return 0
    load_dotenv()
    write_pid()
    atexit.register(clear_pid)
    log("Executor started")
    log(f"Queue: {QUEUE_PATH}")
    DATA.mkdir(parents=True, exist_ok=True)
    heartbeat("Executor started")
    last_idle_key = ""
    idle_account = 0
    quiet_since = time.time()
    while True:
        heartbeat()
        accounts = load_accounts()
        enabled = [a for a in accounts if a["enabled"]]
        if not enabled:
            write_status([], "Executor is running, but no MT5 account is enabled.")
            last_idle_key = ""
            if time.time() - quiet_since >= IDLE_EXIT_SECONDS:
                log("No enabled account and nothing to do — stopping.")
                return 0
            time.sleep(2)
            continue
        queue = load_queue()
        pending = [j for j in queue["jobs"] if j.get("status") == "queued"]
        statuses = []
        dirty = False
        if not pending:
            cfg = enabled[idle_account % len(enabled)]
            first = connect(cfg)
            idle_account += 1
            statuses.append(first)
            idle_key = f"{first.get('login')}|{first.get('server')}|{first.get('connected')}"
            if first.get("connected") and idle_key != last_idle_key:
                log(f"Watching {first.get('login')} @ {first.get('server')}")
                last_idle_key = idle_key
            elif not first.get("connected") and idle_key != last_idle_key:
                log(f"Waiting for MT5: {first.get('message')}")
                last_idle_key = idle_key
            if first.get("connected"):
                try:
                    write_live_quotes()
                except Exception as exc:
                    log(f"quotes: {exc}")
                try:
                    write_master_pnl(cfg)
                except Exception as exc:
                    log(f"pnl: {exc}")
                try:
                    manage_pending_invalidation()
                    manage_virtual_trails()
                    manage_trails()
                    reconcile_closed_signals()
                except Exception as exc:
                    log(f"manage: {exc}")
                    traceback.print_exc()
            write_status(statuses, "Watching open trades" if first.get("connected") else first.get("message") or "Waiting for MT5")
            if desk_still_busy(enabled, cfg if first.get("connected") else None):
                quiet_since = time.time()
            elif time.time() - quiet_since >= IDLE_EXIT_SECONDS:
                log("No running trades or pending orders — stopping executor.")
                write_status([], "Executor stopped — book is flat.")
                mt5.shutdown()
                return 0
            time.sleep(watch_sleep())
            continue
        by_account: dict[str, list] = {}
        leftover = []
        for job in pending:
            acc = account_for_job(job, enabled)
            if not acc:
                job["status"] = "skipped"
                job["message"] = "no enabled MT5 account for this job"
                job["doneAt"] = now_iso()
                stamp_signal_mt5(str(job.get("signalId") or ""), "skipped", job["message"], None)
                dirty = True
                leftover.append(job)
                continue
            by_account.setdefault(acc["id"], []).append(job)
        for acc in enabled:
            jobs = by_account.get(acc["id"]) or []
            if not jobs:
                continue
            status = connect(acc)
            statuses.append(status)
            if not status.get("connected"):
                log(f"Waiting to send {len(jobs)} job(s) on {acc['label']}: {status['message']}")
                continue
            last_idle_key = ""
            quiet_since = time.time()
            log(f"Connected: {status.get('login')} @ {status.get('server')}  {status.get('balance')}")
            for job in jobs:
                process_job(job, acc)
                dirty = True
            try:
                write_live_quotes()
            except Exception as exc:
                log(f"quotes: {exc}")
            try:
                write_master_pnl(acc)
            except Exception as exc:
                log(f"pnl: {exc}")
            try:
                manage_pending_invalidation()
                manage_virtual_trails()
                manage_trails()
                reconcile_closed_signals()
            except Exception as exc:
                log(f"manage: {exc}")
                traceback.print_exc()
        if leftover:
            statuses.append({"id": "unassigned", "ok": False, "connected": False, "message": "jobs with no account"})
        if dirty:
            save_queue(queue)
        write_status(statuses or [{"id": "none", "ok": False, "connected": False, "message": "idle"}], "Watching the desk queue")
        time.sleep(watch_sleep() if load_trails().get("trails") else 1.2)


def pnl_once() -> int:
    cfg = master_cfg()
    if not cfg:
        print("No enabled master account.")
        return 1
    status = connect(cfg)
    if not status.get("connected"):
        print(status.get("message") or "Could not connect")
        return 1
    write_master_pnl(cfg)
    print("Wrote", PNL_PATH)
    mt5.shutdown()
    return 0


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--pnl-once":
            raise SystemExit(pnl_once())
        raise SystemExit(main())
    except KeyboardInterrupt:
        mt5.shutdown()
        print("Stopped.")
        raise SystemExit(0)
