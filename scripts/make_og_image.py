#!/usr/bin/env python3
"""Generate the static Open Graph preview image (1200x630) for stellaris-build.com.

Composes a Stellaris loading screen as background, darkens it with a left-weighted
gradient so the text stays readable, and draws the site name over it.

Usage (from repo root):
    python3 scripts/make_og_image.py \
        frontend/public/loading_screens/load_3.webp \
        frontend/public/og-image.jpg

Requires Pillow. A frontend rebuild is needed for the file to land in dist/.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

src = sys.argv[1]
out = sys.argv[2]

# Background: cover-fit the loading screen into 1200x630
bg = Image.open(src).convert('RGB')
scale = max(W / bg.width, H / bg.height)
bg = bg.resize((round(bg.width * scale), round(bg.height * scale)), Image.LANCZOS)
left = (bg.width - W) // 2
top = (bg.height - H) // 2
bg = bg.crop((left, top, left + W, top + H))

# Darkening overlay: strong on the left (behind the text), lighter on the right
overlay = Image.new('L', (W, 1))
for x in range(W):
    t = x / (W - 1)
    overlay.putpixel((x, 0), int(232 - 132 * t))  # alpha 232 -> 100
overlay = overlay.resize((W, H))
bg = Image.composite(Image.new('RGB', (W, H), (5, 8, 18)), bg, overlay)

draw = ImageDraw.Draw(bg)

# Accent bar
draw.rectangle([80, 214, 86, 400], fill=(90, 170, 220))

title_font = ImageFont.truetype(FONT_BOLD, 76)
sub_font = ImageFont.truetype(FONT_REG, 34)
url_font = ImageFont.truetype(FONT_BOLD, 26)

draw.text((122, 206), 'STELLARIS', font=title_font, fill=(255, 255, 255))
draw.text((122, 292), 'BUILD SHARING', font=title_font, fill=(120, 190, 235))
draw.text((124, 392), 'Share and discover empire builds', font=sub_font, fill=(205, 214, 228))
draw.text((124, 444), 'stellaris-build.com', font=url_font, fill=(140, 160, 190))

bg.save(out, 'JPEG', quality=88, optimize=True)
print(f'wrote {out}')
