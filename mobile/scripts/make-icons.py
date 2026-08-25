"""Build launcher and splash images from the site logo."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / "public" / "logo.jpg"
RES = Path(__file__).resolve().parents[1] / "android" / "app" / "src" / "main" / "res"

DENSITIES = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}


def cover(src: Image.Image, size: int) -> Image.Image:
    img = src.convert("RGBA")
    ratio = max(size / img.width, size / img.height)
    resized = img.resize((max(1, round(img.width * ratio)), max(1, round(img.height * ratio))), Image.Resampling.LANCZOS)
    left = (resized.width - size) // 2
    top = (resized.height - size) // 2
    return resized.crop((left, top, left + size, top + size))


def circle(src: Image.Image) -> Image.Image:
    size = src.size[0]
    mask = Image.new("L", (size, size), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out


def splash(src: Image.Image, width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    mark = cover(src, min(width, height) // 3)
    x = (width - mark.width) // 2
    y = (height - mark.height) // 2
    canvas.paste(mark, (x, y), mark)
    return canvas


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def main() -> None:
    if not LOGO.exists():
        raise SystemExit(f"missing logo: {LOGO}")
    src = Image.open(LOGO)
    for name, scale in DENSITIES.items():
        icon = cover(src, round(48 * scale))
        folder = RES / f"mipmap-{name}"
        save_png(icon, folder / "ic_launcher.png")
        save_png(circle(icon), folder / "ic_launcher_round.png")
        save_png(cover(src, round(108 * scale)), folder / "ic_launcher_foreground.png")

        port = splash(src, round(320 * scale), round(480 * scale))
        land = splash(src, round(480 * scale), round(320 * scale))
        save_png(port, RES / f"drawable-port-{name}" / "splash.png")
        save_png(land, RES / f"drawable-land-{name}" / "splash.png")

    save_png(splash(src, 1280, 1920), RES / "drawable" / "splash.png")
    print("icons written under", RES)


if __name__ == "__main__":
    main()
