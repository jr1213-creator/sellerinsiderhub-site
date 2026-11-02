#!/usr/bin/env python3
"""Check provenance, billing units, exact archive bytes, and publication wiring.

Run with --built after the root build to verify the generated page and downloads.
These tests do not contact vendors or modify the reviewed source archive.
"""
from copy import deepcopy
import csv
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

from research_components import (
    ARCHIVE, DOWNLOAD_ROOT, FILE_PREFIX, ROOT, ROUTE,
    build_research_asset, make_snapshot, snapshot_files,
)

ORIGIN = 'https://sellerinsiderhub.com'
EVIDENCE = json.loads((ROOT / 'data/decision-evidence.json').read_text())
BUILT = '--built' in sys.argv
if BUILT:
    sys.argv.remove('--built')


class ResearchDataTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.base = Path(self.scratch.name)
        self.archive = self.base / 'archive'
        self.archive.mkdir()
        self.snapshot = make_snapshot(EVIDENCE, ORIGIN)
        for name, content in snapshot_files(self.snapshot).items():
            (self.archive / name).write_bytes(content)
        self.output = self.base / 'public'

    def build(self, evidence=None):
        return build_research_asset(evidence or EVIDENCE, ORIGIN, self.output, self.archive)

    def archive_release(self, evidence):
        for name, content in snapshot_files(make_snapshot(evidence, ORIGIN)).items():
            (self.archive / name).write_bytes(content)

    def test_reviewed_sample_preserves_sources_dates_units_and_unknown_states(self):
        self.assertEqual(self.snapshot['counts'], {'observations': 17, 'tools': 8, 'contexts': 4, 'sources': 18})
        self.assertEqual(self.snapshot['source_dates'], ['2026-11-01'])
        rows = {row['observation_id']: row for row in self.snapshot['observations']}
        self.assertEqual(rows['mailerlite:free']['monthly_payment_usd'], 0)
        self.assertEqual(rows['mailerlite:free']['monthly_price_status'], 'no_charge')
        self.assertIsNone(rows['zapier:professional-750']['monthly_payment_usd'])
        self.assertEqual(rows['zapier:professional-750']['monthly_price_status'], 'unknown')
        self.assertEqual(rows['chatgpt:plus']['annual_price_status'], 'not_offered')
        self.assertEqual(rows['make:core-10000']['annual_price_status'], 'unknown')
        self.assertEqual(rows['kit:creator-1000']['limits']['emailsPerMonthMax']['state'], 'unlimited')
        self.assertEqual(rows['make:free']['limits']['actionStepsMax']['state'], 'not_metered')
        self.assertEqual(rows['metricool:starter-5']['features']['x']['state'], 'unknown')
        self.assertEqual(rows['metricool:starter-5']['fair_use_review_threshold'],
                         {'posts_per_brand_per_month': 600, 'is_hard_cap': False})
        self.assertEqual(rows['buffer:essentials']['billing_unit'], 'channel')
        self.assertEqual(rows['buffer:essentials']['price_scope']['maxQuantity'], 10)
        self.assertEqual(rows['metricool:starter-5']['billing_unit'], 'flat')
        self.assertEqual(rows['mailerlite:comfort-500']['annual_amount_basis'],
                         'derived_from_recorded_monthly_price_and_annual_discount')
        self.assertEqual(rows['zapier:professional-750']['annual_amount_basis'],
                         'derived_from_recorded_annual_monthly_equivalent')
        self.assertNotIn('license', self.snapshot)
        self.assertNotIn('datePublished', self.snapshot)
        self.assertNotIn('dateModified', self.snapshot)

    def test_exports_are_deterministic_without_mutating_or_leaking_extra_source_fields(self):
        evidence = deepcopy(EVIDENCE)
        before = deepcopy(evidence)
        first = make_snapshot(evidence, ORIGIN)
        self.assertEqual(evidence, before)
        evidence['tools'] = dict(reversed(list(evidence['tools'].items())))
        evidence['sources'].reverse()
        evidence['comparisons'].reverse()
        self.assertEqual(snapshot_files(first), snapshot_files(make_snapshot(evidence, ORIGIN)))
        evidence['privateAccountNotes'] = 'PRIVATE_SENTINEL'
        evidence['tools']['chatgpt']['privateAccountNotes'] = 'PRIVATE_SENTINEL'
        evidence['tools']['chatgpt']['plans'][0]['privateAccountNotes'] = 'PRIVATE_SENTINEL'
        exported = snapshot_files(make_snapshot(evidence, ORIGIN))
        self.assertEqual(exported, snapshot_files(first))
        self.assertNotIn(b'PRIVATE_SENTINEL', b''.join(exported.values()))

    def test_csv_preserves_blank_unknowns_and_readable_structured_cells(self):
        content = next(value for name, value in snapshot_files(self.snapshot).items() if name.endswith('.csv'))
        rows = {row['observation_id']: row for row in csv.DictReader(io.StringIO(content.decode('utf-8')))}
        self.assertEqual(len(rows), 17)
        self.assertEqual(rows['mailerlite:free']['monthly_payment_usd'], '0')
        self.assertEqual(rows['zapier:professional-750']['monthly_payment_usd'], '')
        self.assertEqual(rows['zapier:professional-750']['monthly_price_status'], 'unknown')
        self.assertEqual(rows['claude:pro']['annual_total_usd'], '200')
        self.assertEqual(rows['claude:pro']['annual_monthly_equivalent_usd'], '16.67')
        self.assertEqual(json.loads(rows['buffer:essentials']['price_scope'])['maxQuantity'], 10)
        self.assertTrue(all(url.startswith('https://') for url in json.loads(rows['claude:pro']['source_urls'])))

    def test_worked_arithmetic_matches_existing_calculator_boundaries(self):
        script = """
const fs = require('node:fs');
const model = require('./site-assets/decision-tools.js');
const evidence = JSON.parse(fs.readFileSync('./data/decision-evidence.json'));
const defaults = id => evidence.comparisons.find(c => c.id === id).calculator.defaults;
const email = model.deriveMetrics('email', defaults('mailerlite-vs-kit'));
const automation = model.deriveMetrics('automation', defaults('zapier-vs-make'));
const social = model.pricePlan(evidence.tools.buffer.plans.find(p => p.id === 'essentials'),
                              defaults('buffer-vs-metricool'), {});
process.stdout.write(JSON.stringify({email, automation, social}));
"""
        checked = json.loads(subprocess.check_output(['node', '-e', script], cwd=ROOT, text=True))
        scenarios = {item['id']: item for item in self.snapshot['scenarios']}
        self.assertEqual(scenarios['email-send-volume']['results']['estimated_sends_per_month'],
                         checked['email']['emailsPerMonth'])
        self.assertEqual(checked['email']['emailsPerMonth'], 1075)
        self.assertEqual(scenarios['automation-usage']['results'],
                         {'estimated_zapier_tasks_per_month': checked['automation']['tasksPerMonth'],
                          'estimated_make_credits_per_month': checked['automation']['creditsPerMonth']})
        self.assertEqual(checked['automation']['tasksPerMonth'], 200)
        self.assertEqual(checked['automation']['creditsPerMonth'], 300)
        self.assertEqual(scenarios['paid-social-channels']['results'],
                         {'monthly_payment_usd': checked['social']['monthly'],
                          'annual_charge_usd': checked['social']['annualTotal']})
        self.assertEqual(scenarios['individual-assistant-billing']['results'],
                         {'plus_twelve_monthly_payments_usd': 240.0, 'claude_annual_charge_usd': 200,
                          'claude_annual_monthly_equivalent_usd': 16.67})

    def test_invalid_prices_dates_currencies_and_unresolved_sources_fail_closed(self):
        for field, value in [('monthlyUsd', -1), ('annualTotalUsd', float('nan')),
                             ('currency', 'EUR'), ('checkedAt', 'today'), ('sourceIds', ['missing-source'])]:
            evidence = deepcopy(EVIDENCE)
            evidence['tools']['chatgpt']['plans'][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                make_snapshot(evidence, ORIGIN)
        evidence = deepcopy(EVIDENCE)
        evidence['sources'][0]['url'] = 'javascript:alert(1)'
        with self.assertRaises(ValueError):
            make_snapshot(evidence, ORIGIN)

    def test_new_current_version_keeps_old_public_bytes_and_never_rewrites_archive(self):
        initial = {path.name: path.read_bytes() for path in self.archive.iterdir()}
        previous = self.build()
        revised = deepcopy(EVIDENCE)
        revised['tools']['chatgpt']['plans'][0]['scope'] += ' Revised scope for this test.'
        with self.assertRaisesRegex(ValueError, 'Archive the reviewed current research release'):
            self.build(revised)
        self.archive_release(revised)
        archived_before_build = {path.name: path.read_bytes() for path in self.archive.iterdir()}
        next_release = self.build(revised)
        self.assertNotEqual(previous['snapshot_id'], next_release['snapshot_id'])
        self.assertEqual(len(next_release['published_files']), 4)
        for name, content in initial.items():
            self.assertEqual((self.output / DOWNLOAD_ROOT.lstrip('/') / name).read_bytes(), content)
            self.assertEqual((self.archive / name).read_bytes(), content)
        self.assertEqual({path.name: path.read_bytes() for path in self.archive.iterdir()}, archived_before_build)

    def test_corrupt_missing_or_unpaired_archives_cannot_silently_publish(self):
        csv_path = next(self.archive.glob('*.csv'))
        original = csv_path.read_bytes()
        csv_path.write_bytes(original + b'changed')
        with self.assertRaises(ValueError):
            self.build()
        csv_path.write_bytes(original)
        csv_path.unlink()
        with self.assertRaises(ValueError):
            self.build()
        csv_path.write_bytes(original)
        (self.archive / (FILE_PREFIX + 'f' * 16 + '.csv')).write_text('orphan')
        with self.assertRaises(ValueError):
            self.build()

    def test_body_is_static_escaped_and_keeps_downloads_and_methodology_explicit(self):
        evidence = deepcopy(EVIDENCE)
        evidence['tools']['chatgpt']['plans'][0]['name'] = '<script>alert("source")</script>'
        self.archive_release(evidence)
        result = self.build(evidence)
        self.assertNotIn('<script>', result['body'])
        self.assertIn('&lt;script&gt;', result['body'])
        self.assertNotIn('<h1', result['body'])
        self.assertIn('id="methodology"', result['body'])
        self.assertIn('No annual option', result['body'])
        self.assertIn('Derived total', result['body'])
        self.assertIn('Not recorded', result['body'])
        self.assertIn('Full-list broadcasts per month: 4', result['body'])
        self.assertIn('Estimated recipient sends per month: 1,075', result['body'])
        self.assertIn('Premium app required: No', result['body'])
        self.assertIn('Selected plan: Buffer Essentials', result['body'])
        self.assertNotIn('broadcastsPerMonth', result['body'])
        self.assertNotIn('estimated_sends_per_month', result['body'])
        self.assertEqual(result['dataset_metadata']['source_dates'], ['2026-11-01'])
        self.assertEqual(len(result['dataset_metadata']['isBasedOn']), 18)
        for download in result['downloads']:
            self.assertIn('href="' + download['path'] + '"', result['body'])
            self.assertTrue((self.output / download['path'].lstrip('/')).is_file())

    def test_reviewed_initial_archive_is_present_and_valid(self):
        result = build_research_asset(EVIDENCE, ORIGIN, self.output, ARCHIVE)
        self.assertEqual(result['snapshot_id'], self.snapshot['snapshot_id'])
        self.assertGreaterEqual(len(list(ARCHIVE.glob('*.json'))), 1)
        self.assertTrue((ARCHIVE / (FILE_PREFIX + result['snapshot_id'] + '.json')).is_file(),
                        'Archive a reviewed current release before publishing it.')

    @unittest.skipUnless(BUILT, 'Use --built after site generation.')
    def test_built_page_schema_and_downloads_match_the_reviewed_release(self):
        output = ROOT / 'dist'
        page = (output / ROUTE.lstrip('/') / 'index.html').read_text()
        self.assertIn(ORIGIN + ROUTE, page)
        self.assertIn(self.snapshot['snapshot_id'], page)
        self.assertIn('2026-11-01', page)
        self.assertIn('id="methodology"', page)
        self.assertIn('<h1', page)
        blocks = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', page, re.S)
        nodes = [node for block in blocks for node in json.loads(block).get('@graph', [])]
        datasets = [node for node in nodes if node.get('@type') == 'Dataset']
        self.assertEqual(len(datasets), 1)
        self.assertEqual(datasets[0]['version'], self.snapshot['snapshot_id'])
        for name, content in snapshot_files(self.snapshot).items():
            path = DOWNLOAD_ROOT + name
            self.assertIn(path, page)
            self.assertEqual((output / path.lstrip('/')).read_bytes(), content)
        for archive in ARCHIVE.glob(FILE_PREFIX + '*'):
            self.assertEqual((output / DOWNLOAD_ROOT.lstrip('/') / archive.name).read_bytes(), archive.read_bytes())


if __name__ == '__main__':
    unittest.main()
