"""Deterministic RSS and Atom summaries of the publication's editorial pages.

Dates come from the same records used by the page bylines and sitemap. When a
record only has a calendar date, midnight in the publication's Eastern time zone
is a serialization convention, not a claim about the exact publication time.
"""
from datetime import datetime, time
from email.utils import format_datetime
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urlencode, urlsplit
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET


ATOM = 'http://www.w3.org/2005/Atom'
EASTERN = ZoneInfo('America/New_York')
TITLE = 'Seller Insider Hub — tutorials and guides'
DESCRIPTION = 'Practical tutorials, comparisons, and business guides for using AI and software in a small business.'
MEDIA = 'http://search.yahoo.com/mrss/'
PINTEREST_PATH = '/feeds/pinterest.xml'

# This is a reviewed publishing allowlist, not a list of every historical article.
# Add one record per real article only after reviewing its copy and cover image.
PINTEREST_ITEMS = (
    {
        'route': '/playbooks/etsy-keyword-data-chatgpt/',
        'image_slug': 'etsy-keyword-data-chatgpt',
        'title': 'Free Etsy Keyword Templates + 5 ChatGPT Prompts',
        'description': (
            'Download three CSV templates, a product brief, and five ChatGPT prompts '
            'for organizing Etsy keyword research and drafting a listing you can check. '
            'Add your own observed data and verify product facts before publishing. '
            'Free kit and complete instructions; no signup required.'
        ),
        'campaign': 'etsy_keyword_starter_kit',
    },
)


def feed_date(value):
    """Keep real source dates stable across builds and daylight-saving changes."""
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if len(value) == 10:
        return datetime.combine(parsed.date(), time.min, EASTERN)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=EASTERN)


def element(parent, tag, text=None, **attributes):
    node = ET.SubElement(parent, tag, attributes)
    if text is not None:
        node.text = str(text)
    return node


def write_feeds(output, origin, entries, limit=50):
    """Publish canonical, public editorial entries without changing their dates."""
    recent = sorted(entries, key=lambda entry: (
        feed_date(entry['modified']), feed_date(entry['published']), entry['url']
    ), reverse=True)[:limit]
    if not recent:
        raise ValueError('The editorial feed requires at least one public entry.')
    updated = max(feed_date(entry['modified']) for entry in recent)

    rss = ET.Element('rss', {
        'version': '2.0', 'xmlns:atom': ATOM,
        'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
        'xmlns:dcterms': 'http://purl.org/dc/terms/',
    })
    channel = element(rss, 'channel')
    element(channel, 'title', TITLE)
    element(channel, 'link', origin + '/')
    element(channel, 'description', DESCRIPTION)
    element(channel, 'language', 'en-us')
    element(channel, 'lastBuildDate', format_datetime(updated))
    element(channel, 'atom:link', href=origin + '/feed.xml', rel='self', type='application/rss+xml')
    for entry in recent:
        item = element(channel, 'item')
        url = origin + entry['url']
        element(item, 'title', entry['title'])
        element(item, 'link', url)
        element(item, 'guid', url, isPermaLink='true')
        element(item, 'description', entry['description'])
        element(item, 'category', 'Tutorial' if entry['type'] == 'Playbook' else entry['type'])
        element(item, 'dc:creator', 'Jennie Malone')
        element(item, 'pubDate', format_datetime(feed_date(entry['published'])))
        element(item, 'dcterms:modified', feed_date(entry['modified']).isoformat())

    # Atom carries distinct publication and revision dates for recent-update
    # discovery; the complete XML sitemap continues to list all public pages.
    atom = ET.Element('feed', {'xmlns': ATOM, 'xml:lang': 'en-US'})
    element(atom, 'id', origin + '/atom.xml')
    element(atom, 'title', TITLE)
    element(atom, 'subtitle', DESCRIPTION)
    element(atom, 'link', href=origin + '/atom.xml', rel='self', type='application/atom+xml')
    element(atom, 'link', href=origin + '/', rel='alternate', type='text/html')
    element(atom, 'updated', updated.isoformat())
    author = element(atom, 'author')
    element(author, 'name', 'Jennie Malone')
    element(author, 'uri', origin + '/authors/jennie-malone/')
    for entry in recent:
        item = element(atom, 'entry')
        url = origin + entry['url']
        element(item, 'id', url)
        element(item, 'title', entry['title'])
        element(item, 'link', href=url, rel='alternate', type='text/html')
        element(item, 'summary', entry['description'], type='text')
        element(item, 'published', feed_date(entry['published']).isoformat())
        element(item, 'updated', feed_date(entry['modified']).isoformat())
        element(item, 'category', term=entry['type'])

    for filename, tree in [('feed.xml', rss), ('atom.xml', atom)]:
        ET.indent(tree, space='  ')
        ET.ElementTree(tree).write(Path(output) / filename, encoding='utf-8', xml_declaration=True)
    return len(recent)


