from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "src-tauri" / "icons"
PUBLIC_DIR = ROOT / "public"


def gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (1, size))
    pixels = image.load()
    for y in range(size):
        ratio = y / max(1, size - 1)
        pixels[0, y] = tuple(round(top[i] * (1 - ratio) + bottom[i] * ratio) for i in range(3))
    return image.resize((size, size))


def make_icon(size: int = 2048) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    radius = int(size * 0.22)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)

    background = gradient(size, (192, 103, 62), (118, 52, 29))
    canvas.paste(background, (0, 0), mask)

    draw = ImageDraw.Draw(canvas)
    inset = int(size * 0.035)
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=radius - inset // 2,
        outline=(255, 246, 233, 46),
        width=max(2, size // 320),
    )

    # A quiet open book, drawn with a warm paper tone.
    left = [
        (size * 0.21, size * 0.35),
        (size * 0.47, size * 0.29),
        (size * 0.47, size * 0.72),
        (size * 0.21, size * 0.78),
    ]
    right = [
        (size * 0.53, size * 0.29),
        (size * 0.79, size * 0.35),
        (size * 0.79, size * 0.78),
        (size * 0.53, size * 0.72),
    ]
    draw.polygon(left, fill=(255, 246, 233, 244))
    draw.polygon(right, fill=(255, 246, 233, 232))

    # A soft shadow under the pages.
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.polygon(left, fill=(52, 20, 10, 90))
    shadow_draw.polygon(right, fill=(52, 20, 10, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.018))
    canvas.alpha_composite(shadow, (0, int(size * 0.018)))

    draw = ImageDraw.Draw(canvas)
    draw.polygon(left, fill=(255, 246, 233, 244))
    draw.polygon(right, fill=(255, 246, 233, 232))
    draw.line(
        [(size * 0.5, size * 0.3), (size * 0.5, size * 0.73)],
        fill=(164, 82, 45, 160),
        width=max(2, size // 300),
    )

    for index in range(4):
        y = size * (0.40 + index * 0.075)
        draw.line(
            [(size * 0.255, y), (size * 0.435, y - size * 0.012)],
            fill=(164, 82, 45, 95),
            width=max(1, size // 620),
        )
        draw.line(
            [(size * 0.565, y - size * 0.012), (size * 0.745, y)],
            fill=(164, 82, 45, 95),
            width=max(1, size // 620),
        )

    # Bookmark ribbon.
    draw.polygon(
        [
            (size * 0.445, size * 0.285),
            (size * 0.505, size * 0.275),
            (size * 0.505, size * 0.46),
            (size * 0.475, size * 0.43),
            (size * 0.445, size * 0.46),
        ],
        fill=(164, 82, 45, 230),
    )

    return canvas


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    base = make_icon()

    outputs = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }
    for name, size in outputs.items():
        base.resize((size, size), Image.Resampling.LANCZOS).save(ICON_DIR / name)

    base.resize((256, 256), Image.Resampling.LANCZOS).save(PUBLIC_DIR / "favicon.png")
    base.save(
        ICON_DIR / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    preview = base.resize((512, 512), Image.Resampling.LANCZOS)
    preview.save(ROOT / "icon-preview.png")
    print(f"Wrote icons to {ICON_DIR}")


if __name__ == "__main__":
    main()
