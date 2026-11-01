"""Reusable working kits and local launch checks; no external service required."""
from hashlib import sha256
from html import escape
from html.parser import HTMLParser


class TemplateReader(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.heading = ''
        self.heading_tag = None
        self.heading_text = []
        self.pre = None
        self.blocks = []
        self.table_rows = None
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag in ('h2', 'h3', 'h4'):
            self.heading_tag, self.heading_text = tag, []
        if tag == 'pre':
            self.pre = []
        if tag == 'table':
            self.table_rows = []
        if tag == 'tr' and self.table_rows is not None:
            self.row = []
        if tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.heading_tag:
            self.heading_text.append(data)
        if self.pre is not None:
            self.pre.append(data)
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag == self.heading_tag:
            self.heading = ' '.join(''.join(self.heading_text).split())
            self.heading_tag = None
        if tag == 'pre' and self.pre is not None:
            self.blocks.append((self.heading or 'Reusable example', ''.join(self.pre).strip()))
            self.pre = None
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.table_rows.append(self.row)
            self.row = None
        if tag == 'table' and self.table_rows is not None:
            self.blocks.append((self.heading or 'Reference table', '\n'.join('\t'.join(row) for row in self.table_rows)))
            self.table_rows = None


def release_checks(record):
    values = record.get('releaseChecks') or [step['check'] for step in record.get('steps', []) if step.get('check')]
    checks = []
    for value in values:
        text = value if isinstance(value, str) else value.get('label') or value.get('text') or value.get('check')
        if not isinstance(text, str) or not text.strip():
            raise ValueError('A release check must contain meaningful text: ' + str(record.get('id', record.get('route'))))
        checks.append(text)
    return checks


def render_launch_checks(record):
    checks = release_checks(record)
    if not checks:
        return ''
    version = sha256('\n'.join(checks).encode()).hexdigest()[:10]
    h = lambda value: escape(str(value), quote=True)
    rows = ''.join(f'<li><label><input type="checkbox" data-workflow-check="{i}"><span>{h(text)}</span></label></li>' for i, text in enumerate(checks))
    return f'''<section class="workflow-workbench" id="launch-checks" data-workflow-checklist="{h(record['id'])}" data-check-version="{version}"><span class="eyebrow">Check your own setup</span><h2>Before you rely on this workflow</h2><p>Work through these checks in your own account. Marking a box records your progress; it does not verify the setup for you.</p><ul class="workflow-checks">{rows}</ul><p data-workflow-progress role="status">0 of {len(checks)} checks completed</p><p class="small muted" data-workflow-storage>With JavaScript enabled, checkmarks can stay in this browser. Download the kit for a portable copy.</p><div class="actions"><button class="button light small" type="button" data-workflow-reset hidden>Reset checks</button><a class="button light small" href="/resources/kits/{h(record['id'])}.txt" download>Download the working kit</a></div></section>'''


def make_working_kit(record, article_html=None):
    lines = [record['title'].upper(), 'Seller Insider Hub | Jennie Malone',
             'Guide: https://sellerinsiderhub.com' + record.get('route', '/playbooks/' + record['id'] + '/'),
             'Sources checked: ' + record.get('lastReviewed', '2026-11-01'), '',
             'WORKING KIT', 'Examples are synthetic. Replace business details and verify the live vendor settings before use.',
             'This file is a reusable worksheet, not proof of a completed vendor-account test.', '']
    if article_html:
        reader = TemplateReader()
        reader.feed(article_html)
        for title, body in reader.blocks:
            lines.extend([title.upper(), '-' * min(len(title), 70), body, ''])
    else:
        example = record.get('example', {})
        if example:
            lines.extend([example.get('title', 'WORKED EXAMPLE'), 'INPUT', example.get('input', ''), '', 'EXPECTED EXAMPLE OUTPUT', example.get('output', ''), ''])
        for item in record.get('copyableTemplates', []):
            lines.extend([item['title'].upper(), item['content'], ''])
        if record.get('configuration'):
            lines.append('FIELD MAPPING')
            for row in record['configuration']:
                lines.extend([row['field'] + ': ' + row['value'], 'Why: ' + row['why'], ''])
    checks = release_checks(record)
    if checks:
        lines.extend(['YOUR RELEASE CHECKLIST', *['[ ] ' + text for text in checks], ''])
    lines.extend(['YOUR DECISION RECORD', 'Product / plan / region:', 'Account owner:', 'Test date:',
                  'What passed:', 'What failed and what changed:', 'Stop or fallback procedure:', 'Next source / workflow check:', '',
                  'SOURCES', *record.get('sourceUrls', []), '',
                  'Method: https://sellerinsiderhub.com/editorial-standards/',
                  'Corrections: https://sellerinsiderhub.com/corrections/', ''])
    return '\n'.join(lines)
