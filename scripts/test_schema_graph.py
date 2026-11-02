#!/usr/bin/env python3
"""Check honest subject identity and real research downloads.

Run with --built after the normal site build to check rendered graphs too.
This command does not build, change, or publish the website.
"""
from copy import deepcopy
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from urllib.parse import urlsplit

from schema_components import ORIGIN, dataset_node, software_entity_id, software_subject_graph


ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'data/catalog.json').read_text())
BY_ID = {item['id']: item for item in CATALOG['tools']}
CATEGORIES = {item['id']: item for item in CATALOG['categories']}
EDITORIAL = json.loads((ROOT / 'data/editorial.json').read_text())
CHECK_BUILT = '--built' in sys.argv
if CHECK_BUILT:
    sys.argv.remove('--built')


def normalized(value):
    return re.sub(r'\s+', ' ', value).strip()


class PageReader(HTMLParser):
    def __init__(self, contents):
        super().__init__(convert_charrefs=True)
        self.excluded = []
        self.parts = []
        self.ids = set()
        self.feed(contents)
        self.visible = normalized(' '.join(self.parts))
        self.graph = json.loads(re.search(
            r'<script\b[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>',
            contents, re.S)[1])['@graph']

    def handle_starttag(self, tag, attrs):
        if tag in ('head', 'script', 'style', 'template'):
            self.excluded.append(tag)
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])

    def handle_endtag(self, tag):
        if tag in self.excluded:
            self.excluded.remove(tag)

    def handle_data(self, value):
        if not self.excluded:
            self.parts.append(value)


