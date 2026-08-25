"""
Draw public/og/flags/eu.png for the EUR/USD card badge.

The euro has no flag of its own, so FX boards use the European Union flag.
Geometry follows the official specification, measured against flag height H:
  - field  Pantone Reflex Blue  #003399
  - stars  Pantone Yellow       #FFCC00
  - 12 stars, centres on a circle of radius H/3
  - each star inscribed in a circle of radius H/18, one point straight up
  - 12 is fixed and symbolic; it is not a count of member states

Rendered square rather than the official 3:2, because both consumers show it
inside a circular badge: the web card crops with object-cover, and
telegram_card.py resizes to a square before masking. A 3:2 source would come
out with the star ring squashed into an ellipse there.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "og" / "flags" / "eu.png"

SIZE = 320
SS = 8  # supersample factor, downsampled with LANCZOS for clean star edges
BLUE = (0, 51, 153, 255)
GOLD = (255, 204, 0, 255)

# regular pentagram: inner radius / outer radius
INNER_RATIO = math.cos(math.radians(72)) / math.cos(math.radians(36))


def star_points(cx: float, cy: float, r: float) -> list[tuple[float, float]]:
    """Five-pointed star centred at (cx, cy), one point straight up."""
    pts = []
    for i in range(10):
        radius = r if i % 2 == 0 else r * INNER_RATIO
        angle = math.radians(-90 + i * 36)
        pts.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return pts


def render(size: int = SIZE) -> Path:
    big = size * SS
    im = Image.new("RGBA", (big, big), BLUE)
    draw = ImageDraw.Draw(im)

    centre = big / 2
    ring = big / 3          # radius of the circle the star centres sit on
    star_r = big / 18       # radius of each star's circumscribed circle

    for hour in range(12):
        angle = math.radians(hour * 30 - 90)  # 12 o'clock first, then clockwise
        cx = centre + ring * math.cos(angle)
        cy = centre + ring * math.sin(angle)
        draw.polygon(star_points(cx, cy, star_r), fill=GOLD)

    flag = im.resize((size, size), Image.Resampling.LANCZOS)
    DEST.parent.mkdir(parents=True, exist_ok=True)
    flag.convert("RGB").save(DEST, "PNG", optimize=True)
    return DEST


if __name__ == "__main__":
    print(render())
