#!/usr/bin/env python3
"""Regressions for Netlify's trailing-slash matching and legacy entry URLs."""

from pathlib import Path
import tempfile
import unittest

from validate_site import ORIGIN, Validator


class RedirectTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.dist = Path(self.directory.name)
        page = self.dist / 'tools/ai-assistant/index.html'
        page.parent.mkdir(parents=True)
        page.write_text('<h1>AI assistant</h1>')

    def tearDown(self):
        self.directory.cleanup()

    def validator(self, rules):
        (self.dist / '_redirects').write_text(rules)
        validator = Validator(self.dist)
        validator.load_redirects()
        self.assertEqual(validator.errors, [])
        return validator

    def test_forced_slash_only_redirects_loop_in_both_directions(self):
        for source, destination in [
            ('/tools/ai-assistant', '/tools/ai-assistant/'),
            ('/tools/ai-assistant/', '/tools/ai-assistant'),
        ]:
            validator = self.validator(f'{source} {destination} 301!\n')
            for entry in ['/tools/ai-assistant', '/tools/ai-assistant/']:
                with self.subTest(source=source, entry=entry):
                    _, _, problem = validator.resolve(ORIGIN + entry)
                    self.assertEqual(problem, 'redirect loop')

    def test_html_alias_reaches_the_canonical_page(self):
        validator = self.validator('/tools/ai-assistant.html /tools/ai-assistant/ 301!\n')
        target, final, problem = validator.resolve(ORIGIN + '/tools/ai-assistant.html')
        self.assertIsNone(problem)
        self.assertEqual(target, self.dist / 'tools/ai-assistant/index.html')
        self.assertEqual(final, ORIGIN + '/tools/ai-assistant/')

    def test_a_real_migration_accepts_both_source_slash_forms(self):
        for source in ['/old-assistant', '/old-assistant/']:
            validator = self.validator(f'{source} /tools/ai-assistant/ 301!\n')
            for entry in ['/old-assistant', '/old-assistant/']:
                with self.subTest(source=source, entry=entry):
                    target, final, problem = validator.resolve(ORIGIN + entry)
                    self.assertIsNone(problem)
                    self.assertTrue(target.is_file())
                    self.assertEqual(final, ORIGIN + '/tools/ai-assistant/')

    def test_an_existing_file_shadows_an_unforced_rule(self):
        validator = self.validator('/tools/ai-assistant /tools/ai-assistant/ 301\n')
        target, _, problem = validator.resolve(ORIGIN + '/tools/ai-assistant/')
        self.assertIsNone(problem)
        self.assertTrue(target.is_file())


if __name__ == '__main__':
    unittest.main()