def objects(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from objects(item)
    elif isinstance(value, list):
        for item in value:
            yield from objects(item)


class SoftwareSubjectTests(unittest.TestCase):
    def test_every_catalog_tool_has_one_identity_across_page_types(self):
        for tool_id, tool in BY_ID.items():
            with self.subTest(tool=tool_id):
                profile = software_subject_graph([tool_id], BY_ID, CATEGORIES,
                                                 route=f'/tool/{tool_id}/')
                for route in ['/comparisons/example/', '/playbooks/example/']:
                    article = software_subject_graph([tool_id], BY_ID, route=route)
                    self.assertEqual(article['about'], profile['about'])
                    node = article['nodes'][0]
                    self.assertEqual(node['@id'], ORIGIN + '/tool/' + tool_id + '/#software')
                    self.assertEqual(node['name'], tool['name'])
                    self.assertEqual(node['url'], tool['website'])
                    self.assertEqual(set(node), {'@type', '@id', 'name', 'url'})

    def test_richer_fields_are_only_for_the_actual_profile_subject(self):
        subjects = software_subject_graph(['chatgpt', 'claude'], BY_ID, CATEGORIES,
                                          route='/tool/chatgpt/')
        primary, other = subjects['nodes']
        self.assertEqual(primary['description'], BY_ID['chatgpt']['description'])
        self.assertEqual(primary['featureList'], BY_ID['chatgpt']['features'])
        self.assertEqual(primary['applicationSubCategory'], CATEGORIES[BY_ID['chatgpt']['category']]['label'])
        self.assertNotIn('description', other)
        self.assertNotIn('featureList', other)
        self.assertNotIn('applicationSubCategory', other)

    def test_deduplicates_subjects_and_rejects_unknown_or_mismatched_ids(self):
        graph = software_subject_graph(['chatgpt', 'claude', 'chatgpt'], BY_ID,
                                       route='/comparisons/example/')
        self.assertEqual(len(graph['nodes']), 2)
        self.assertEqual(len(graph['about']), 2)
        for tool_id in ['not-in-catalog', '../chatgpt', 'ChatGPT']:
            with self.subTest(tool=tool_id), self.assertRaises(ValueError):
                software_entity_id(tool_id, BY_ID)
        with self.assertRaises(ValueError):
            software_entity_id('chatgpt', {'chatgpt': {'id': 'claude'}})
        with self.assertRaises(ValueError):
            software_subject_graph('chatgpt', BY_ID, route='/playbooks/example/')

    def test_does_not_promote_unverified_source_fields_into_schema(self):
        tools = deepcopy(BY_ID)
        tools['chatgpt'].update({
            'offers': {'price': 0}, 'review': {'reviewRating': 5},
            'aggregateRating': {'ratingValue': 5}, 'datePublished': '2099-01-01',
            'operatingSystem': 'All', 'applicationCategory': 'BusinessApplication',
        })
        graph = software_subject_graph(['chatgpt'], tools, CATEGORIES, route='/tool/chatgpt/')
        node = graph['nodes'][0]
        self.assertTrue({'offers', 'review', 'aggregateRating', 'datePublished',
                         'operatingSystem', 'applicationCategory'}.isdisjoint(node))
        self.assertEqual(BY_ID['chatgpt']['features'], node['featureList'])
        node['featureList'].append('Not a catalog feature')
        self.assertNotIn('Not a catalog feature', tools['chatgpt']['features'])


class DatasetTests(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.output = Path(scratch.name)
        self.downloads = self.output / 'downloads/research'
        self.downloads.mkdir(parents=True)
        (self.downloads / 'plans-example.csv').write_text('tool,checked_at\nChatGPT,2026-11-01\n')
        (self.downloads / 'plans-example.json').write_text('[{"tool":"ChatGPT","checked_at":"2026-11-01"}]')
        self.metadata = {
            'route': '/research/software-plan-costs/',
            'name': 'Software plan costs',
            'description': 'A sourced compilation of public plan facts.',
            'version': 'evidence-example',
            'source_dates': ['2026-11-01'],
            'distributions': [
                {'path': '/downloads/research/plans-example.csv', 'encodingFormat': 'text/csv', 'name': 'CSV'},
                {'path': '/downloads/research/plans-example.json', 'encodingFormat': 'application/json', 'name': 'JSON'},
            ],
            'methodology_url': ORIGIN + '/research/software-plan-costs/#methodology',
            'measurementTechnique': 'Compilation of vendor documentation; not a live price feed.',
            'isBasedOn': ['https://openai.com/chatgpt/pricing/'],
        }

    def test_real_downloads_and_verification_dates_without_fabricated_metadata(self):
        self.metadata.update({'license': 'An unapproved license', 'datePublished': '2099-01-01'})
        node = dataset_node(self.metadata, self.output)
        self.assertEqual(node['@id'], ORIGIN + self.metadata['route'] + '#dataset')
        self.assertEqual(node['publisher'], {'@id': ORIGIN + '/#publisher'})
        self.assertEqual(node['version'], self.metadata['version'])
        self.assertIn('Source records were checked on: 2026-11-01.', node['measurementTechnique'][0])
        self.assertIn(self.metadata['methodology_url'], node['measurementTechnique'])
        self.assertEqual(node['isBasedOn'], self.metadata['isBasedOn'])
        self.assertTrue({'license', 'datePublished', 'dateModified', 'temporalCoverage'}.isdisjoint(node))
        for supplied, actual in zip(self.metadata['distributions'], node['distribution']):
            self.assertEqual(actual['contentUrl'], ORIGIN + supplied['path'])
            self.assertEqual(actual['encodingFormat'], supplied['encodingFormat'])
            self.assertEqual(actual['@type'], 'DataDownload')

    def test_rejects_missing_malformed_or_mislabeled_downloads(self):
        csv_file = self.downloads / 'plans-example.csv'
        for content in ['', 'name\n', 'tool,date\nChatGPT\n', '<html>Not a CSV</html>']:
            csv_file.write_text(content)
            with self.subTest(content=content), self.assertRaises(ValueError):
                dataset_node(self.metadata, self.output)
        csv_file.write_text('tool,date\nChatGPT,2026-11-01\n')
        json_file = self.downloads / 'plans-example.json'
        for content in ['<html>Not JSON</html>', '{}', 'null', '[]']:
            json_file.write_text(content)
            with self.subTest(content=content), self.assertRaises(ValueError):
                dataset_node(self.metadata, self.output)
        json_file.unlink()
        with self.assertRaises(ValueError):
            dataset_node(self.metadata, self.output)

    def test_rejects_external_traversal_duplicate_and_incorrect_distribution_paths(self):
        for path in ['https://other.example/data.csv', '//other.example/data.csv',
                     '/../outside.csv', '/%2e%2e/outside.csv', '/downloads/research/missing.csv']:
            candidate = deepcopy(self.metadata)
            candidate['distributions'][0]['path'] = path
            with self.subTest(path=path), self.assertRaises(ValueError):
                dataset_node(candidate, self.output)
        for change in ['mime', 'duplicate']:
            candidate = deepcopy(self.metadata)
            if change == 'mime':
                candidate['distributions'][0]['encodingFormat'] = 'application/json'
            else:
                candidate['distributions'].append(candidate['distributions'][0])
            with self.subTest(change=change), self.assertRaises(ValueError):
                dataset_node(candidate, self.output)

    def test_rejects_malformed_dates_and_wrong_methodology_location(self):
        for dates in [[], ['Nov 1 2026'], ['2026-02-30']]:
            candidate = {**self.metadata, 'source_dates': dates}
            with self.subTest(dates=dates), self.assertRaises(ValueError):
                dataset_node(candidate, self.output)
        with self.assertRaises(ValueError):
            dataset_node({**self.metadata, 'methodology_url': 'https://other.example/#methodology'}, self.output)


@unittest.skipUnless(CHECK_BUILT, 'Use --built after the normal site build.')
class BuiltSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.output = ROOT / 'dist'
        cls.expected = {f'/tool/{tool_id}/': [tool_id] for tool_id in BY_ID}
        for collection, prefix in [('comparisons', '/comparisons/'), ('playbooks', '/playbooks/')]:
            cls.expected.update({prefix + item['id'] + '/': item['toolIds']
                                 for item in EDITORIAL[collection]})
        cls.expected.update({item['route']: item['toolIds'] for item in
                             json.loads((ROOT / 'data/feature-guides.json').read_text())
                             if item.get('toolIds')})

    def page(self, route):
        return PageReader((self.output / route.lstrip('/') / 'index.html').read_text())

    def test_profiles_and_articles_link_the_same_visible_catalog_entities(self):
        for route, tool_ids in self.expected.items():
            with self.subTest(route=route):
                page = self.page(route)
                expected = software_subject_graph(tool_ids, BY_ID, CATEGORIES, route=route)
                actual = [item for item in page.graph if item.get('@type') == 'SoftwareApplication']
                self.assertEqual(actual, expected['nodes'])
                article = next(item for item in page.graph if item.get('@type') == 'Article')
                webpage = next(item for item in page.graph if item.get('@id') == ORIGIN + route + '#webpage')
                for item in [article, webpage]:
                    self.assertEqual(item.get('about', []), expected['about'])
                    if not expected['about']:
                        self.assertNotIn('about', item, 'A guide without tool subjects should not invent an about relation.')
                for node in actual:
                    self.assertIn(normalized(node['name']), page.visible)
                    for value in [node.get('description'), node.get('applicationSubCategory')]:
                        if value:
                            self.assertIn(normalized(value), page.visible)
                    for feature in node.get('featureList', []):
                        self.assertIn(normalized(feature), page.visible)

    def test_local_graph_references_resolve_and_existing_authorship_is_preserved(self):
        for source in self.output.rglob('*.html'):
            contents = source.read_text()
            if 'application/ld+json' not in contents:
                continue
            with self.subTest(path=str(source.relative_to(self.output))):
                page = PageReader(contents)
                nodes = [item for item in page.graph if item.get('@id')]
                ids = {item['@id'] for item in nodes}
                self.assertEqual(len(nodes), len(ids), 'Duplicate top-level graph identity.')
                for item in objects(page.graph):
                    if set(item) == {'@id'} and item['@id'].startswith(ORIGIN):
                        self.assertIn(item['@id'], ids, 'Unresolved local graph reference.')
                for article in (item for item in page.graph if item.get('@type') == 'Article'):
                    page_id = article['mainEntityOfPage']['@id']
                    canonical = page_id.removesuffix('#webpage')
                    self.assertEqual(article.get('@id'), canonical + '#article')
                    webpage = next(item for item in nodes if item['@id'] == page_id)
                    self.assertEqual(webpage['mainEntity'], {'@id': article['@id']})
                    self.assertEqual(article['publisher']['@id'], ORIGIN + '/#publisher')
                    self.assertEqual(article['author']['@id'], ORIGIN + '/authors/jennie-malone/#person')

    def test_dataset_describes_real_downloads_and_visible_methodology(self):
        route = '/research/software-plan-costs/'
        page = self.page(route)
        dataset = next(item for item in page.graph if item.get('@type') == 'Dataset')
        webpage = next(item for item in page.graph if item.get('@id') == ORIGIN + route + '#webpage')
        self.assertEqual(webpage['mainEntity'], {'@id': ORIGIN + route + '#dataset'})
        self.assertFalse(any(item.get('@type') == 'Article' for item in page.graph))
        self.assertIn('methodology', page.ids)
        self.assertIn(normalized(dataset['name']), page.visible)
        self.assertIn(normalized(dataset['description']), page.visible)
        self.assertTrue({'license', 'datePublished', 'dateModified', 'temporalCoverage'}.isdisjoint(dataset))
        for distribution in dataset['distribution']:
            url = urlsplit(distribution['contentUrl'])
            self.assertEqual(url.scheme + '://' + url.netloc, ORIGIN)
            self.assertFalse(url.query or url.fragment)
            local = self.output / url.path.lstrip('/')
            self.assertTrue(local.is_file())
            self.assertGreater(local.stat().st_size, 0)
            if distribution['encodingFormat'] == 'application/json':
                self.assertTrue(json.loads(local.read_text()))
            else:
                self.assertEqual(distribution['encodingFormat'], 'text/csv')


if __name__ == '__main__':
    unittest.main()
