"""Deterministic RSS and Atom summaries of the publication's editorial pages.

Dates come from the same records used by the page bylines and sitemap. When a
record only has a calendar date, midnight in the publication's Eastern time zone
is a serialization convention, not a claim about the exact publication time.
"""
from datetime import datetime, time
from email.utils import format_datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET


ATOM = 'http://www.w3.org/2005/Atom'
EASTERN = ZoneInfo('America/New_York')
TITLE = 'Seller Insider Hub — tutorials and guides'
DESCRIPTION = 'Practical tutorials, comparisons, and business guides for using AI and software in a small business.'


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
