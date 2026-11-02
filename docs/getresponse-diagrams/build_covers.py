#!/usr/bin/env python3
"""Create original SVG editorial diagrams and the site's responsive variants.

Run: python build_covers.py
Requires Pillow and either CairoSVG (preferred) or Inkscape CLI.
Uses DejaVu Sans / DejaVu Serif fonts. All outputs remain beside this script.
The SVG is the authoritative source; version is its first 12 SHA-256 digits.
WebP and JPEG encoding settings match scripts/prepare_editorial_images.py.
"""

from hashlib import sha256
from html import escape
from io import BytesIO
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
GREEN = "#11402d"
CREAM = "#f5f3e8"
PINK = "#f0cad1"
WIDTHS = (480, 960, 1440)
CREDIT = "Original editorial diagram · Seller Insider Hub"


def text(x, y, value, size=40, fill=GREEN, weight=400, anchor="start", serif=False, spacing=None):
    family = "DejaVu Serif" if serif else "DejaVu Sans"
    tracking = f' letter-spacing="{spacing}"' if spacing is not None else ""
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{tracking}>'
            f'{escape(value)}</text>')


def rect(x, y, width, height, fill, radius=0, stroke=None, stroke_width=2):
    edge = f' stroke="{stroke}" stroke-width="{stroke_width}"' if stroke else ""
    return f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}" fill="{fill}"{edge}/>'


def circle(cx, cy, radius, fill, stroke=None, stroke_width=2):
    edge = f' stroke="{stroke}" stroke-width="{stroke_width}"' if stroke else ""
    return f'<circle cx="{cx}" cy="{cy}" r="{radius}" fill="{fill}"{edge}/>'


def line(x1, y1, x2, y2, color, width=4, opacity=1):
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="{color}" stroke-width="{width}" stroke-linecap="round" opacity="{opacity}"/>')


def svg(title, description, background, parts):
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" '
            'viewBox="0 0 1440 960" role="img" aria-labelledby="title desc">\n'
            f'<title id="title">{escape(title)}</title>\n<desc id="desc">{escape(description)}</desc>\n'
            + rect(0, 0, 1440, 960, background) + '\n'
            + '\n'.join(parts) + '\n</svg>\n')


def plan_comparison():
    p = [text(76, 81, "GETRESPONSE", 26, spacing=3),
         text(72, 186, "Starter or Marketer?", 76, serif=True),
         text(76, 247, "Let the work choose the plan.", 34),
         rect(72, 300, 616, 500, GREEN, 24),
         rect(752, 300, 616, 500, PINK, 24),
         text(112, 392, "Starter", 58, CREAM, 600),
         text(112, 482, "1 workflow", 49, CREAM),
         text(112, 540, "Up to 6 elements", 38, CREAM),
         text(792, 392, "Marketer", 58, GREEN, 600),
         text(792, 482, "Multiple workflows", 42, GREEN),
         text(792, 540, "Ecommerce follow-up", 36, GREEN)]
    # Exactly six elements on one line: a conceptual capacity diagram, not UI.
    for a, b in zip((140, 236, 332, 428, 524), (236, 332, 428, 524, 620)):
        p.append(line(a, 660, b, 660, CREAM, 4, .55))
    for i, cx in enumerate((140, 236, 332, 428, 524, 620), 1):
        p.extend([circle(cx, 660, 26, PINK), text(cx, 670, str(i), 27, GREEN, 600, "middle")])
    p.append(text(112, 747, "One defined journey", 29, CREAM))
    # Three short, separate rows stand for multiple independent journeys.
    for cy in (615, 657, 699):
        p.append(line(812, cy, 1308, cy, GREEN, 3, .45))
        for cx in (812, 1060, 1308):
            p.append(circle(cx, cy, 10, GREEN))
    p.extend([text(792, 760, "Separate journeys", 29, GREEN),
              line(76, 857, 1364, 857, GREEN, 1, .3),
              text(76, 909, CREDIT, 21)])
    return svg("GetResponse Starter and Marketer plan comparison",
               "Starter: one workflow with up to six elements. Marketer: multiple workflows and ecommerce follow-up. Original conceptual diagram, not a software screenshot.", CREAM, p)


def welcome_timeline():
    p = [text(76, 81, "GETRESPONSE", 26, PINK, spacing=3),
         text(72, 186, "A useful welcome sequence", 68, CREAM, serif=True),
         text(76, 247, "Deliver the promise. Help. Invite.", 34, CREAM),
         line(256, 447, 1184, 447, CREAM, 5, .55)]
    items = [(256, "Day 0", "PDF delivery", "Fulfill the promise."),
             (720, "Day 2", "Useful tip", "Make one thing easier."),
             (1184, "Day 5", "Service invitation", "Offer a clear next step.")]
    for number, (cx, day, label, note) in enumerate(items, 1):
        p.extend([text(cx, 354, day, 43, CREAM, 600, "middle"),
                  circle(cx, 447, 57, PINK),
                  text(cx, 463, str(number), 47, GREEN, 600, "middle"),
                  text(cx, 585, label, 39 if number == 3 else 43, CREAM, 600, "middle"),
                  text(cx, 643, note, 26, CREAM, 400, "middle")])
    p.extend([text(76, 784, "EXAMPLE SCHEDULE", 23, PINK, spacing=2),
              text(76, 832, "Adjust the timing to your offer.", 31, CREAM),
              line(76, 864, 1364, 864, CREAM, 1, .3),
              text(76, 916, CREDIT, 21, CREAM)])
    return svg("A GetResponse lead magnet welcome sequence",
               "Example timeline: Day 0 delivers the PDF, Day 2 shares a useful tip, and Day 5 offers a service invitation. Timing is illustrative and can be adjusted.", GREEN, p)


