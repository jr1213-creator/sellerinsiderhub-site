#!/usr/bin/env python3
"""Release checks for the protected room's bundle and public exposure boundary."""
from pathlib import Path
from html.parser import HTMLParser
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / 'private/investor'
errors = []

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.scripts = []
        self.inline_handlers = []
        self.robots = ''
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag == 'link' and a.get('rel') == 'stylesheet': self.links.append(a.get('href', ''))
        if tag == 'script' and a.get('src'): self.scripts.append(a['src'])
        if tag == 'meta' and a.get('name') == 'robots': self.robots = a.get('content', '')
        for key in a:
            if key.startswith('on') or key == 'style': self.inline_handlers.append(key)

for name in ['index.html','investor.css','investor.js','investor-model.js']:
    if not (PRIVATE / name).is_file():
        errors.append('Missing function-bundled file: ' + name)
if not errors:
    p = Page()
    page = (PRIVATE / 'index.html').read_text()
    p.feed(page)
    if len(p.ids) != len(set(p.ids)): errors.append('Duplicate private-page IDs.')
    if 'noindex' not in p.robots: errors.append('Private page must be noindex.')
    if p.inline_handlers: errors.append('Inline executable handlers/styles conflict with the protected CSP.')
    if any(not url.startswith('/partners/investors/') for url in p.links+p.scripts):
        errors.append('Private application assets must use protected routes.')
    for asset in p.links+p.scripts:
        if not (PRIVATE / asset.rsplit('/',1)[-1]).is_file(): errors.append('Missing private asset: ' + asset)
    for marker in ['@@MARKET_CARDS@@','@@DATA@@','@@APPROVED@@']:
        if marker in page: errors.append('Unreplaced build marker.')
    used_ids = re.findall(r"\$\('([^']+)'\)", (PRIVATE / 'investor.js').read_text())
    for used in set(used_ids)-set(p.ids): errors.append('UI references missing element: ' + used)

dist = ROOT / 'dist'
for file in dist.rglob('*'):
    if file.is_file() and (file.name.startswith('investor') or 'private' in file.relative_to(dist).parts):
        errors.append('Private room artifact exposed in static publish directory: '+str(file.relative_to(dist)))
if '/partners/investors/' in (dist / 'sitemap.xml').read_text():
    errors.append('Private room is in the public sitemap.')
if '/partners/investors/' in (dist / 'data/search-index.json').read_text():
    errors.append('Private room is in the public search index.')
if 'href="/partners/investors/"' not in (dist / 'partners/index.html').read_text():
    errors.append('Public Partners page has no investor entry point.')
if 'private/investor/**' not in (ROOT / 'netlify.toml').read_text():
    errors.append('Function bundle configuration is missing private files.')

print(json.dumps({'investor_bundle':'PASS' if not errors else 'FAIL','private_assets':4,'errors':errors},indent=2))
sys.exit(1 if errors else 0)
