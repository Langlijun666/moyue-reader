from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src-tauri" / "installer"
OUT.mkdir(parents=True, exist_ok=True)

INK = (47, 42, 35)
MUTED = (141, 128, 111)
PAPER = (247, 241, 231)
PAPER_2 = (239, 229, 213)
ACCENT = (165, 82, 45)
CREAM = (255, 248, 238)


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=index)


def centered(draw: ImageDraw.ImageDraw, box, text, typeface, fill):
    left, top, right, bottom = box
    bounds = draw.textbbox((0, 0), text, font=typeface)
    x = left + (right - left - (bounds[2] - bounds[0])) / 2
    y = top + (bottom - top - (bounds[3] - bounds[1])) / 2 - bounds[1]
    draw.text((x, y), text, font=typeface, fill=fill)


def make_header() -> None:
    image = Image.new("RGB", (150, 57), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 54, 149, 56), fill=ACCENT)
    draw.rounded_rectangle((9, 11, 40, 42), radius=8, fill=ACCENT)
    centered(draw, (9, 10, 40, 42), "墨", font("C:/Windows/Fonts/simsun.ttc", 22), CREAM)
    draw.text((48, 9), "墨阅", font=font("C:/Windows/Fonts/msyhbd.ttc", 18), fill=INK)
    draw.text(
        (49, 34),
        "MOYUE  ·  READER",
        font=font("C:/Windows/Fonts/segoeui.ttf", 6),
        fill=MUTED,
    )
    image.save(OUT / "header.bmp")


def make_sidebar() -> None:
    image = Image.new("RGB", (164, 314), PAPER)
    draw = ImageDraw.Draw(image)
    for y in range(314):
        ratio = y / 313
        color = tuple(
            round(PAPER[i] * (1 - ratio) + PAPER_2[i] * ratio) for i in range(3)
        )
        draw.line((0, y, 163, y), fill=color)
    draw.rectangle((0, 0, 3, 313), fill=ACCENT)
    draw.ellipse((112, -34, 196, 50), fill=(239, 226, 207))

    draw.rounded_rectangle((45, 35, 119, 109), radius=17, fill=ACCENT)
    centered(
        draw,
        (45, 34, 119, 109),
        "墨",
        font("C:/Windows/Fonts/simsun.ttc", 48),
        CREAM,
    )

    centered(
        draw,
        (12, 128, 152, 168),
        "墨阅",
        font("C:/Windows/Fonts/msyhbd.ttc", 29),
        INK,
    )
    centered(
        draw,
        (12, 170, 152, 187),
        "MOYUE READER",
        font("C:/Windows/Fonts/segoeui.ttf", 7),
        MUTED,
    )

    draw.line((44, 203, 120, 203), fill=(198, 178, 151), width=1)
    centered(
        draw,
        (12, 217, 152, 238),
        "把世界读慢一点",
        font("C:/Windows/Fonts/simsun.ttc", 10),
        MUTED,
    )

    # A small stack of pages at the bottom.
    draw.rounded_rectangle((50, 264, 114, 282), radius=3, outline=(185, 164, 136), width=1)
    draw.line((57, 270, 107, 270), fill=(185, 164, 136), width=1)
    draw.line((57, 275, 97, 275), fill=(185, 164, 136), width=1)
    centered(
        draw,
        (12, 292, 152, 304),
        "EPUB  ·  TXT",
        font("C:/Windows/Fonts/segoeui.ttf", 6),
        MUTED,
    )
    image.save(OUT / "sidebar.bmp")


if __name__ == "__main__":
    make_header()
    make_sidebar()
    print(OUT / "header.bmp")
    print(OUT / "sidebar.bmp")
