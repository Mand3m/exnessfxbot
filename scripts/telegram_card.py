"""Foresignal-style pair cards for Telegram posts: overlapping circular flags."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "og"
FLAG_DIR = OUT_DIR / "flags"

PAIRS = {
    "USDJPY": {"label": "USD/JPY", "base": "us", "quote": "jp"},
    "XAUUSD": {"label": "XAU/USD", "base": "gold", "quote": "us"},
    "GBPJPY": {"label": "GBP/JPY", "base": "gb", "quote": "jp"},
    "EURUSD": {"label": "EUR/USD", "base": "eu", "quote": "us"},
}

FLAG_URL = {
    "us": "https://flagcdn.com/w640/us.png",
    "jp": "https://flagcdn.com/w640/jp.png",
    "gb": "https://flagcdn.com/w640/gb.png",
    "eu": "https://flagcdn.com/w640/eu.png",
}

W, H = 1200, 400
SCALE = 2
SW, SH = W * SCALE, H * SCALE


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    size *= SCALE
    names = (
        ("segoeuib.ttf", "arialbd.ttf", "calibrib.ttf")
        if bold
        else ("segoeui.ttf", "arial.ttf", "calibri.ttf")
    )
    for name in names:
        path = Path(r"C:\Windows\Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def _download(code: str) -> Path | None:
    url = FLAG_URL.get(code)
    if not url:
        return None
    FLAG_DIR.mkdir(parents=True, exist_ok=True)
    dest = FLAG_DIR / f"{code}.png"
    if dest.exists() and dest.stat().st_size > 100:
        return dest
    try:
        import urllib.request

        req = urllib.request.Request(url, headers={"User-Agent": "ExnessfxBot/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            dest.write_bytes(resp.read())
        return dest
    except Exception:
        return dest if dest.exists() else None


def _circle_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    return mask.filter(ImageFilter.SMOOTH)


def _gold_badge(size: int) -> Image.Image:
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, size - 1, size - 1), fill=(212, 168, 40, 255))
    inset = int(size * 0.07)
    d.ellipse((inset, inset, size - 1 - inset, size - 1 - inset), fill=(236, 201, 72, 255))
    cx, cy = size / 2, size / 2 + size * 0.02
    top_w, bot_w, h = size * 0.36, size * 0.5, size * 0.24
    ingot = [
        (cx - top_w / 2, cy - h / 2),
        (cx + top_w / 2, cy - h / 2),
        (cx + bot_w / 2, cy + h / 2),
        (cx - bot_w / 2, cy + h / 2),
    ]
    d.polygon(ingot, fill=(250, 224, 110, 255))
    d.line([ingot[0], ingot[1]], fill=(186, 142, 28, 255), width=max(2, size // 80))
    ridge = cy - h / 6
    d.line(
        [(cx - top_w / 2 + size * 0.04, ridge), (cx + top_w / 2 - size * 0.04, ridge)],
        fill=(201, 162, 39, 255),
        width=max(2, size // 90),
    )
    return im


def _flag_circle(code: str, size: int) -> Image.Image:
    if code == "gold":
        inner = _gold_badge(size)
    else:
        path = _download(code)
        if path and path.exists():
            src = Image.open(path).convert("RGBA")
            src = src.resize((size, size), Image.Resampling.LANCZOS)
            inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            inner.paste(src, (0, 0), _circle_mask(size))
        else:
            inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            ImageDraw.Draw(inner).ellipse((0, 0, size - 1, size - 1), fill=(90, 110, 140, 255))

    ring = max(6, size // 22)
    outer = size + ring * 2
    badge = Image.new("RGBA", (outer, outer), (0, 0, 0, 0))
    ImageDraw.Draw(badge).ellipse((0, 0, outer - 1, outer - 1), fill=(255, 255, 255, 255))
    badge.paste(inner, (ring, ring), inner)
    shadow = Image.new("RGBA", (outer + 16, outer + 16), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((8, 10, 8 + outer - 1, 12 + outer - 1), fill=(0, 0, 0, 50))
    shadow = shadow.filter(ImageFilter.GaussianBlur(6))
    out = Image.new("RGBA", (outer + 16, outer + 16), (0, 0, 0, 0))
    out.alpha_composite(shadow, (0, 0))
    out.alpha_composite(badge, (8, 6))
    return out


def render_pair_card(pair_id: str) -> Path:
    meta = PAIRS.get(pair_id) or {"label": pair_id, "base": "us", "quote": "us"}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / f"{pair_id}.png"

    canvas = Image.new("RGB", (SW, SH), (220, 231, 240))
    draw = ImageDraw.Draw(canvas)

    title_font = _font(46, bold=True)
    sub_font = _font(36, bold=False)
    title = "Free Forex Signals"
    sub = f"{meta['label']} Forex signal"
    draw.text((72 * SCALE, 118 * SCALE), title, font=title_font, fill=(46, 130, 196))
    draw.text((72 * SCALE, 188 * SCALE), sub, font=sub_font, fill=(92, 104, 118))

    diameter = int(210 * SCALE)
    quote = _flag_circle(str(meta["quote"]), diameter)
    base = _flag_circle(str(meta["base"]), diameter)
    qy = (SH - quote.height) // 2
    by = (SH - base.height) // 2
    qx = SW - quote.width - int(48 * SCALE)
    bx = qx - int(diameter * 0.42)
    canvas.paste(quote, (qx, qy), quote)
    canvas.paste(base, (bx, by), base)

    card = canvas.resize((W, H), Image.Resampling.LANCZOS)
    card.save(dest, "PNG", optimize=True)
    return dest


def card_path(pair_id: str) -> Path:
    dest = OUT_DIR / f"{pair_id}.png"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    return render_pair_card(pair_id)


def render_all() -> list[Path]:
    return [render_pair_card(pid) for pid in PAIRS]


if __name__ == "__main__":
    for path in render_all():
        print(path)
