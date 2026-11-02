"""Shared markup for the approved, outlined Seller Insider Hub identity."""

from hashlib import sha256
from html import escape
from pathlib import Path
from xml.etree import ElementTree

BRAND_ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'brand'
LOGO = BRAND_ROOT / 'seller-insider-hub-logo.svg'
BRAND_VERSION = sha256(b''.join(path.read_bytes() for path in sorted(BRAND_ROOT.iterdir()) if path.suffix in {'.svg', '.png', '.ico'})).hexdigest()[:12]
_viewbox = ElementTree.fromstring(LOGO.read_text()).attrib['viewBox'].split()
LOGO_WIDTH, LOGO_HEIGHT = (round(float(value)) for value in _viewbox[2:])


def brand_link(css_class='site-brand', inverse=False):
    """Keep every letter as an outline, with one accessible home-link name."""
    name = 'seller-insider-hub-logo-white.svg' if inverse else 'seller-insider-hub-logo.svg'
    return (
        f'<a class="{escape(css_class, quote=True)}" href="/" aria-label="Seller Insider Hub home">'
        f'<img class="brand-logo" src="/assets/brand/{name}?v={BRAND_VERSION}" '
        f'width="{LOGO_WIDTH}" height="{LOGO_HEIGHT}" alt="Seller Insider Hub" decoding="async"></a>'
    )


def brand_mark():
    return (
        f'<img class="publication-mark" src="/assets/brand/seller-insider-hub-mark.svg?v={BRAND_VERSION}" '
        'width="48" height="48" alt="" aria-hidden="true" decoding="async">'
    )


def brand_head():
    """New, versioned icon URLs also avoid the former si. favicon cache."""
    return (
        f'<link rel="icon" href="/favicon.ico?v={BRAND_VERSION}" sizes="any">'
        f'<link rel="icon" href="/assets/brand/favicon-32x32.png?v={BRAND_VERSION}" type="image/png" sizes="32x32">'
        f'<link rel="icon" href="/assets/brand/favicon.svg?v={BRAND_VERSION}" type="image/svg+xml" sizes="any">'
        f'<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png?v={BRAND_VERSION}" sizes="180x180">'
    )
