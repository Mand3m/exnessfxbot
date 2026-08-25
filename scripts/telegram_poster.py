"""Post due ExnessfxBot signals to the free Telegram channel after the 10-minute delay."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from telegram_card import card_path  # noqa: E402

DATA = ROOT / "data"
QUEUE_PATH = DATA / "telegram-queue.json"
SIGNALS_PATH = DATA / "signals.json"
PID_PATH = DATA / "telegram-poster.pid"
LOG_PATH = DATA / "telegram-poster.log"
IDLE_EXIT_SECONDS = 45


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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str) -> None:
    line = f"{datetime.now().strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    if sys.stdout.isatty():
        try:
            LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with LOG_PATH.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
        except Exception:
            pass


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
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2), encoding="utf-8")
    tmp.replace(path)


def signal_status(signal_id: str) -> str | None:
    data = read_json(SIGNALS_PATH, {})
    for row in data.get("signals") or []:
        if row.get("id") == signal_id:
            return str(row.get("status") or "")
    return None


PAIR_LABEL = {
    "USDJPY": "USD/JPY",
    "XAUUSD": "XAU/USD",
    "GBPJPY": "GBP/JPY",
    "EURUSD": "EUR/USD",
}

PAIR_DIGITS = {
    "USDJPY": 3,
    "XAUUSD": 2,
    "GBPJPY": 3,
    "EURUSD": 5,
}


def esc(text: str) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def fmt_price(pair: str, value) -> str:
    try:
        return f"{float(value):.{PAIR_DIGITS.get(pair, 3)}f}"
    except Exception:
        return str(value or "")


def level_text(real: str, hidden: bool) -> str:
    if hidden:
        return f"<tg-spoiler>{esc('••••••')}</tg-spoiler>"
    return esc(real)


def format_message(job: dict, hidden: bool = True) -> str:
    pair = str(job.get("pair") or "")
    label = PAIR_LABEL.get(pair, pair)
    created = job.get("createdAt") or ""
    when = ""
    if created:
        try:
            dt = datetime.fromisoformat(str(created).replace("Z", "+00:00")).astimezone(
                timezone(timedelta(hours=3))
            )
            when = dt.strftime("%B %d, %Y at %I:%M %p EAT")
        except Exception:
            when = ""
    site = (os.environ.get("SITE_URL") or os.environ.get("NEXT_PUBLIC_SITE_URL") or "http://localhost:3001").rstrip(
        "/"
    )
    url = f"{site}/signal/{job.get('signalId')}"
    side = "Sell" if str(job.get("side") or "") == "sell" else "Buy"
    entry = fmt_price(pair, job.get("entry"))
    tp = fmt_price(pair, job.get("takeProfit"))
    sl = fmt_price(pair, job.get("stopLoss"))
    lines = [
        f"{esc(label)} Forex signal",
        esc(when) if when else "",
        "",
        level_text(side, hidden),
        f"Entry: {level_text(entry, hidden)}",
        f"Take profit: {level_text(tp, hidden)}",
        f"Stop loss: {level_text(sl, hidden)}",
        "",
        esc(url),
        'WhatsApp: <a href="https://chat.whatsapp.com/JKk0CCbrjayKEFbNAGoEor">chat.whatsapp.com/JKk0CCbrjayKEFbNAGoEor</a>',
        'Facebook: <a href="https://www.facebook.com/profile.php?id=61557381370313">facebook.com/profile.php?id=61557381370313</a>',
    ]
    return "\n".join(line for line in lines if line is not None)


def _post_telegram(path: str, body: bytes, content_type: str) -> tuple[bool, str, int | None]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or ""
    channel = os.environ.get("TELEGRAM_CHANNEL") or "@TradeBossFx"
    if not token:
        return False, "TELEGRAM_BOT_TOKEN is not set", None
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{path}",
        data=body,
        headers={"Content-Type": content_type},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        if not payload.get("ok"):
            return False, str(payload.get("description") or "telegram error"), None
        mid = payload.get("result", {}).get("message_id")
        return True, f"posted to {channel}", int(mid) if mid else None
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            return False, str(payload.get("description") or exc), None
        except Exception:
            return False, str(exc), None
    except Exception as exc:
        return False, str(exc), None


def send_message(text: str) -> tuple[bool, str, int | None]:
    body = json.dumps(
        {
            "chat_id": os.environ.get("TELEGRAM_CHANNEL") or "@TradeBossFx",
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
    ).encode("utf-8")
    return _post_telegram("sendMessage", body, "application/json")


def send_photo(image: Path, caption: str) -> tuple[bool, str, int | None]:
    channel = os.environ.get("TELEGRAM_CHANNEL") or "@TradeBossFx"
    boundary = "----ExnessfxBotTelegram"
    photo = image.read_bytes()
    chunks: list[bytes] = []

    def field(name: str, value: str) -> None:
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        chunks.append(value.encode("utf-8") + b"\r\n")

    field("chat_id", channel)
    field("caption", caption)
    field("parse_mode", "HTML")
    chunks.append(f"--{boundary}\r\n".encode())
    chunks.append(
        f'Content-Disposition: form-data; name="photo"; filename="{image.name}"\r\n'.encode()
    )
    chunks.append(b"Content-Type: image/png\r\n\r\n")
    chunks.append(photo + b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    return _post_telegram("sendPhoto", b"".join(chunks), f"multipart/form-data; boundary={boundary}")


def edit_message(job: dict, caption: str) -> tuple[bool, str]:
    channel = os.environ.get("TELEGRAM_CHANNEL") or "@TradeBossFx"
    mid = job.get("telegramId")
    if not mid:
        return False, "missing telegram id"
    as_text = job.get("postedAs") == "text"
    payload = {
        "chat_id": channel,
        "message_id": int(mid),
        "parse_mode": "HTML",
    }
    if as_text:
        payload["text"] = caption
        payload["disable_web_page_preview"] = True
        path = "editMessageText"
    else:
        payload["caption"] = caption
        path = "editMessageCaption"
    ok, message, _ = _post_telegram(path, json.dumps(payload).encode("utf-8"), "application/json")
    if (not ok) and message and "not modified" in message.lower():
        return True, "already open"
    return ok, message


def send_signal(job: dict) -> tuple[bool, str, int | None, str]:
    caption = format_message(job, hidden=True)
    pair = str(job.get("pair") or "")
    try:
        image = card_path(pair)
        if image.exists():
            ok, message, mid = send_photo(image, caption)
            return ok, message, mid, "photo"
    except Exception as exc:
        log(f"pair card failed ({pair}): {exc}")
    ok, message, mid = send_message(caption)
    return ok, message, mid, "text"


def parse_iso(value: str, fallback: datetime) -> datetime:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return fallback


def main() -> int:
    load_dotenv()
    write_pid()
    log("Telegram poster started")
    quiet_since = time.time()
    try:
        while True:
            queue = read_json(QUEUE_PATH, {"jobs": []})
            jobs = queue.get("jobs") if isinstance(queue, dict) else []
            if not isinstance(jobs, list):
                jobs = []
            now = datetime.now(timezone.utc)
            dirty = False
            pending = False
            for job in jobs:
                status = str(job.get("status") or "")
                reveal_at = parse_iso(str(job.get("revealAt") or ""), now) if job.get("revealAt") else None
                if status in {"queued", "sending"}:
                    pending = True
                if status == "sent" and job.get("telegramId") and reveal_at and reveal_at > now:
                    pending = True
                if status == "sent" and job.get("telegramId") and reveal_at and reveal_at <= now:
                    pending = True
                    ok, message = edit_message(job, format_message(job, hidden=False))
                    if ok:
                        job["status"] = "revealed"
                        job["message"] = message if message.startswith("already") else f"opened on {os.environ.get('TELEGRAM_CHANNEL') or '@TradeBossFx'}"
                        log(f"revealed {job.get('pair')} {job.get('side')}")
                    else:
                        job["message"] = message
                        log(f"reveal-error {job.get('pair')} {message}")
                    dirty = True
                    continue
                if status != "queued":
                    continue
                due_at = parse_iso(str(job.get("dueAt") or ""), now)
                if due_at > now:
                    continue
                already = [
                    j
                    for j in jobs
                    if j.get("signalId") == job.get("signalId")
                    and j.get("id") != job.get("id")
                    and j.get("status") in {"sending", "sent", "revealed"}
                ]
                if already:
                    job["status"] = "skipped"
                    job["message"] = "duplicate signal already posted"
                    dirty = True
                    log(f"skip {job.get('pair')} duplicate")
                    continue
                if signal_status(str(job.get("signalId") or "")) == "cancelled":
                    job["status"] = "skipped"
                    job["message"] = "signal cancelled before the free-channel delay"
                    dirty = True
                    log(f"skip {job.get('pair')} cancelled")
                    continue
                job["status"] = "sending"
                write_json(QUEUE_PATH, {"jobs": jobs[-80:]})
                ok, message, mid, posted_as = send_signal(job)
                job["status"] = "sent" if ok else "error"
                job["message"] = message
                job["postedAs"] = posted_as
                if mid:
                    job["telegramId"] = mid
                dirty = True
                log(f"{job['status']} {job.get('pair')} {job.get('side')} {message}")
            if dirty:
                write_json(QUEUE_PATH, {"jobs": jobs[-80:]})
                quiet_since = time.time()
            if pending:
                quiet_since = time.time()
            elif time.time() - quiet_since >= IDLE_EXIT_SECONDS:
                log("No queued Telegram posts — stopping.")
                return 0
            time.sleep(5)
    finally:
        clear_pid()


if __name__ == "__main__":
    raise SystemExit(main())