def recovery_checklist():
    p = [text(76, 81, "GETRESPONSE + SHOPIFY", 26, spacing=3),
         text(72, 186, "Before cart recovery goes live", 65, serif=True),
         text(76, 247, "Three checks for a careful launch.", 34)]
    rows = [(371, "Connect store", "Confirm the connection is working."),
            (540, "Test a purchase", "Check that the order data arrives."),
            (709, "Send one reminder", "Review a controlled test before launch.")]
    for i, (cy, label, note) in enumerate(rows, 1):
        p.extend([circle(137, cy, 46, PINK), text(137, cy + 14, str(i), 42, GREEN, 600, "middle"),
                  text(224, cy + 1, label, 55, GREEN, 600),
                  text(226, cy + 53, note, 30)])
        if i < 3:
            p.append(line(224, cy + 99, 1364, cy + 99, GREEN, 1, .24))
    p.extend([text(76, 843, "Planning checklist · not a workflow diagram", 27),
              line(76, 872, 1364, 872, GREEN, 1, .3),
              text(76, 922, CREDIT, 21)])
    return svg("GetResponse and Shopify cart recovery launch checklist",
               "Planning checklist: connect the store, test a purchase, and send one reminder in a controlled test. This does not depict automated stop logic.", CREAM, p)


ASSETS = [
    {"slug": "getresponse-starter-vs-marketer", "make": plan_comparison,
     "alt": "Two plan panels compare GetResponse Starter, with one workflow of up to six elements, and Marketer, with multiple workflows and ecommerce follow-up."},
    {"slug": "how-to-send-a-lead-magnet-with-getresponse", "make": welcome_timeline,
     "alt": "Example welcome sequence: deliver a PDF on day 0, send a useful tip on day 2, and offer a service invitation on day 5."},
    {"slug": "getresponse-shopify-abandoned-cart", "make": recovery_checklist,
     "alt": "Cart recovery launch checklist for GetResponse and Shopify: connect the store, test a purchase, and send one reminder in a controlled test."},
]


def render_svg(source, output):
    try:
        import cairosvg
    except ImportError:
        executable = shutil.which("inkscape")
        if not executable:
            raise SystemExit("Install CairoSVG or make Inkscape available on PATH.")
        subprocess.run([executable, str(source), "--export-type=png", "--export-width=1440",
                        "--export-height=960", f"--export-filename={output}"],
                       check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return "Inkscape SVG renderer (CairoSVG fallback)"
    cairosvg.svg2png(url=str(source), write_to=str(output), output_width=1440, output_height=960)
    return "CairoSVG"


def write_verified(image, path, fmt, **settings):
    data = BytesIO()
    image.save(data, fmt, **settings)
    payload = data.getvalue()
    with Image.open(BytesIO(payload)) as check:
        check.load()
        assert check.size == image.size
    path.write_bytes(payload)
    return {"file": path.name, "width": image.width, "height": image.height,
            "bytes": len(payload), "sha256": sha256(payload).hexdigest()}


def main():
    images = {}
    provenance = []
    previews = []
    for item in ASSETS:
        slug = item["slug"]
        source = ROOT / f"{slug}.svg"
        source.write_text(item["make"](), encoding="utf-8")
        digest = sha256(source.read_bytes()).hexdigest()
        original = ROOT / f"{slug}-original.png"
        renderer = render_svg(source, original)
        with Image.open(original) as im:
            canvas = im.convert("RGB")
        assert canvas.size == (1440, 960)
        variants = []
        for width in WIDTHS:
            resized = canvas.resize((width, width * 2 // 3), Image.Resampling.LANCZOS)
            variants.append(write_verified(resized, ROOT / f"{slug}-{width}.webp", "WEBP", quality=83, method=6))
        social = canvas.resize((1200, 800), Image.Resampling.LANCZOS)
        variants.append(write_verified(social, ROOT / f"{slug}-social.jpg", "JPEG", quality=86, optimize=True, progressive=True))
        images[slug] = {"slug": slug, "alt": item["alt"], "position": "50% 50%", "width": 1440,
                        "height": 960, "widths": list(WIDTHS), "socialWidth": 1200, "socialHeight": 800,
                        "version": digest[:12], "credit": CREDIT}
        provenance.append({"slug": slug, "method": "Original code-native SVG diagram; no vendor logo, screenshot, generated raster art, or private data.",
                           "sourceFile": source.name, "originalSha256": digest, "renderer": renderer,
                           "originalRasterFile": original.name,
                           "palette": [GREEN, CREAM, PINK], "fontFamilies": ["DejaVu Sans", "DejaVu Serif"],
                           "credit": CREDIT, "variants": variants})
        with Image.open(ROOT / f"{slug}-480.webp") as preview:
            previews.append(preview.convert("RGB"))
    (ROOT / "editorial-images.json").write_text(json.dumps({"images": images}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "provenance.json").write_text(json.dumps({"method": "Original editorial SVG diagrams with raster derivatives", "assets": provenance}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # The contact sheet uses the actual smallest responsive WebP files.
    sheet = Image.new("RGB", (1480, 360), "#e5e5df")
    for i, preview in enumerate(previews):
        sheet.paste(preview, (10 + 490 * i, 20))
    sheet.save(ROOT / "review-contact-sheet.png")
    print(json.dumps({"covers": len(images), "responsiveAndSocialFiles": 12,
                      "metadata": str(ROOT / 'editorial-images.json'), "directory": str(ROOT)}))


if __name__ == "__main__":
    main()
