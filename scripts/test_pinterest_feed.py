#!/usr/bin/env python3
"""Check the curated feed's publication boundary, images, and campaign links.

Run with --built after the site build to check the deployed-file integration too.
"""
from copy import deepcopy
from email.utils import parsedate_to_datetime
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from urllib.parse import parse_qs, urlsplit
import xml.etree.ElementTree as ET

from feed_components import (
    ATOM, MEDIA, PINTEREST_ITEMS, PINTEREST_PATH, feed_date,
    write_feeds, write_pinterest_feed,
)

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://sellerinsiderhub.com'
ROUTE = '/playbooks/etsy-keyword-data-chatgpt/'
CANONICAL = ORIGIN + ROUTE
IMAGES = json.loads((ROOT / 'data/editorial-images.json').read_text())['images']
ARTICLE = next(item for item in json.loads((ROOT / 'data/editorial.json').read_text())['playbooks']
               if item['id'] == 'etsy-keyword-data-chatgpt')
ENTRY = {'url': ROUTE, 'title': ARTICLE['title'], 'description': ARTICLE['summary'],
         'type': 'Playbook', 'published': ARTICLE['publishedAt'],
         'modified': ARTICLE['modifiedAt']}
CAMPAIGN = {'utm_source': ['pinterest'], 'utm_medium': ['social'],
            'utm_campaign': ['etsy_keyword_starter_kit'], 'utm_content': ['rss']}
CHECK_BUILT = '--built' in sys.argv
if CHECK_BUILT:
    sys.argv.remove('--built')


class PinterestFeedTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.output = Path(self.scratch.name)
        self.page = self.output / ROUTE.lstrip('/') / 'index.html'
        self.page.parent.mkdir(parents=True)
        self.page.write_text(f'<html><head><link rel="canonical" href="{CANONICAL}"></head></html>')
        self.image = self.output / 'assets/editorial/etsy-keyword-data-chatgpt-social.jpg'
        self.image.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / self.image.relative_to(self.output), self.image)
        self.entries = [ENTRY, {**ENTRY, 'url': '/another-editorial-page/'}]

    def test_launch_has_one_reviewed_article_and_one_valid_image(self):
        self.assertEqual(write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES), 1)
        feed = ET.parse(self.output / PINTEREST_PATH.lstrip('/')).getroot()
        items = feed.findall('channel/item')
        self.assertEqual(len(items), 1, 'Unreviewed history must not become Pins.')
        item = items[0]
        self.assertEqual(item.findtext('guid'), CANONICAL)
        self.assertEqual(item.find('guid').get('isPermaLink'), 'true')
        link = urlsplit(item.findtext('link'))
        self.assertEqual(link.scheme + '://' + link.netloc + link.path, CANONICAL)
        self.assertEqual(parse_qs(link.query), CAMPAIGN)
        self.assertEqual(parsedate_to_datetime(item.findtext('pubDate')), feed_date(ARTICLE['publishedAt']))
        image = item.findall('{' + MEDIA + '}content')
        self.assertEqual(len(image), 1)
        self.assertEqual((image[0].get('type'), image[0].get('width'), image[0].get('height')),
                         ('image/jpeg', '1200', '800'))
        self.assertEqual(urlsplit(image[0].get('url')).path, '/' + str(self.image.relative_to(self.output)))
        self.assertEqual(item.findall('enclosure'), [])
        self.assertNotIn('<img', item.findtext('description'))
        self.assertNotIn('utm_', image[0].get('url'))
        self.assertEqual(feed.find('channel/{' + ATOM + '}link').get('href'), ORIGIN + PINTEREST_PATH)

    def test_general_rss_and_atom_remain_unchanged(self):
        write_feeds(self.output, ORIGIN, self.entries)
        before = {name: (self.output / name).read_bytes() for name in ['feed.xml', 'atom.xml']}
        write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES)
        for name, contents in before.items():
            self.assertEqual((self.output / name).read_bytes(), contents)
            self.assertNotIn(b'utm_', contents)

    def test_rejects_unreviewed_external_duplicate_or_missing_routes(self):
        for route in ['https://other.example/article/', '//other.example/article/',
                      '/../private/', '/%2e%2e/private/', '/missing-article/']:
            with self.subTest(route=route), self.assertRaises(ValueError):
                write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES,
                                     ({**PINTEREST_ITEMS[0], 'route': route},))
        with self.assertRaises(ValueError):
            write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES, PINTEREST_ITEMS * 2)
        self.page.unlink()
        with self.assertRaises(ValueError):
            write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES)

    def test_rejects_noindex_or_wrong_canonical_pages(self):
        for markup in [f'<link rel="canonical" href="{CANONICAL}"><meta name="robots" content="noindex,follow">',
                       '<link rel="canonical" href="https://other.example/">']:
            self.page.write_text(markup)
            with self.subTest(markup=markup), self.assertRaises(ValueError):
                write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES)

    def test_rejects_missing_unsafe_or_mismatched_images(self):
        for slug in ['../../private', 'https://other.example/image', 'missing-cover']:
            with self.subTest(slug=slug), self.assertRaises(ValueError):
                write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES,
                                     ({**PINTEREST_ITEMS[0], 'image_slug': slug},))
        registry = deepcopy(IMAGES)
        registry['etsy-keyword-data-chatgpt']['socialWidth'] = 600
        with self.assertRaises(ValueError):
            write_pinterest_feed(self.output, ORIGIN, self.entries, registry)
        self.image.write_bytes(b'<html>This is not an image.</html>')
        with self.assertRaises(ValueError):
            write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES)
        self.image.unlink()
        with self.assertRaises(ValueError):
            write_pinterest_feed(self.output, ORIGIN, self.entries, IMAGES)

    @unittest.skipUnless(CHECK_BUILT, 'Use --built after building to check publication integration.')
    def test_built_feed_headers_and_sitemap_separation(self):
        output = ROOT / 'dist'
        feed = ET.parse(output / PINTEREST_PATH.lstrip('/')).getroot()
        self.assertEqual(len(feed.findall('channel/item')), 1)
        self.assertEqual(feed.findtext('channel/item/guid'), CANONICAL)
        headers = (output / '_headers').read_text()
        self.assertIn(PINTEREST_PATH + '\n  Content-Type: application/rss+xml; charset=utf-8\n'
                      '  Cache-Control: public, max-age=300, must-revalidate\n', headers)
        for name in ['sitemap.xml', 'robots.txt', 'feed.xml', 'atom.xml']:
            contents = (output / name).read_text()
            self.assertNotIn(PINTEREST_PATH, contents)
            self.assertNotIn('utm_source=pinterest', contents)


if __name__ == '__main__':
    unittest.main()
