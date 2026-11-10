from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).resolve().parent / "fixtures" / "cover.png"
out.parent.mkdir(parents=True, exist_ok=True)

width, height = 600, 900
image = Image.new("RGB", (width, height), "#25443c")
draw = ImageDraw.Draw(image)
for y in range(height):
    ratio = y / height
    color = (
        round(37 + 70 * ratio),
        round(68 + 50 * ratio),
        round(60 + 30 * ratio),
    )
    draw.line([(0, y), (width, y)], fill=color)

draw.ellipse((330, 80, 760, 510), fill="#d9b98c")
draw.ellipse((-160, 520, 300, 980), fill="#a5522d")
draw.rectangle((48, 48, width - 48, height - 48), outline="#f7f1e7", width=2)

font_path = Path("C:/Windows/Fonts/msyh.ttc")
title_font = ImageFont.truetype(str(font_path), 84) if font_path.exists() else ImageFont.load_default()
small_font = ImageFont.truetype(str(font_path), 22) if font_path.exists() else ImageFont.load_default()

draw.text((72, 610), "山海", font=title_font, fill="#fff8ee")
draw.text((72, 710), "小记", font=title_font, fill="#fff8ee")
draw.text((76, 805), "CUSTOM COVER · MOYUE", font=small_font, fill="#f1d9b0")

image.save(out, "PNG")
print(out)
