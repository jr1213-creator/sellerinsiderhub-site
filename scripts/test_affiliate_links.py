"""Check referral activation and attribution without visiting any vendor."""
import unittest
from html.parser import HTMLParser

from affiliate_components import approved_tool_actions, outbound


class Links(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.append(dict(attrs))


class AffiliateLinkTests(unittest.TestCase):
    def setUp(self):
        # Reserved .invalid domains are isolated test fixtures, never catalog
        # records, published links, or network requests.
        self.tool = {
            'id': 'fixture-tool', 'name': 'Example & Tool',
            'website': 'https://vendor.invalid/',
            'affiliateStatus': 'approved',
            'affiliateUrl': 'https://referral.invalid/start?partner=fixture&offer=workshop',
        }

    def test_unapproved_records_never_expose_a_referral_action(self):
        for status in ['unverified', 'pending', 'rejected', 'revoked', None]:
            tool = {**self.tool, 'affiliateStatus': status}
            with self.subTest(status=status):
                self.assertEqual(outbound(tool), (tool['website'], 'noopener'))
                self.assertEqual(approved_tool_actions([tool['id']], {tool['id']: tool}, 'tutorial_tools'), '')

    def test_missing_or_unsafe_destination_keeps_the_official_fallback(self):
        for url in [None, '', 'http://referral.invalid/', 'javascript:alert(1)', 123]:
            tool = {**self.tool, 'affiliateUrl': url}
            with self.subTest(url=url):
                self.assertEqual(outbound(tool), (tool['website'], 'noopener'))
                self.assertEqual(approved_tool_actions([tool['id']], {tool['id']: tool}, 'comparison_tools'), '')

    def test_approved_action_preserves_attribution_and_shows_disclosure_first(self):
        for placement in ['tutorial_tools', 'comparison_tools']:
            html = approved_tool_actions([self.tool['id']], {self.tool['id']: self.tool}, placement)
            actions = [a for a in Links(html).links if 'data-outbound' in a]
            with self.subTest(placement=placement):
                self.assertEqual(len(actions), 1)
                self.assertEqual(actions[0]['href'], self.tool['affiliateUrl'])
                self.assertEqual(actions[0]['rel'], 'sponsored nofollow noopener')
                self.assertEqual(actions[0]['target'], '_blank')
                self.assertEqual(actions[0]['data-outbound'], self.tool['id'])
                self.assertEqual(actions[0]['data-outbound-placement'], placement)
                self.assertIn('Example &amp; Tool', html)
                self.assertLess(html.index('We may earn a commission'), html.index('data-outbound='))
                self.assertIn('/legal/affiliate-disclosure/', html)

    def test_only_relevant_tools_render_once_and_unknown_ids_are_ignored(self):
        unrelated = {**self.tool, 'id': 'unrelated-tool'}
        catalog = {self.tool['id']: self.tool, unrelated['id']: unrelated}
        html = approved_tool_actions(['missing', self.tool['id'], self.tool['id']], catalog, 'tutorial_tools')
        actions = [a for a in Links(html).links if 'data-outbound' in a]
        self.assertEqual([a['data-outbound'] for a in actions], [self.tool['id']])
        self.assertEqual(html.count('We may earn a commission'), 1)


if __name__ == '__main__':
    unittest.main()
