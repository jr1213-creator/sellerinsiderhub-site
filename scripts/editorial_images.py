"""Responsive, article-specific cover imagery for the publication."""

import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGES = json.loads((ROOT / 'data/editorial-images.json').read_text())['images']
CREDIT = 'AI-generated editorial illustration · Seller Insider Hub'


def h(value):
    return escape(str(value), quote=True)


def image_url(record, name):
    return f'/assets/editorial/{record["slug"]}-{name}?v={record["version"]}'


def cover(slug, variant=0, *, priority=False, placement='card', informative=False):
    """Keep all copy outside the artwork; duplicate linked covers are decorative."""
    record = IMAGES[slug]
    sizes = {
        'lead': '(max-width: 820px) calc(100vw - 32px), (max-width: 1300px) 60vw, 750px',
        'side': '(max-width: 560px) 120px, (max-width: 820px) calc((100vw - 57px) / 2), (max-width: 1100px) 132px, 176px',
        'article': '(max-width: 820px) calc(100vw - 32px), (max-width: 1300px) 66vw, 820px',
        'card': '(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) calc((100vw - 72px) / 2), 400px',
    }[placement]
    srcset = ', '.join(f'{image_url(record, str(width)+".webp")} {width}w' for width in record['widths'])
    alt = record['alt'] if informative else ''
    hidden = '' if informative else ' aria-hidden="true"'
    return (
        f'<div class="editorial-cover editorial-cover--{h(placement)}" '
        f'style="--image-focus:{h(record.get("position", "50% 50%"))}"{hidden}>'
        f'<picture><source type="image/webp" srcset="{h(srcset)}" sizes="{h(sizes)}">'
        f'<img src="{h(image_url(record, "social.jpg"))}" alt="{h(alt)}" '
        f'width="{record["width"]}" height="{record["height"]}" '
        f'loading="{"eager" if priority else "lazy"}" decoding="async"'
        + (' fetchpriority="high"' if priority else '')
        + '></picture></div>'
    )


def article_figure(slug):
    return (
        '<figure class="editorial-figure">'
        + cover(slug, priority=True, placement='article', informative=True)
        + f'<figcaption>{CREDIT}</figcaption></figure>'
    )


def cover_credit():
    return '<p class="cover-credit">Cover illustrations created with AI for Seller Insider Hub. <a href="/editorial-standards/#ai">Our image standards</a></p>'


def page_image(route):
    if route in {'/', '/playbooks/'}:
        return IMAGES.get('ai-social-media-agents')
    parts = route.strip('/').split('/')
    return IMAGES.get(parts[1]) if len(parts) == 2 and parts[0] == 'playbooks' else None