class _PublicPageHead(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.canonicals = []
        self.noindex = False
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name', '').lower() == 'robots':
            self.noindex |= 'noindex' in attrs.get('content', '').lower()


def _local_path(output, route):
    """Only permit plain root-relative paths inside the generated publication."""
    parsed = urlsplit(route)
    if (parsed.scheme or parsed.netloc or parsed.query or parsed.fragment
            or not route.startswith('/') or '\\' in route or '%' in route
            or '//' in route or any(part in {'.', '..'} for part in route.split('/'))):
        raise ValueError('Pinterest feed requires a clean local path: ' + route)
    root = Path(output).resolve()
    path = (root / route.lstrip('/')).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Pinterest feed path escapes the public build: ' + route)
    return path


def _jpeg_dimensions(path):
    """Read JPEG frame dimensions without adding an image-library dependency."""
    data = path.read_bytes()
    if not data.startswith(b'\xff\xd8') or not data.endswith(b'\xff\xd9'):
        raise ValueError('Pinterest cover is not a complete JPEG: ' + str(path))
    cursor = 2
    frames = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
              0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while cursor + 4 <= len(data):
        if data[cursor] != 0xFF:
            break
        while cursor < len(data) and data[cursor] == 0xFF:
            cursor += 1
        if cursor >= len(data):
            break
        marker = data[cursor]
        cursor += 1
        if marker in {0xD9, 0xDA}:
            break
        if marker in {0x01, *range(0xD0, 0xD9)}:
            continue
        size = int.from_bytes(data[cursor:cursor + 2], 'big')
        if size < 2 or cursor + size > len(data):
            break
        if marker in frames and size >= 8:
            height = int.from_bytes(data[cursor + 3:cursor + 5], 'big')
            width = int.from_bytes(data[cursor + 5:cursor + 7], 'big')
            if width > 0 and height > 0:
                return width, height
            break
        cursor += size
    raise ValueError('Pinterest cover has no valid JPEG dimensions: ' + str(path))


def write_pinterest_feed(output, origin, entries, images, curated=PINTEREST_ITEMS):
    """Build one-image Pins only for explicitly reviewed, public article routes."""
    if origin != 'https://sellerinsiderhub.com':
        raise ValueError('Pinterest feed must use the production website origin.')
    if not curated:
        raise ValueError('Pinterest feed requires at least one reviewed article.')
    public_entries = {entry['url']: entry for entry in entries}
    selected = []
    seen = set()
    for item in curated:
        route = item['route']
        page_path = _local_path(output, route) / 'index.html'
        if not route.endswith('/') or route in seen or route not in public_entries:
            raise ValueError('Pinterest route must be unique and in the editorial feed: ' + route)
        seen.add(route)
        if not page_path.is_file():
            raise ValueError('Pinterest article is missing from the public build: ' + route)
        page = _PublicPageHead(page_path.read_text(encoding='utf-8'))
        canonical = origin + route
        if page.noindex or page.canonicals != [canonical]:
            raise ValueError('Pinterest article must be indexable with its canonical URL: ' + route)
        slug = item['image_slug']
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
            raise ValueError('Invalid Pinterest cover identifier.')
        image = images.get(slug)
        if not image or image.get('slug') != slug:
            raise ValueError('Pinterest cover is missing from the image registry: ' + slug)
        image_route = '/assets/editorial/' + slug + '-social.jpg'
        image_path = _local_path(output, image_route)
        if not image_path.is_file():
            raise ValueError('Pinterest cover is missing from the public build: ' + image_route)
        width, height = _jpeg_dimensions(image_path)
        if (width, height) != (image.get('socialWidth'), image.get('socialHeight')):
            raise ValueError('Pinterest cover dimensions disagree with its image registry: ' + slug)
        version = image.get('version', '')
        if not re.fullmatch(r'[a-f0-9]{8,64}', version):
            raise ValueError('Pinterest cover requires its existing image version: ' + slug)
        if not item['title'].strip() or not item['description'].strip():
            raise ValueError('Pinterest article requires reviewed title and description.')
        if not re.fullmatch(r'[a-z0-9_]+', item['campaign']):
            raise ValueError('Pinterest campaign must be a stable, simple identifier.')
        entry = public_entries[route]
        published, modified = feed_date(entry['published']), feed_date(entry['modified'])
        if published > modified:
            raise ValueError('Pinterest article publication date follows its revision date: ' + route)
        selected.append((item, canonical, image_route, version, width, height, published, modified))

    rss = ET.Element('rss', {'version': '2.0', 'xmlns:atom': ATOM, 'xmlns:media': MEDIA})
    channel = element(rss, 'channel')
    element(channel, 'title', 'Seller Insider Hub — selected free Etsy resources')
    element(channel, 'link', origin + '/resources/')
    element(channel, 'description', 'Selected free Etsy templates and practical listing workflows from Seller Insider Hub.')
    element(channel, 'language', 'en-us')
    element(channel, 'lastBuildDate', format_datetime(max(row[-1] for row in selected)))
    element(channel, 'atom:link', href=origin + PINTEREST_PATH, rel='self', type='application/rss+xml')
    for item, canonical, image_route, version, width, height, published, _ in selected:
        node = element(channel, 'item')
        element(node, 'title', item['title'])
        campaign = urlencode({'utm_source': 'pinterest', 'utm_medium': 'social',
                              'utm_campaign': item['campaign'], 'utm_content': 'rss'})
        element(node, 'link', canonical + '?' + campaign)
        element(node, 'guid', canonical, isPermaLink='true')
        element(node, 'description', item['description'])
        element(node, 'pubDate', format_datetime(published))
        # One image reference only: no duplicate enclosure or description image.
        element(node, 'media:content', url=origin + image_route + '?v=' + version,
                medium='image', type='image/jpeg', width=str(width), height=str(height))
    destination = _local_path(output, PINTEREST_PATH)
    destination.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(rss, space='  ')
    ET.ElementTree(rss).write(destination, encoding='utf-8', xml_declaration=True)
    return len(selected)
