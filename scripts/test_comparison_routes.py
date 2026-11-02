#!/usr/bin/env python3
"""Check curated pair identity and optional generated-file integration (--built)."""
from copy import deepcopy
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
import unittest
import xml.etree.ElementTree as ET

from comparison_routes import build_comparison_registry


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://sellerinsiderhub.com'
CHECK_BUILT = '--built' in sys.argv
if CHECK_BUILT:
    sys.argv.remove('--built')


class Head(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.canonicals, self.robots = [], []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name') == 'robots':
            self.robots.append(attrs.get('content', ''))


class ComparisonRoutesTest(unittest.TestCase):
    def setUp(self):
        self.tools = [{'id': value} for value in ['alpha', 'beta', 'gamma']]
        self.entries = [dict(id='alpha-vs-beta', title='Alpha vs Beta', toolIds=['alpha', 'beta'])]

    def test_pair_order_preserves_explicit_canonical_slug_and_editorial_order(self):
        entries = [dict(id='mailerlite-vs-kit', title='MailerLite vs Kit', toolIds=['mailerlite', 'kit'])]
        original = deepcopy(entries)
        registry = build_comparison_registry(entries, [{'id': 'kit'}, {'id': 'mailerlite'}])
        first = registry.resolve_pair(['mailerlite', 'kit'])
        self.assertIs(first, registry.resolve_pair(['kit', 'mailerlite']))
        self.assertEqual(first.url, '/comparisons/mailerlite-vs-kit/')
        self.assertEqual(first.tool_ids, ('mailerlite', 'kit'))
        self.assertEqual(entries, original)
        self.assertEqual(registry.public_entries(), [dict(
            title='MailerLite vs Kit', url='/comparisons/mailerlite-vs-kit/', toolIds=['mailerlite', 'kit'],
        )])

    def test_no_article_for_unreviewed_or_invalid_selection(self):
        registry = build_comparison_registry(self.entries, self.tools)
        for ids in [[], ['alpha'], ['alpha', 'alpha'], ['alpha', 'gamma'], ['alpha', 'missing'], ['alpha', 'beta', 'gamma'], 'alpha,beta']:
            with self.subTest(ids=ids):
                self.assertIsNone(registry.resolve_pair(ids))

    def test_bad_pair_data_and_unsafe_article_slugs_fail(self):
        invalid = [[], ['alpha'], ['alpha', 'alpha'], ['alpha', 'missing'], ['alpha', 'beta', 'gamma'], 'alpha,beta']
        for ids in invalid:
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                build_comparison_registry([dict(self.entries[0], toolIds=ids)], self.tools)
        for slug in ['', '../alpha', 'Alpha-vs-beta', 'alpha.html', 'alpha?tool=beta', 'alpha/beta', 'alpha--beta']:
            with self.subTest(slug=slug), self.assertRaises(ValueError):
                build_comparison_registry([dict(self.entries[0], id=slug)], self.tools)

    def test_duplicate_pair_in_either_order_and_duplicate_slug_fail(self):
        for second in [
            dict(id='another-article', title='Another article', toolIds=['beta', 'alpha']),
            dict(id='another-article', title='Another article', toolIds=['alpha', 'beta']),
            dict(id='alpha-vs-beta', title='Different pair', toolIds=['alpha', 'gamma']),
        ]:
            with self.subTest(second=second), self.assertRaises(ValueError):
                build_comparison_registry(self.entries + [second], self.tools)

    def test_reverse_aliases_are_direct_and_cannot_shadow_another_article(self):
        registry = build_comparison_registry(self.entries, self.tools)
        self.assertEqual(set(registry.redirects()), {
            (f'/comparisons/beta-vs-alpha{ending}', '/comparisons/alpha-vs-beta/')
            for ending in ['', '/', '.html', '/index.html']
        })
        with self.assertRaisesRegex(ValueError, 'collides'):
            build_comparison_registry(self.entries + [dict(
                id='beta-vs-alpha', title='Different editorial pair', toolIds=['alpha', 'gamma'],
            )], self.tools)
        ambiguous_tools = [{'id': value} for value in ['a', 'c', 'a-vs-b', 'b-vs-c']]
        with self.assertRaisesRegex(ValueError, 'collides'):
            build_comparison_registry([
                dict(id='first-article', title='First', toolIds=['c', 'a-vs-b']),
                dict(id='second-article', title='Second', toolIds=['b-vs-c', 'a']),
            ], ambiguous_tools)

    def test_existing_curated_articles_are_the_entire_public_registry(self):
        editorial = json.loads((ROOT / 'data/editorial.json').read_text())['comparisons']
        tools = json.loads((ROOT / 'data/catalog.json').read_text())['tools']
        registry = build_comparison_registry(editorial, tools)
        self.assertEqual(len(registry.routes), len(editorial))
        self.assertEqual({route.slug for route in registry.routes}, {entry['id'] for entry in editorial})
        for entry in editorial:
            self.assertEqual(registry.resolve_pair(entry['toolIds'][::-1]).url, f'/comparisons/{entry["id"]}/')

    @unittest.skipUnless(CHECK_BUILT, 'Use --built after building to check publication integration.')
    def test_built_projection_redirects_canonicals_and_sitemap(self):
        editorial = json.loads((ROOT / 'data/editorial.json').read_text())['comparisons']
        tools = json.loads((ROOT / 'data/catalog.json').read_text())['tools']
        registry = build_comparison_registry(editorial, tools)
        output = ROOT / 'dist'
        catalog = json.loads((output / 'data/catalog.json').read_text())
        self.assertEqual(catalog['comparisons'], registry.public_entries())
        redirects = set((output / '_redirects').read_text().splitlines())
        sitemap = {node.text for node in ET.parse(output / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
        self.assertEqual({url for url in sitemap if '/comparisons/' in url}, {
            ORIGIN + '/comparisons/', *(ORIGIN + route.url for route in registry.routes),
        })
        for source, target in registry.redirects():
            self.assertIn(f'{source} {target} 301!', redirects)
        for route in registry.routes:
            html = (output / route.url.lstrip('/') / 'index.html').read_text()
            self.assertEqual(Head(html).canonicals, [ORIGIN + route.url])
            self.assertFalse(any('noindex' in value for value in Head(html).robots))
            self.assertIn('<table', html, 'Editorial comparison content must exist without client JavaScript')
            if route.reverse_slug != route.slug:
                self.assertFalse((output / 'comparisons' / route.reverse_slug / 'index.html').exists())
        workspace = Head((output / 'compare/index.html').read_text())
        self.assertEqual(workspace.canonicals, [ORIGIN + '/compare/'])
        self.assertTrue(any('noindex' in value for value in workspace.robots))
        self.assertNotIn(ORIGIN + '/compare/', sitemap)


if __name__ == '__main__':
    unittest.main()
