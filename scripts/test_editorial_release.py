"""Check the reader-facing contract of researched guides, kits, and authorship."""
import json
import re
import unittest
from pathlib import Path
from html import unescape
from tutorial_tools import TemplateReader
from validate_site import Validator, ORIGIN

ROOT = Path(__file__).resolve().parents[1]


class EditorialReleaseTests(unittest.TestCase):
    def test_complete_reusable_material_survives_download_generation(self):
        plays = json.loads((ROOT/'data/editorial.json').read_text())['playbooks']
        guides = json.loads((ROOT/'data/feature-guides.json').read_text())
        for record in plays + guides:
            if not record.get('bodyFile'):
                continue
            kit_id = record.get('kitId') or record['id']
            reader = TemplateReader()
            reader.feed((ROOT/record['bodyFile']).read_text())
            kit = (ROOT/f'dist/resources/kits/{kit_id}.txt').read_text()
            with self.subTest(kit=kit_id):
                self.assertTrue(reader.blocks, 'A promised kit must contain reusable material.')
                for title, block in reader.blocks:
                    self.assertIn(block, kit, 'A table or copy block was lost from the kit: '+title)
                self.assertNotIn('root-integration-needed', kit)
                self.assertNotIn('Live vendor execution\n', kit)

    def test_copy_buttons_and_ids_are_unambiguous(self):
        for source in (ROOT/'content').glob('*expanded.html'):
            text = source.read_text()
            ids = re.findall(r'\bid="([^"]+)"', text)
            with self.subTest(article=source.name):
                self.assertEqual(len(ids), len(set(ids)), 'Duplicate IDs can copy the wrong example.')
                for target in re.findall(r'data-copy-target="([^"]+)"', text):
                    self.assertEqual(ids.count(target), 1)
                    self.assertRegex(text, r'<pre\b[^>]*\bid="'+re.escape(target)+'"')
                for image in re.findall(r'<img\b[^>]+>', text):
                    self.assertRegex(image, r'\balt="[^"]+"')
                    self.assertRegex(image, r'\bwidth="\d+"')
                    self.assertRegex(image, r'\bheight="\d+"')

    def test_historical_search_entry_reaches_complete_guide(self):
        validator = Validator(ROOT/'dist')
        validator.load_redirects()
        for route in ['/tools/ai-assistant-tools', '/tools/ai-assistant-tools/', '/tools/ai-assistant-tools.html']:
            path, final, error = validator.resolve(ORIGIN+route)
            self.assertIsNone(error)
            self.assertEqual(final, ORIGIN+'/tools/ai-assistant/')
            self.assertIn('five-task-trial', path.read_text())

    def test_author_identity_and_note_are_outside_alternative_cards(self):
        for route in ['tool/chatgpt', 'comparisons/mailerlite-vs-kit', 'tools/ai-assistant']:
            text = (ROOT/'dist'/route/'index.html').read_text()
            with self.subTest(route=route):
                self.assertIn('rel="author" href="/authors/jennie-malone/"', text)
                self.assertEqual(text.count('<aside class="author-note"'), 1)
                self.assertGreater(text.index('<aside class="author-note"'), text.find('id="research-record"'))
                graph = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)[1])['@graph']
                article = next(x for x in graph if x.get('@type') == 'Article')
                self.assertEqual(article['author']['name'], 'Jennie Malone')
                self.assertEqual(article['author']['url'], ORIGIN+'/authors/jennie-malone/')


if __name__ == '__main__':
    unittest.main()
