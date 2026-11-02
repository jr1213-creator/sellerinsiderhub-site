#!/usr/bin/env python3
"""Build the complete static publication using only the Python standard library."""
from pathlib import Path
from html import escape, unescape
import json, re, shutil, csv, io
from hashlib import sha256
from editorial_components import render_home, story_card, tutorial_extras, tutorial_troubleshooting, tutorial_templates
from publication_components import named_sources, comparison_details, tool_details, related_guides, source_link, table as publication_table, business_article, feature_article
from investor_components import build_investor_room
from authority_components import author_schema, byline as render_byline, author_note, author_profile, editorial_standards, corrections_page
from tutorial_tools import render_launch_checks, make_working_kit
from decision_components import render_decision_tool
from affiliate_components import outbound, approved_tool_actions, expand_approved_tool_markers, is_approved_affiliate
from learning_components import render_learning_path
from brand_components import brand_link, brand_head
from editorial_images import article_figure, cover_credit, page_image, image_url
from feed_components import write_feeds, write_pinterest_feed
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
ASSET_VERSION = sha256(b''.join((ROOT/path).read_bytes() for path in ['site-assets/hub.css','site-assets/hub.js','site-assets/social-guide.js','site-assets/tutorial-tools.js','site-assets/tutorial-tools.css','site-assets/decision-tools.js','site-assets/decision-tools.css','data/decision-evidence.json','data/catalog.json','data/vendor-icons.json','data/editorial.json','data/editorial-images.json','data/business-guides.json','data/feature-guides.json','data/learning-paths.json','site-assets/learning-tools.js','site-assets/learning-tools.css'])).hexdigest()[:12]
DATE = '2026-10-31'
REVIEW_DATE = '2026-11-01'
ORIGIN = 'https://sellerinsiderhub.com'
PAGES = []
SEARCH = []
FEED = []

def e(value): return escape(str(value), quote=True)
def load(name): return json.loads((ROOT / 'data' / name).read_text(encoding='utf-8-sig'))
def plain(value): return unescape(re.sub(r'<[^>]+>', ' ', value)).strip()
def j(value): return json.dumps(value, ensure_ascii=False).replace('<','\\u003c')
CATALOG = load('catalog.json')
VENDOR_ICONS = load('vendor-icons.json')['icons']
EDITORIAL = load('editorial.json')
LEARNING_PATH = load('learning-paths.json')
DECISION_EVIDENCE = load('decision-evidence.json')
PAGE_DATES = load('page-dates.json') if (ROOT/'data/page-dates.json').exists() else {}
TOOLS = CATALOG['tools']
for tool in TOOLS:
    tool['logo'] = VENDOR_ICONS[tool['id']]['path']
BY_ID = {t['id']: t for t in TOOLS}
CATEGORIES = {c['id']: c for c in CATALOG['categories']}
PLAYS = EDITORIAL['playbooks']
COMPARISONS = EDITORIAL['comparisons']
AUDIENCES = {'ecommerce':'Ecommerce sellers','etsy':'Etsy & handmade','creators':'Creators','services':'Service businesses','local':'Local businesses','teams':'Small teams'}
SYMBOLS = {'ai-assistants':'✳','automation':'↗','email':'✉','ecommerce':'▱','seo':'◎','crm':'◉','design':'◈','productivity':'▦','scheduling':'◷','customer-service':'◌','reviews':'☆','social-media':'↗','phone-systems':'⌁','video-audio':'▷'}
ICONS = {
 'search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 'bookmark':'<path d="M6 3h12v18l-6-4-6 4z"/>',
 'arrow':'<path d="M4 12h15m-6-6 6 6-6 6"/>',
 'close':'<path d="m5 5 14 14M19 5 5 19"/>',
 'menu':'<path d="M3 6h18M3 12h18M3 18h18"/>',
 'compare':'<path d="M5 4v16M19 4v16M2 8h6m8 8h6M12 3v18"/>',
 'download':'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'}
def icon(name): return '<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[name]+'</svg>'
def btn(label,href,style=''): return f'<a class="button {style}" href="{e(href)}">{label}</a>'
def tool_logo(t): return f'<span class="tool-logo" aria-hidden="true"><img src="{e(t["logo"])}" alt="" width="40" height="40" loading="lazy" decoding="async"></span>'
def category_label(t): return CATEGORIES.get(t['category'],{}).get('label',t['category'])
def toolcard(t):
    free = 'Free plan' if t.get('freePlan') is True else ('Paid plans' if t.get('freePlan') is False else 'Check current plans')
    return f'''<article class="card tool-card" data-tool-card="{e(t['id'])}" data-category="{e(t['category'])}">
      <div class="tool-card-head">{tool_logo(t)}<div><h3><a href="/tool/{e(t['id'])}/">{e(t['name'])}</a></h3><span class="tool-category">{e(category_label(t))}</span></div><button class="icon-button" data-save-tool="{e(t['id'])}" aria-pressed="false" aria-label="Save {e(t['name'])}">{icon('bookmark')}</button></div>
      <p class="tool-description">{e(t['tagline'])}</p><div class="tool-meta"><span class="chip green">{free}</span><span class="chip">{e(t.get('setup','Moderate'))} setup</span></div>
      <div class="tool-bottom"><button class="text-button" data-compare-tool="{e(t['id'])}" aria-pressed="false">{icon('compare')} Compare</button><a class="text-button" href="/tool/{e(t['id'])}/">Explore tool ↗</a></div></article>'''
def comparecard(c):
    ts=[BY_ID[x] for x in c['toolIds'] if x in BY_ID]
    logos='<span>vs</span>'.join(tool_logo(t) for t in ts[:2])
    return f'<a class="card comparison-card card-link" href="/comparisons/{e(c["id"])}/"><div class="comparison-icons">{logos}</div><h3>{e(c["title"])}</h3><p>{e(c["summary"])}</p><span class="read-link">Read the comparison →</span></a>'
def playcard(p,i=0):
    return story_card(p,i)

def sources(urls):
    return '<ul class="source-list">'+''.join(f'<li><a href="{e(u)}" target="_blank" rel="noopener">{e(u.split("//")[-1])} ↗</a></li>' for u in dict.fromkeys(urls))+'</ul>'
def evidence(urls, record=None): return named_sources(record or {}, urls)
def breadcrumb(title,parent=None):
    return '<div class="breadcrumbs"><a href="/">Home</a><span>/</span>'+ (f'<a href="{e(parent[1])}">{e(parent[0])}</a><span>/</span>' if parent else '')+f'<span>{e(title)}</span></div>'
def hero(title,desc,label='The insider guide',parent=None,disclosure=''):
    metadata = f'<span class="eyebrow">{e(label)}</span>'
    if disclosure:
        metadata = f'<div class="article-meta">{metadata}<span class="article-disclosure">{e(disclosure)}</span></div>'
    return f'<section class="page-hero"><div class="wrap">{breadcrumb(title,parent)}{metadata}<h1>{e(title)}</h1><p>{e(desc)}</p></div></section>'
def newsletter():
    return '''<section class="section"><div class="wrap"><div class="newsletter-panel"><div><span class="eyebrow">The Insider Edit</span><h2>Keep up with tools worth understanding.</h2><p>Get new tutorials and meaningful updates on software for selling, marketing, and running a small business.</p></div><form class="newsletter-form" name="sih-newsletter" method="POST" data-netlify="true" netlify-honeypot="website" action="/thank-you/" data-newsletter-form><input type="hidden" name="form-name" value="sih-newsletter"><p hidden><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></p><label for="newsletter-email">Your email address</label><div class="email-input-row"><input id="newsletter-email" type="email" name="email" autocomplete="email" required placeholder="you@yourbusiness.com"><button class="button lime" type="submit">Join the list ↗</button></div><label class="consent-label"><input type="checkbox" name="consent" value="yes" required><span>I agree to receive Seller Insider Hub emails and have read the <a href="/legal/privacy/">privacy policy</a>. I can unsubscribe from any email.</span></label><p class="form-status" role="status"></p></form></div></div></section>'''
def layout(title,desc,content,route,section='',legacy=False,noindex=False,extrahead='',article=None):
    selected_image = page_image(route)
    social_url = ORIGIN + image_url(selected_image, 'social.jpg') if selected_image else ORIGIN + '/assets/brand/seller-insider-hub-social.png'
    social_width = selected_image['socialWidth'] if selected_image else 1200
    social_height = selected_image['socialHeight'] if selected_image else 630
    social_alt = selected_image['alt'] if selected_image else 'Seller Insider Hub — practical AI guides for small business.'
    extrahead += '<link rel="alternate" type="application/rss+xml" title="Seller Insider Hub tutorials and guides" href="/feed.xml"><link rel="alternate" type="application/atom+xml" title="Seller Insider Hub tutorials and guide updates" href="/atom.xml">'
    extrahead += f'<link rel="stylesheet" href="/assets/css/tutorial-tools.css?v={ASSET_VERSION}"><link rel="stylesheet" href="/assets/css/learning-tools.css?v={ASSET_VERSION}">'
    if article:
        # Alternative cards use nested article elements. Match the main article's
        # sidebar boundary, never the first closing article inside a card.
        content, author_insertions = re.subn(r'(</article>\s*<aside class="detail-sidebar")',lambda m:author_note()+m.group(1),content,count=1)
        if not author_insertions:
            content += '<div class="wrap simple-article">'+author_note()+'</div>'
        extrahead += f'<script defer src="/assets/js/tutorial-tools.js?v={ASSET_VERSION}"></script>'
    content=content.replace('<div class="table-scroll">','<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table">')
    if article:
        toc_match=re.search(r'<nav class="toc"[^>]*>(.*?)</nav>',content,re.S)
        if toc_match:
            mobile_toc='<details class="mobile-article-nav"><summary>On this page</summary><nav class="toc" aria-label="Article contents">'+toc_match.group(1)+'</nav></details>'
            content=re.sub(r'(<article class="article-body[^"]*">)',lambda m:m.group(1)+mobile_toc,content,count=1)
    nav=[('Learn','/learn/ai-for-small-business/','learn'),('Tutorials','/playbooks/','playbooks'),('Compare','/comparisons/','compare'),('Tool guides','/tool-library/','tools'),('Business guides','/business-types/','business'),('Resources','/resources/','resources')]
    navhtml=''.join(f'<a class="{"active" if section==key else ""}" href="{url}">{label}</a>' for label,url,key in nav)
    publisher={'@type':'Organization','@id':ORIGIN+'/#publisher','name':'Seller Insider Hub','url':ORIGIN,'legalName':'The Local Upgrade LLC','logo':{'@type':'ImageObject','url':ORIGIN+'/assets/brand/icon-512.png','width':512,'height':512},'founder':{'@type':'Person','name':'Jennie Malone','url':ORIGIN+'/about/'}}
    webpage={'@type':'WebPage','@id':ORIGIN+route+'#webpage','name':title,'description':desc,'url':ORIGIN+route,'isPartOf':{'@id':ORIGIN+'/#website'},'publisher':{'@id':ORIGIN+'/#publisher'}}
    if selected_image:
        webpage['primaryImageOfPage'] = {'@type':'ImageObject','url':social_url,'width':social_width,'height':social_height,'caption':selected_image['credit']}
    graph=[publisher,author_schema(ORIGIN),{'@type':'WebSite','@id':ORIGIN+'/#website','name':'Seller Insider Hub','url':ORIGIN,'publisher':{'@id':ORIGIN+'/#publisher'}},webpage]
    if route == '/authors/jennie-malone/':
        webpage['@type'] = 'ProfilePage'
        webpage['mainEntity'] = {'@id': ORIGIN + route + '#person'}
    if route!='/':
        crumbs=[{'@type':'ListItem','position':1,'name':'Home','item':ORIGIN+'/'}]
        parent={'playbooks':('Tutorials','/playbooks/'),'comparisons':('Comparisons','/comparisons/'),'tool':('Tool guides','/tool-library/'),'business-types':('Business guides','/business-types/')}.get(route.strip('/').split('/')[0])
        if parent and parent[1]!=route: crumbs.append({'@type':'ListItem','position':2,'name':parent[0],'item':ORIGIN+parent[1]})
        crumbs.append({'@type':'ListItem','position':len(crumbs)+1,'name':title,'item':ORIGIN+route})
        graph.append({'@type':'BreadcrumbList','itemListElement':crumbs})
    if article:
        graph.append({'@type':'Article','headline':title,'description':desc,'mainEntityOfPage':{'@id':ORIGIN+route+'#webpage'},'author':author_schema(ORIGIN),'publisher':{'@id':ORIGIN+'/#publisher'},'datePublished':article.get('published',DATE),'dateModified':article.get('modified',DATE),'inLanguage':'en-US','citation':article.get('sources',[])})
    if article and selected_image:
        graph[-1]['image'] = webpage['primaryImageOfPage']
    schema={'@context':'https://schema.org','@graph':graph}
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)} | Seller Insider Hub</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{ORIGIN+route}"><meta name="theme-color" content="#11402d"><meta property="og:title" content="{e(title)} | Seller Insider Hub"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{ORIGIN+route}"><meta property="og:type" content="{'article' if article else 'website'}"><meta property="og:image" content="{e(social_url)}"><meta property="og:image:width" content="{social_width}"><meta property="og:image:height" content="{social_height}"><meta property="og:image:alt" content="{e(social_alt)}"><meta name="twitter:image" content="{e(social_url)}"><meta name="twitter:image:alt" content="{e(social_alt)}"><meta name="twitter:card" content="summary_large_image">{brand_head()}{'<meta name="robots" content="noindex,follow">' if noindex else ''}{'<link rel="stylesheet" href="/assets/css/styles.css">' if legacy else ''}{extrahead}<link rel="stylesheet" href="/assets/css/hub.css?v={ASSET_VERSION}"><script type="application/ld+json">{j(schema)}</script><script defer src="/assets/js/hub.js?v={ASSET_VERSION}"></script></head><body class="site-body">{'<div class="reading-progress" aria-hidden="true"><span></span></div>' if article else ''}<a class="skip-link" href="#main">Skip to content</a><div class="announcement">Practical AI guidance for businesses without an IT department. <a href="/about/">Our mission →</a></div><header class="site-header"><div class="wrap site-header-main">{brand_link()}<nav class="main-nav" aria-label="Main navigation">{navhtml}</nav><div class="nav-actions"><button class="icon-button" data-open-search aria-label="Search the site">{icon('search')}</button><a class="icon-button" href="/workspace/" aria-label="Saved workspace">{icon('bookmark')}</a><a class="button small" href="/start-here/">Start here ↗</a><button class="icon-button menu-button" type="button" id="menu-toggle" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open navigation"><span class="menu-open-icon">{icon('menu')}</span><span class="menu-close-icon">{icon('close')}</span></button></div></div><nav class="nav-drawer" id="mobile-nav" aria-label="Mobile navigation" hidden><div class="wrap nav-drawer-links">{navhtml}<a href="/stack-builder/">Find my stack</a><a href="/workspace/">Saved workspace</a></div></nav></header><main id="main">{content}</main><footer class="site-footer"><div class="wrap"><div class="footer-top"><div>{brand_link()}<p>Practical AI knowledge for small business owners. Understand the tools, make your own choices, and build workflows you can manage.</p></div><div><h3>Discover</h3><a href="/tool-library/">Tool library</a><a href="/comparisons/">Comparisons</a><a href="/business-types/">Business guides</a><a href="/problems/">Find a workflow</a><a href="/search/">Search everything</a><a href="/feed.xml">RSS feed</a></div><div><h3>Put it to work</h3><a href="/learn/ai-for-small-business/">AI learning path</a><a href="/playbooks/">Tutorials</a><a href="/calculators/">Business calculators</a><a href="/stack-builder/">Stack builder</a><a href="/resources/">Free resources</a><a href="/workspace/">Saved workspace</a></div><div><h3>About the Hub</h3><a href="/about/">Meet Jennie</a><a href="/editorial-standards/">Editorial standards</a><a href="/partners/">For partners</a><a href="/contact/">Contact</a><a href="/legal/affiliate-disclosure/">Affiliate disclosure</a></div></div><p class="footer-disclosure">Some links may earn us a commission. <a href="/legal/affiliate-disclosure/">How we’re funded</a>.</p><div class="footer-bottom"><span>© 2026 Seller Insider Hub · Operated by The Local Upgrade LLC</span><span><a href="/legal/privacy/">Privacy</a> · <a href="/legal/terms/">Terms</a> · <button data-cookie-settings>Cookie preferences</button></span></div></div></footer><div class="compare-tray" id="compare-tray" hidden><strong>Compare</strong><p id="compare-summary"></p><button class="remove-all" id="clear-compare">Clear</button><a class="button lime small" id="compare-link" href="/compare/">View comparison →</a></div><dialog id="search-dialog"><div class="dialog-head"><h2>What are you working on?</h2><button class="icon-button" data-close-dialog aria-label="Close search">{icon('close')}</button></div><label class="small" for="global-search-input">Search tools, comparisons, and guides</label><input class="dialog-search" id="global-search-input" type="search" autocomplete="off" placeholder="Try email, Shopify, or automation"><div class="search-results" id="global-search-results" aria-live="polite"></div><p class="small muted">Press Esc to close · Ctrl/⌘ K to search</p></dialog><div class="cookie-panel" id="cookie-panel" hidden><h2>Your privacy choices</h2><p>Saved tools stay in your browser. With your permission, Google Analytics helps us understand which guides are useful. You can change this choice at any time.</p><div class="actions"><button class="button small" data-consent="yes">Allow analytics</button><button class="button light small" data-consent="no">Essential only</button></div></div><div class="toast" id="toast" role="status" hidden></div></body></html>'''
def write(route,title,desc,body,kind='Guide',**kwargs):
    page_date=kwargs.pop('modified',None) or kwargs.get('article',{}).get('modified') or PAGE_DATES.get(route,{}).get('modified',DATE)
    path=OUT/(route.strip('/')+'/index.html' if route!='/' else 'index.html')
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(layout(title,desc,body,route,**kwargs),encoding='utf-8')
    PAGES.append({'route':route,'title':title,'kind':kind})
    if not kwargs.get('noindex'):
        SEARCH.append({'title':title,'url':route,'type':kind,'description':desc,'modified':page_date})
        if (kwargs.get('article') or kind == 'Learning path') and kind != 'Tool':
            article = kwargs.get('article') or {}
            FEED.append({'title':title,'url':route,'type':kind,'description':desc,
                         'published':article.get('published',page_date),'modified':page_date})

OUT.mkdir(exist_ok=True)
for old in OUT.iterdir():
    if old.is_dir(): shutil.rmtree(old)
    else: old.unlink()
shutil.copytree(ROOT/'assets',OUT/'assets')
(OUT/'data').mkdir()
browser_keys=['id','name','category','tagline','description','bestFor','notFor','features','limitations','website','pricingUrl','pricingSummary','freePlan','setup','audiences','checkedAt','evidence','affiliateUrl','affiliateStatus','logo','freeWorkflowEligible','freePlanNote','sourceUrls']
(OUT/'data/catalog.json').write_text(j({'tools':[{k:t[k] for k in browser_keys if k in t} for t in TOOLS],'categories':CATALOG['categories']}),encoding='utf-8')
shutil.rmtree(OUT/'assets/js')
(OUT/'assets/js').mkdir()
shutil.copy(ROOT/'site-assets/hub.css',OUT/'assets/css/hub.css')
client_script=(ROOT/'site-assets/hub.js').read_text().replace("'/data/catalog.json'","'/data/catalog.json?v="+ASSET_VERSION+"'").replace("'/data/search-index.json'","'/data/search-index.json?v="+ASSET_VERSION+"'")
(OUT/'assets/js/hub.js').write_text(client_script,encoding='utf-8')
shutil.copy(ROOT/'site-assets/social-guide.js',OUT/'assets/js/social-guide.js')
for name in ['tutorial-tools', 'decision-tools', 'learning-tools']:
    shutil.copy(ROOT/f'site-assets/{name}.js', OUT/f'assets/js/{name}.js')
    shutil.copy(ROOT/f'site-assets/{name}.css', OUT/f'assets/css/{name}.css')
if (ROOT/'site-assets/vendor-guides').exists():
    shutil.copytree(ROOT/'site-assets/vendor-guides', OUT/'assets/vendor-guides', dirs_exist_ok=True)
(OUT/'resources/kits').mkdir(parents=True, exist_ok=True)
for play in PLAYS:
    manuscript = (ROOT/play['bodyFile']).read_text(encoding='utf-8') if play.get('bodyFile') else None
    (OUT/f'resources/kits/{play["id"]}.txt').write_text(make_working_kit(play, manuscript), encoding='utf-8')
# Keep conventional icon endpoints and previously shared image URLs current.
shutil.copy(ROOT/'assets/brand/favicon.ico', OUT/'favicon.ico')
shutil.copy(ROOT/'assets/brand/apple-touch-icon.png', OUT/'apple-touch-icon.png')
shutil.copy(ROOT/'assets/brand/favicon.svg', OUT/'assets/img/favicon.svg')
shutil.copy(ROOT/'assets/brand/seller-insider-hub-social.svg', OUT/'assets/img/social-card.svg')
shutil.copy(ROOT/'assets/brand/seller-insider-hub-social.png', OUT/'assets/img/insider-social.png')

# An ordered path links the reference library to original practice and assessment.
learning_banner = '<section class="section learning-path-promo"><div class="wrap"><div class="learning-banner"><div><span class="eyebrow">A practical AI learning path</span><h2>Learn it. Build it. Check the result.</h2><p>Six modules, original sales and support exercises, twelve practice questions, and a portfolio for one controlled business pilot.</p></div><a class="button lime" href="/learn/ai-for-small-business/">Start the free learning path →</a></div></div></section>'
(OUT/'assets/learning').mkdir(parents=True, exist_ok=True)
(OUT/'assets/learning/implementation-portfolio.txt').write_text('SELLER INSIDER HUB — AI IMPLEMENTATION PORTFOLIO\nSelf-study working document. Keep private evidence in your own project files.\n\n'+LEARNING_PATH['capstone']['portfolioTemplate'], encoding='utf-8')
write(LEARNING_PATH['route'],LEARNING_PATH['title'],LEARNING_PATH['description'],render_learning_path(LEARNING_PATH,render_byline(LEARNING_PATH['updatedAt'],None,LEARNING_PATH['updatedAt'])),'Learning path',section='learn',modified=LEARNING_PATH['updatedAt'],extrahead=f'<script defer src="/assets/js/learning-tools.js?v={ASSET_VERSION}"></script>')
def learning_note(route):
    for module in LEARNING_PATH['modules']:
        if any(lesson['href'].split('#')[0] == route for lesson in module['lessons']):
            return f'<aside class="learning-lab-note"><p><strong>Module {module["number"]} of the AI implementation path.</strong> Pair this tutorial with an assignment, practice questions, and evidence criteria. <a class="link" href="/learn/ai-for-small-business/#module-{e(module["id"])}">Open the learning module →</a></p></aside>'
    return ''

# Research-led tutorials and useful decisions lead the publication.
home=render_home(PLAYS, COMPARISONS, comparecard, newsletter)
home=home.replace('<section class="front-page">', learning_banner+'<section class="front-page">',1)
write('/','AI for small business: practical tutorials and tool guides','Learn to use AI for your small business, even without an IT department. Follow practical tutorials, worked examples, clear cost comparisons, and checks you can use yourself.',home,'Home')

def library(route='/tool-library/',category=None):
    selected=[t for t in TOOLS if not category or t['category']==category]
    name=CATEGORIES[category]['label'] if category else 'The tool library'
    desc=CATEGORIES[category].get('description','Find software that fits your workflow.') if category else 'Explore software by the job you need done. Compare the fit, save a shortlist, and see what to check before you commit.'
    cats='<option value="">All categories</option>'+''.join(f'<option value="{e(k)}" {"selected" if k==category else ""}>{e(v["label"])}</option>' for k,v in CATEGORIES.items())
    auds='<option value="">All business types</option>'+''.join(f'<option value="{e(k)}">{e(v)}</option>' for k,v in AUDIENCES.items())
    body=hero(name,desc,'Useful tools. Clear tradeoffs.')+f'''<div class="wrap library-layout" data-library><aside class="filter-panel"><h2>Find your fit</h2><div class="filter-group"><label for="filter-category">Category</label><select id="filter-category">{cats}</select></div><div class="filter-group"><label for="filter-audience">Business type</label><select id="filter-audience">{auds}</select></div><div class="filter-group"><label for="filter-setup">Setup effort</label><select id="filter-setup"><option value="">Any setup</option><option>Easy</option><option>Moderate</option><option>Advanced</option></select></div><div class="filter-group"><label class="check-label"><input type="checkbox" id="filter-free">Free plan available</label><button class="text-button" id="reset-filters">Reset filters</button></div></aside><section aria-label="Tools"><div class="filter-search"><input id="library-query" type="search" placeholder="Search tools, jobs, or features…" aria-label="Search tools"></div><div class="results-toolbar"><p id="results-count" role="status">{len(selected)} tools to explore</p><label><span class="sr-only">Sort tools</span><select id="sort-tools" aria-label="Sort tools"><option value="curated">Editorial order</option><option value="name">Name A–Z</option><option value="easy">Easiest setup first</option></select></label></div><div class="library-grid" id="tool-results">{''.join(toolcard(t) for t in selected)}</div></section></div>'''
    if not category:
        category_cards=''.join(f'<a class="category-card" href="/tool-library/category/{e(key)}/"><span aria-hidden="true">{SYMBOLS.get(key,"↗")}</span><div><strong>{e(item["label"])}</strong><small>{sum(t["category"]==key for t in TOOLS)} tools</small></div><b aria-hidden="true">↗</b></a>' for key,item in CATEGORIES.items())
        body+='<section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Explore by the work you do</span><h2>Browse tool categories.</h2></div></div><nav class="category-grid" aria-label="Tool categories">'+category_cards+'</nav></div></section>'
    elif category=='ai-assistants':
        body+='<section class="section"><div class="wrap"><a class="card card-link" href="/tools/ai-assistant/"><h2>How AI assistants fit your workflow.</h2><p>Choose a useful first task and learn what to check before relying on the result.</p><span class="read-link">Read the introduction →</span></a></div></section>'
    write(route,name,desc,body,'Tool category' if category else 'Directory',section='tools')
library()
for c in CATEGORIES: library('/tool-library/category/'+c+'/',c)

for t in TOOLS:
    url,rel=outbound(t)
    body=hero(t['name'],t['tagline'],category_label(t),('Tool library','/tool-library/'))
    detail=f'''<div class="wrap detail-layout"><article class="article-body"><div class="tool-profile-head">{tool_logo(t)}<div><span class="chip green">Documentation reviewed</span><p class="small">Sources checked {e(t.get('checkedAt',DATE))}</p></div></div><p>{e(t['description'])}</p><h2>When it makes sense</h2><ul>{''.join('<li>'+e(x)+'</li>' for x in t['bestFor'])}</ul><h2>What you can do with it</h2><ul>{''.join('<li>'+e(x)+'</li>' for x in t['features'])}</ul><h2>Where to be careful</h2><ul>{''.join('<li>'+e(x)+'</li>' for x in t['limitations'])}</ul><h2>Consider another approach if…</h2><ul>{''.join('<li>'+e(x)+'</li>' for x in t['notFor'])}</ul>{tool_details(t,BY_ID)}{related_guides(t['id'],PLAYS,COMPARISONS)}{evidence(t['sourceUrls'],t)}</article><aside class="detail-sidebar"><div class="card"><h3>In this tool guide</h3><nav class="toc" aria-label="On this page"><a href="#costs">Plans and cost drivers</a><a href="#example">Worked example</a><a href="#alternatives">Alternatives</a><a href="#research-record">Sources</a></nav><h3>Your decision, at a glance</h3><dl><dt>Best starting audience</dt><dd>{e(', '.join(AUDIENCES.get(a,a) for a in t.get('audiences',[])))}</dd><dt>Setup effort</dt><dd>{e(t['setup'])}</dd><dt>Free option</dt><dd>{e(t.get('freePlanNote') or ('Free plan available; check limits' if t.get('freePlan') is True else ('Paid plans or usage fees' if t.get('freePlan') is False else 'Check current plans')))}</dd><dt>Evidence</dt><dd>Official documentation</dd></dl><a class="button" href="{e(url)}" target="_blank" rel="{rel}" data-outbound="{e(t['id'])}" data-outbound-placement="tool_profile">Visit {e(t['name'])} ↗</a><button class="button light" data-save-tool="{e(t['id'])}" aria-pressed="false">Save this tool</button><button class="button light" data-compare-tool="{e(t['id'])}" aria-pressed="false">Add to comparison</button><p class="small" style="margin-top:15px">We may earn a commission from qualifying purchases. <a class="link" href="/legal/affiliate-disclosure/">Disclosure</a>.</p></div><div class="card"><h3>Make a useful shortlist</h3><p>Compare up to three tools, then work through one real task before choosing a paid plan.</p>{btn('Open comparison','/compare/','light')}</div></aside></div>'''
    write('/tool/'+t['id']+'/',t['name']+' guide: fit, costs, and a worked example',t['tagline'],body+detail,'Tool',section='tools',article={'published':t.get('publishedAt',DATE),'modified':t.get('checkedAt',DATE),'sources':t['sourceUrls']})

write('/comparisons/','A clearer choice starts here','Compare software by the work you need to do. Understand the fit, tradeoffs, and questions worth asking before you buy.',hero('A clearer choice starts here','Compare software by the work you need to do. Understand the fit, tradeoffs, and questions worth asking before you buy.','Side by side')+f'<section class="section"><div class="wrap"><div class="actions" style="margin-bottom:30px">{btn("Build my own comparison →","/compare/")}</div><div class="grid three">'+''.join(comparecard(c) for c in COMPARISONS)+'</div></div></section>','Comparisons',section='compare')
for c in COMPARISONS:
    ts=[BY_ID[x] for x in c['toolIds'] if x in BY_ID]
    names=[t['name'] for t in ts]
    first,second=(names+['Option one','Option two'])[:2]
    rows=''.join(f'<tr><th scope="row">{e(d["label"])}</th><td>{e(d["first"])}</td><td>{e(d["second"])}</td></tr>' for d in c['dimensions'])
    body=hero(c['title'],c['summary'],'The useful differences',('Comparisons','/comparisons/'))+f'''<div class="wrap detail-layout"><article class="article-body"><div class="article-meta"><span>By <a class="link" rel="author" href="/authors/jennie-malone/">Jennie Malone</a></span><span>Sources reviewed · {e(c.get("lastReviewed",DATE))}</span></div><h2>The practical answer</h2><p>{e(c['verdict'])}</p><h2 id="compare-details">Compare the details</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Decision</th><th>{e(first)}</th><th>{e(second)}</th></tr></thead><tbody>{rows}</tbody></table></div><h2>Important tradeoffs</h2><ul>{''.join('<li>'+e(x)+'</li>' for x in c['caveats'])}</ul>{comparison_details(c,first,second)}{render_decision_tool(c['id'],DECISION_EVIDENCE)}{evidence(c['sourceUrls'],c)}</article><aside class="detail-sidebar"><div class="card"><h3>In this comparison</h3><nav class="toc" aria-label="On this page"><a href="#compare-details">The useful differences</a><a href="#plans-and-costs">Plans and costs</a><a href="#worked-scenario">Worked cost example</a><a href="#our-recommendation">Our recommendation</a><a href="#before-you-pay">Before you pay</a><a href="#research-record">Sources</a></nav><h3>Explore these tools</h3>{''.join(btn(e(t['name'])+' guide ↗','/tool/'+t['id']+'/','light') for t in ts)}<button class="button light" data-save-guide="/comparisons/{e(c['id'])}/" data-title="{e(c['title'])}" aria-pressed="false">Save this comparison</button><button class="button light" data-print>Print or save PDF</button></div>{approved_tool_actions(c['toolIds'],BY_ID,'comparison_tools')}<div class="card"><h3>Keep the decision practical</h3><p>A higher-tier plan only helps if its features solve work you actually need to do.</p></div></aside></div>'''
    if any(item['id']==c['id'] for item in DECISION_EVIDENCE['comparisons']):
        body=body.replace('<a href="#research-record">Sources</a>', f'<a href="#decision-{e(c["id"])}">Calculate your plan</a><a href="#research-record">Sources</a>', 1)
    write('/comparisons/'+c['id']+'/',c['title'],c['summary'],body,'Comparison',section='compare',extrahead=f'<link rel="stylesheet" href="/assets/css/decision-tools.css?v={ASSET_VERSION}"><script defer src="/assets/js/decision-tools.js?v={ASSET_VERSION}"></script>',article={'published':c.get('publishedAt',DATE),'modified':c.get('lastReviewed',DATE),'sources':c['sourceUrls']})
write('/compare/','Your shortlist, side by side','Choose up to three tools and compare their fit, setup, features, limitations, and current pricing sources.',hero('Your shortlist, side by side','Choose up to three tools and compare their fit, setup, features, limitations, and current pricing sources.','The comparison workspace')+'<section class="section"><div class="wrap"><div class="compare-pickers">'+''.join(f'<label for="compare-select-{i}">Option {i+1}<select id="compare-select-{i}"><option value="">Choose a tool</option>'+''.join(f'<option value="{e(t["id"])}">{e(t["name"])}</option>' for t in sorted(TOOLS,key=lambda t:t['name'].lower()))+'</select></label>' for i in range(3))+'</div><div id="compare-output" aria-live="polite"><div class="empty-state"><h3>Start with two tools.</h3><p>Choose from the menus above or add tools from the library.</p></div></div><div class="actions" style="margin-top:25px"><button class="button light" id="share-comparison">Copy comparison link</button><button class="button light" data-print>Print comparison</button></div></div></section>','Tool',section='compare',noindex=True)
write('/playbooks/','AI and software tutorials for small businesses','Build useful business workflows with exact steps, example inputs, checks, and troubleshooting.',hero('Put AI to work. Build a better system.','Practical tutorials for the work behind your business. Start with the inputs, follow the setup, and check the result.','The tutorial collection')+learning_banner+'<section class="section"><div class="wrap"><div class="grid three editorial-grid">'+''.join(playcard(p,i) for i,p in enumerate(PLAYS))+'</div>'+cover_credit()+'</div></section>','Tutorials',section='playbooks')
for p in PLAYS:
    reviewed=p.get('lastReviewed',DATE)
    if p.get('bodyFile'):
        article_html=learning_note('/playbooks/'+p['id']+'/')+(ROOT/p['bodyFile']).read_text(encoding='utf-8')
        article_html=expand_approved_tool_markers(article_html,p['toolIds'],BY_ID)
        read_time=max(1,round(len(plain(article_html).split())/210))
        toc_items=p.get('contents') or [{'id':anchor,'label':plain(label)} for anchor,label in re.findall(r'<h2[^>]*id="([^"]+)"[^>]*>(.*?)</h2>',article_html,re.S)]
        toc=''.join(f'<a href="#{e(item["id"])}">{e(item["label"])}</a>' for item in toc_items)
        byline=render_byline(reviewed, read_time, p.get('publishedAt', DATE))
        sidebar=f'<aside class="detail-sidebar"><div class="card"><span class="eyebrow">Your field guide</span><h3>Build it, step by step</h3><nav class="toc" aria-label="On this page">{toc}</nav><button class="button light" data-save-guide="/playbooks/{e(p["id"])}/" data-title="{e(p["title"])}" aria-pressed="false">Save to reading list</button><button class="button light" data-print>Print or save PDF</button></div><div class="card"><h3>Keep the working kit</h3><p>Take the filled examples, reusable templates, and checks with you.</p><a class="button light" href="/resources/kits/{e(p["id"])}.txt" download>Download the working kit ↓</a></div>'+('' if p.get('affiliatePresentation') == 'contextual' else '<div class="card"><h3>Tools in this guide</h3>'+''.join(btn(e(BY_ID[x]['name'])+' ↗','/tool/'+x+'/','light') for x in p['toolIds'] if x in BY_ID)+'</div>')+''+(approved_tool_actions(p['toolIds'],BY_ID,'tutorial_tools') if p.get('affiliatePresentation') != 'contextual' else '')+'</aside>'
        if p['id'] != 'ai-social-media-agents':
            article_html += render_launch_checks(p)
        if p.get('updateNote'):
            article_html += f'<p class="update-note"><strong>Updated {e(p.get("modifiedAt", reviewed))}:</strong> {e(p["updateNote"])}</p>'
        disclosure = p.get('affiliateDisclosure', '') if any(is_approved_affiliate(BY_ID.get(tid, {})) for tid in p['toolIds']) else ''
        body=hero(p['title'],p['summary'],p['category'],('Tutorials','/playbooks/'),disclosure=disclosure)+f'<div class="wrap detail-layout social-guide-layout"><article class="article-body social-guide">{byline}{article_figure(p["id"])}{article_html}</article>{sidebar}</div>'
        write('/playbooks/'+p['id']+'/',p['title'],p['summary'],body,'Playbook',section='playbooks',extrahead=f'<script defer src="/assets/js/social-guide.js?v={ASSET_VERSION}"></script>',article={'published':p.get('publishedAt',DATE),'modified':p.get('modifiedAt',reviewed),'sources':p['sourceUrls']})
        continue
    reading_text=[p['intro'],p.get('expectedOutcome','')]+p.get('prerequisites',[])+p.get('planTradeoffs',[])+[str(v) for step in p['steps'] for k,v in step.items() if k in ['title','body','check']]+p['pitfalls']+p['success']+[p.get('example',{}).get(k,'') for k in ['input','output']]+[t['content'] for t in p.get('copyableTemplates',[])]+[t['fix'] for t in p.get('troubleshooting',[])]
    read_time=max(4,round(len(' '.join(reading_text).split())/210))
    steps=''.join(f'<section class="step" id="step-{i+1}"><div class="step-head"><span class="step-number">{i+1:02d}</span><h2>{e(st["title"])}</h2></div><p>{e(st["body"])}</p><div class="step-check"><strong>Check your work:</strong> {e(st["check"])}</div>{''.join(source_link(u,'Step reference') for u in st.get('sourceUrls',[]))}</section>' for i,st in enumerate(p['steps']))
    exact=''
    byline=render_byline(reviewed, read_time, p.get('publishedAt', DATE))
    related=[c for c in COMPARISONS if set(c['toolIds']) & set(p['toolIds'])][:2]
    related_html='<section class="article-related"><h2>Choosing your tools?</h2>'+''.join(f'<p><a class="link" href="/comparisons/{e(c["id"])}/">{e(c["title"])} →</a></p>' for c in related)+'</section>' if related else ''
    body=hero(p['title'],p['summary'],p['category'],('Tutorials','/playbooks/'))+f'<div class="wrap detail-layout"><article class="article-body">'+byline+article_figure(p['id'])+learning_note('/playbooks/'+p['id']+'/')+f'<p>{e(p["intro"])}</p>'+tutorial_extras(p)+exact+steps+tutorial_templates(p)+tutorial_troubleshooting(p)+'<h2>Common mistakes to avoid</h2><ul>'+''.join('<li>'+e(x)+'</li>' for x in p['pitfalls'])+'</ul><h2>How to know it helped</h2><ul>'+''.join('<li>'+e(x)+'</li>' for x in p['success'])+'</ul>'+related_html+evidence(list(dict.fromkeys(p['sourceUrls']+p.get('uiSourceUrls',[]))),p)+f'</article><aside class="detail-sidebar"><div class="card"><h3>In this tutorial</h3><nav class="toc" aria-label="On this page"><a href="#before-you-start">Before you start</a><a href="#plan-requirements">Plan requirements</a><a href="#worked-example">Worked example</a>'+''.join(f'<a href="#step-{i+1}">{i+1}. {e(st["title"])}</a>' for i,st in enumerate(p['steps']))+f'<a href="#troubleshooting">Troubleshooting</a></nav><button class="button light" data-save-guide="/playbooks/{e(p["id"])}/" data-title="{e(p["title"])}" aria-pressed="false">Save to reading list</button><button class="button light" data-print>Print or save PDF</button></div><div class="card"><h3>Tools in this guide</h3>'+''.join(btn(e(BY_ID[x]['name'])+' ↗','/tool/'+x+'/','light') for x in p['toolIds'] if x in BY_ID)+'</div>'+approved_tool_actions(p['toolIds'],BY_ID,'tutorial_tools')+'<div class="card"><h3>About this publication</h3><p>Founded by Jennie Malone, with a background in enterprise software and ecommerce.</p><p style="margin-top:12px"><a class="link" href="/about/">Meet the founder →</a></p></div></aside></div>'
    body=body.replace('<div class="card"><h3>Tools in this guide</h3></div>','')
    body=body.replace('</article>',render_launch_checks(p)+'</article>',1)
    body=body.replace('<button class="button light" data-print>Print or save PDF</button>',f'<button class="button light" data-print>Print or save PDF</button><a class="button light" href="/resources/kits/{e(p["id"])}.txt" download>Download the working kit ↓</a>',1)
    write('/playbooks/'+p['id']+'/',p['title'],p['summary'],body,'Playbook',section='playbooks',article={'published':p.get('publishedAt',DATE),'modified':p.get('modifiedAt',reviewed),'sources':p['sourceUrls']})

# Business guides use the same reviewed catalog and finished tutorial routes.
BUSINESS = load('business-guides.json')
for guide in BUSINESS:
    article_body=business_article(guide,BY_ID,PLAYS)
    toc='<a href="#toolkit">Choose your tools</a>'+''.join(f'<a href="#business-step-{i+1}">{e(section["title"])}</a>' for i,section in enumerate(guide['sections']))+'<a href="#worked-example">Finished example</a><a href="#cost">Costs</a><a href="#next">Implementation tutorials</a>'
    byline=f'<div class="article-byline"><span class="author-mark">JM</span><span>By <a rel="author" href="/authors/jennie-malone/">Jennie Malone</a></span><span>Documentation reviewed {e(guide["lastReviewed"])}</span></div>'
    body=hero(guide['title'],guide['summary'],guide['label'],('Business guides','/business-types/'))+f'<div class="wrap detail-layout"><article class="article-body">{byline}{article_body}</article><aside class="detail-sidebar"><div class="card"><h3>In this guide</h3><nav class="toc" aria-label="On this page">{toc}</nav><button class="button light" data-save-guide="/business-types/{e(guide["id"])}/" data-title="{e(guide["title"])}" aria-pressed="false">Save to reading list</button><button class="button light" data-print>Print or save PDF</button></div></aside></div>'
    citations=list(dict.fromkeys([u for job in guide['jobs'] for tid in job[1] for u in BY_ID[tid].get('sourceUrls',[])]+[x['url'] for x in guide.get('extraSources',[])]))
    write('/business-types/'+guide['id']+'/',guide['title'],guide['summary'],body,'Business guide',section='business',article={'published':guide['publishedAt'],'modified':guide['lastReviewed'],'sources':citations})
body=hero('Choose the workflow for your business','Start with the customer journey, choose tools for the missing step, and follow a complete setup guide.','Business guides')+'<section class="section"><div class="wrap"><div class="grid three">'+''.join(f'<a class="card card-link business-guide-card" href="/business-types/{e(g["id"])}/"><span class="eyebrow">{e(g["label"])}</span><h2>{e(g["title"].split(":",1)[1].strip())}</h2><p>{e(g["summary"])}</p><span class="read-link">Read the business guide →</span></a>' for g in BUSINESS)+'</div></div></section>'
write('/business-types/','AI tools and workflows by business type','Practical software guidance for Etsy sellers, creators, coaches, contractors, local businesses, real estate, and appointment practices.',body,'Business guides',section='business',modified=REVIEW_DATE)

# Complete feature guides replace the remaining generic legacy articles.
FEATURE_GUIDES = load('feature-guides.json')
for guide in FEATURE_GUIDES:
    manuscript=(ROOT/guide['bodyFile']).read_text(encoding='utf-8') if guide.get('bodyFile') else feature_article(guide,BY_ID)
    contents=guide.get('contents') or guide['sections']
    toc=''.join(f'<a href="#{e(item["id"])}">{e(item.get("label") or item.get("title"))}</a>' for item in contents)
    byline=render_byline(guide['lastReviewed'],max(1,round(len(plain(manuscript).split())/210)),guide.get('publishedAt',DATE))
    kit_link=''
    if guide.get('kitId'):
        kit_record={**guide,'id':guide['kitId'],'sourceUrls':guide.get('sourceUrls') or [x['url'] for x in guide['namedSources']]}
        (OUT/f'resources/kits/{guide["kitId"]}.txt').write_text(make_working_kit(kit_record,manuscript),encoding='utf-8')
        manuscript+=render_launch_checks(kit_record)
        kit_link=f'<a class="button light" href="/resources/kits/{e(guide["kitId"])}.txt" download>Download the working kit ↓</a>'
    if guide.get('updateNote'):
        manuscript+=f'<p class="update-note"><strong>Updated {e(guide.get("modifiedAt",guide["lastReviewed"]))}:</strong> {e(guide["updateNote"])}</p>'
    body=hero(guide['title'],guide['summary'],guide['label'])+f'<div class="wrap detail-layout"><article class="article-body">{byline}{manuscript}</article><aside class="detail-sidebar"><div class="card"><h3>In this guide</h3><nav class="toc" aria-label="On this page">{toc}</nav><button class="button light" data-save-guide="{e(guide["route"])}" data-title="{e(guide["title"])}" aria-pressed="false">Save to reading list</button><button class="button light" data-print>Print or save PDF</button>{kit_link}</div></aside></div>'
    if guide.get('bodyFile'):
        body=body.replace('class="article-body"','class="article-body social-guide"',1).replace('class="wrap detail-layout"','class="wrap detail-layout social-guide-layout"',1)
    write(guide['route'],guide['title'],guide['summary'],body,'Guide',section='playbooks',article={'published':guide['publishedAt'],'modified':guide.get('modifiedAt',guide['lastReviewed']),'sources':guide.get('sourceUrls') or [x['url'] for x in guide['namedSources']]})

# Interactive tools and working browser-local personalization.
needs=[('ai-assistants','Writing & research'),('email','Email & follow-up'),('automation','Connect my apps'),('ecommerce','Selling online'),('crm','Leads & relationships'),('design','Design & content'),('productivity','Projects & organization'),('scheduling','Booking & scheduling')]
stack_form='<form id="stack-form" class="input-panel"><h2>Tell us how you work.</h2><div class="field"><label for="stack-audience">Your business</label><select name="audience" id="stack-audience">'+''.join(f'<option value="{k}">{v}</option>' for k,v in AUDIENCES.items())+'</select></div><div class="field"><label for="stack-budget">Approach to spending</label><select id="stack-budget" name="budget"><option value="free">Start with free plans</option><option value="selective">Pay for a clear need</option><option value="flexible">Prioritize capability</option></select><small>Check current plan prices and limits with each provider.</small></div><div class="field"><label for="stack-comfort">Technical comfort</label><select id="stack-comfort" name="comfort"><option value="Easy">Keep setup simple</option><option value="Moderate">Comfortable connecting tools</option><option value="Advanced">Happy to configure systems</option></select></div><fieldset class="field" style="border:0;padding:0"><legend>What do you want help with?</legend>'+''.join(f'<label class="task-check"><input type="checkbox" name="needs" value="{k}" {"checked" if k in ["ai-assistants","email","productivity"] else ""}>{v}</label>' for k,v in needs)+'</fieldset><button class="button" type="submit">Build my stack →</button></form>'
write('/stack-builder/','A toolkit that fits your business','Build a practical shortlist from your business type, priorities, and setup comfort. See why each tool fits and what to check next.',hero('A toolkit that fits your business','Build a practical shortlist from your business type, priorities, and setup comfort. See why each tool fits and what to check next.','Your personalized starting point')+'<div class="wrap app-layout">'+stack_form+'<section class="output-panel" id="stack-output" aria-live="polite"><span class="eyebrow">Useful choices, explained</span><h2>Your next setup starts here.</h2><p>Choose the jobs you need help with. Your results will include a tool for each job, a reason for the recommendation, alternatives, and practical checks.</p><div class="grid two"><div class="card"><h3>Built around your work</h3><p>Recommendations use the tool library and transparent matching rules.</p></div><div class="card"><h3>Easy to keep</h3><p>Save your stack in this browser, export it, or print your plan.</p></div></div><p class="output-note">Your selections stay in this browser. Recommendations come from our researched tool library.</p></section></div>','Tool',section='tools')

calc_defs=[('roi','Automation value calculator','Separate the value of time saved from money actually saved. Compare a workflow with its ongoing and setup costs.'),('storefront','Storefront break-even calculator','Estimate how many additional orders would cover a new storefront. Use your own margins, costs, and payment fees.'),('stack-cost','Software stack cost planner','See the monthly equivalent and annual cost of your subscriptions, seats, and billing cycles.')]
write('/calculators/','Put some numbers behind the decision','Explore costs and tradeoffs using your own inputs. These tools show the math without pretending an estimate is a guarantee.',hero('Put some numbers behind the decision','Explore costs and tradeoffs using your own inputs. These tools show the math without pretending an estimate is a guarantee.','Practical business calculators')+'<section class="section"><div class="wrap"><div class="grid three">'+''.join(f'<a class="card card-link" href="/calculators/{id}/"><span class="eyebrow">{i+1:02d} / Calculator</span><h3>{e(title)}</h3><p>{e(desc)}</p><div class="actions"><span class="text-button">Run the numbers →</span></div></a>' for i,(id,title,desc) in enumerate(calc_defs))+'</div></div></section>','Calculators',section='resources')
def number(name,label,value,minval=0,step='0.01',helptext=''):
    return f'<div class="field"><label for="{name}">{label}</label><input id="{name}" name="{name}" type="number" value="{value}" min="{minval}" step="{step}" required>{("<small>"+helptext+"</small>") if helptext else ""}</div>'
for id,title,desc in calc_defs:
    if id=='roi': fields=number('hours','Hours saved per week',3)+number('rate','Value of an hour ($)',25)+number('monthly','Monthly software cost ($)',30)+number('setup','One-time setup cost ($)',100)+number('months','Months to spread setup cost over',12,1,'1')
    elif id=='storefront': fields=number('aov','Average order value ($)',40)+number('margin','Gross margin before payment fees (%)',50)+number('processing','Payment processing percentage (%)',3)+number('perorder','Other costs per order ($)',0)+number('fixed','Monthly storefront and app costs ($)',50)+number('setup','One-time setup cost ($)',120)+number('months','Months to spread setup cost over',12,1,'1')
    else: fields='<div class="field">'+number('budget','Monthly software budget ($)',150)+'</div><p class="small">Enter actual quotes. Blank prices are not treated as free.</p><div id="cost-items"></div><button class="button light small" id="add-cost" type="button">+ Add a subscription</button>'
    body=hero(title,desc,'Your inputs. Visible assumptions.',('Calculators','/calculators/'))+f'<div class="wrap app-layout"><form class="input-panel" data-calculator="{id}"><h2>Your numbers</h2>{fields}<p class="small" style="margin:15px 0">Prefilled values are editable examples, not vendor prices or expected results.</p><button class="button" type="submit">Calculate →</button></form><section class="output-panel" id="calculator-output" aria-live="polite"><h2>Make the tradeoff visible.</h2><p>Enter your numbers and calculate. Results stay in your browser.</p></section></div>'
    write('/calculators/'+id+'/',title,desc,body,'Calculator',section='resources')

write('/workspace/','Your saved workspace','Keep useful tools, comparisons, playbooks, and stacks together. Saved items stay on this browser; export a backup to use them elsewhere.',hero('Your saved workspace','Keep useful tools, comparisons, playbooks, and stacks together. Saved items stay on this browser; export a backup to use them elsewhere.','Pick up where you left off')+'<div class="wrap"><div class="workspace-actions"><button class="button light" id="export-workspace">Export my workspace</button><label class="button light" for="import-workspace">Import a backup</label><input id="import-workspace" type="file" accept="application/json" hidden><button class="text-button" id="clear-workspace">Clear saved items</button></div><section class="saved-section"><h2>Saved tools</h2><div id="workspace-tools" class="grid three"></div></section><section class="saved-section"><h2>Your reading list</h2><div id="workspace-guides" class="grid two"></div></section><section class="saved-section"><h2>Your tool stacks</h2><div id="workspace-stacks" class="grid two"></div></section><p class="small" style="margin:25px 0">Your reading list stays in this browser. Export a backup before clearing browser storage or switching devices.</p></div>','Workspace',section='resources',noindex=True)
write('/search/','Find your next useful answer','Search the complete collection of tools, comparisons, playbooks, and business guides.',hero('Find your next useful answer','Search the complete collection of tools, comparisons, playbooks, and business guides.','Search the Hub')+'<section class="section"><div class="wrap"><label for="search-page-input" class="small">Search the Hub</label><input type="search" id="search-page-input" class="dialog-search" placeholder="Try email, automation, or your business type"><div id="search-page-results" class="search-results" style="max-height:none" aria-live="polite"></div></div></section>','Search',noindex=True)

# Downloads contain usable material, not empty lead-magnet placeholders.
downloads=OUT/'downloads';downloads.mkdir()
for download_source in (ROOT/'downloads-source').glob('*'):
    if download_source.is_file(): shutil.copy(download_source,downloads/download_source.name)
resources=[('software-decision-scorecard.csv','Software decision scorecard','Compare tools against the job, total cost, data portability, and effort involved.'),('workflow-audit.csv','Workflow audit worksheet','Map a repeated task, its failure points, and the checks a reliable automation needs.'),('product-facts-prompt.txt','Product-facts writing template','Keep AI-assisted product copy grounded in the facts you supply.'),('launch-checklist.txt','Workflow launch checklist','Check a new workflow from permissions and sample data through rollback and maintenance.')]
csv_rows={resources[0][0]:[['Tool','Job to be done','Must-have feature','Price source URL','Monthly cost','Setup effort','Data export','Limitation','Test evidence','Decision'],['Example: replace with your option','','','','','','','','','']],resources[1][0]:[['Workflow','Trigger','Input source','Owner','Frequency/week','Minutes/run','Failure cost','Approval step','Success check','Manual fallback','Last reviewed'],['Example: new inquiry follow-up','','','','','','','','','','']]}
for filename,rows in csv_rows.items():
    with (downloads/filename).open('w',newline='') as f: csv.writer(f).writerows(rows)
(downloads/'product-facts-prompt.txt').write_text('PRODUCT FACTS WRITING TEMPLATE\n\nFill in: actual item, materials, dimensions, variations, production method, contents, processing time, care instructions, and real limitations.\n\nPrompt:\nUsing ONLY the facts below, draft a clear product description, five buyer questions with factual answers, and three readable title options. Do not invent certifications, health benefits, sustainability claims, shipping promises, availability, or product features. Mark missing information as QUESTIONS FOR THE SELLER. Keep claims consistent with the real item and photos.\n\nFACTS:\n[Insert verified product facts]\n\nBefore publishing: verify every claim, current platform rules, image accuracy, and intellectual-property permissions. A draft is not a completed compliance review.\n')
(downloads/'launch-checklist.txt').write_text('WORKFLOW LAUNCH CHECKLIST\n\n[ ] Name the task, owner, trigger, and desired output.\n[ ] Confirm permission to use the input data.\n[ ] Use fictional sample records for the first test.\n[ ] Check required fields, duplicate handling, and invalid inputs.\n[ ] Keep a human approval step before consequential actions.\n[ ] Test a successful run and an expected failure.\n[ ] Confirm retry behavior does not duplicate actions.\n[ ] Define an error notification and a manual fallback.\n[ ] Record the current tool plans, limits, and monthly costs.\n[ ] Document how to pause and reverse the workflow.\n[ ] Assign a review date and success measure.\n[ ] Remove test records and unnecessary access.\n')
kit_rows=[(p['id'],p['title'],'/playbooks/'+p['id']+'/') for p in PLAYS]+[(g['kitId'],g['title'],g['route']) for g in FEATURE_GUIDES if g.get('kitId')]
kit_shelf='<section class="section"><div class="wrap"><span class="eyebrow">Complete examples you can take with you</span><h2>Working kits from the tutorials.</h2><p>Filled examples, prompts, mappings, and launch checks. Free text files you can edit in any document app; no signup required.</p>'+publication_table(['Workflow','Read the instructions','Keep the kit'],[[e(title),f'<a href="{e(url)}">Read the guide →</a>',f'<a href="/resources/kits/{e(id)}.txt" download>Download TXT ↓</a>'] for id,title,url in kit_rows])+'</div></section>'
write('/resources/','Useful things to keep close','Free worksheets, prompts, calculators, and saved resources to make your next business decision easier.',hero('Useful things to keep close','Free worksheets, prompts, calculators, and saved resources to make your next business decision easier.','The resource shelf')+learning_banner+kit_shelf+'<section class="section"><div class="wrap"><div class="grid two download-grid">'+''.join(f'<article class="card"><span class="eyebrow">Free {"worksheet" if filename.endswith("csv") else "template"}</span><h3>{e(title)}</h3><p>{e(desc)}</p><a class="button light" href="/downloads/{filename}" download data-download="{filename}">Download {filename.split(".")[-1].upper()} ↓</a></article>' for filename,title,desc in resources)+'</div><div class="grid two" style="margin-top:25px"><a class="card card-link" href="/calculators/"><h3>Run the numbers</h3><p>Use the automation, storefront, and subscription calculators.</p></a><a class="card card-link" href="/workspace/"><h3>Your saved workspace</h3><p>Collect the tools and guides you want to come back to.</p></a></div></div></section>'+newsletter(),'Resources',section='resources')

# Preserve and restyle substantive existing articles while replacing obsolete entry points.
problem_paths=[
 ('Get back to new leads','Capture the inquiry, keep an owner and next action, and stop reminders when the conversation moves on.','/playbooks/service-lead-follow-up/'),
 ('Answer recurring questions','Turn approved policies and product facts into a useful knowledge base with clear escalation.','/playbooks/customer-support-knowledge-base/'),
 ('Make scheduling simpler','Set availability, buffers, time zones, and confirmation steps that match the actual service.','/playbooks/self-service-booking/'),
 ('Create content more consistently','Build a source pack, draft channel-specific material, and publish a coordinated campaign.','/playbooks/product-launch-content-system/'),
 ('Follow up by email','Connect a signup form to useful welcome messages, with deliberate delays and a tested unsubscribe path.','/playbooks/email-welcome-sequence/'),
 ('Connect the tools you already use','Build an intake queue with stable records, visible failures, and a documented exception process.','/playbooks/first-reliable-automation/'),
 ('Request honest reviews','Choose a consistent request point and a neutral message that welcomes every customer experience.','/playbooks/honest-review-request-system/'),
 ('Handle missed calls','Compare voicemail, a human answering service, and an AI receptionist against your intake needs.','/guides/ai-receptionist-vs-answering-service-vs-voicemail/'),
 ('Choose a home for customer information','Understand when a spreadsheet, CRM, or project tool can handle the work.','/guides/crm-vs-spreadsheet-vs-project-management/'),
 ('Give AI useful business context','Create a reusable project brief with approved facts, source references, and a way to handle unknowns.','/playbooks/chatgpt-project-business-brief/')
]
write('/problems/','Small business problems: practical AI and workflow solutions','Start with a specific business problem and find a complete workflow for solving it.',hero('What would make your working day better?','Start with the task that needs a better system. Each route takes you to a complete explanation and practical next steps.','Find the useful answer')+'<section class="section"><div class="wrap grid two">'+''.join(f'<a class="card card-link" href="{url}"><h3>{title}</h3><p>{desc}</p><span class="read-link">Find the workflow →</span></a>' for title,desc,url in problem_paths)+'</div></section>','Topics',section='playbooks')
overrides={'index.html','problems/index.html','about/index.html','contact/index.html','editorial-standards/index.html','tool-library/index.html','start-here/index.html','admin/index.html','affiliate/partners.html','affiliate/recommended-tools.html','tools/ai-solutions-concierge.html','comparisons/zapier-vs-make.html','legal/privacy.html','legal/terms.html','legal/affiliate-disclosure.html'}
overrides.update({'tools/ai-assistant.html','business-types/index.html'} | {'business-types/'+g['id']+'/index.html' for g in BUSINESS})
overrides.update({'guides/crm-vs-spreadsheet-vs-project-management.html','guides/ai-receptionist-vs-answering-service-vs-voicemail.html','guides/getting-started-with-ai.html','guides/how-i-made-this-ai-avatar-video-with-heygen/index.html','decision-funnels/what-should-i-automate-first/index.html','affiliate/best-ai-tools-small-business.html','business-systems-map/index.html'})
category_aliases={'ai-assistant-tools':'ai-assistants','automation-tools':'automation','email-tools':'email','crm-tools':'crm','design-tools':'design','planning-tools':'productivity','scheduling-tools':'scheduling','customer-service-tools':'customer-service','reviews-tools':'reviews','social-media-tools':'social-media','phone-systems-tools':'phone-systems','seller-tools':'ecommerce','seller-tools-tools':'ecommerce','seo-tools':'seo','voice-video-tools':'video-audio'}
legacy_redirects=[]
retired_routes={
 'tools/ai-assistant-tools.html':'/tools/ai-assistant/',
 'decision-funnels/index.html':'/start-here/',
 'decision-funnels/best-ai-scheduler-for-solo-business/index.html':'/playbooks/self-service-booking/',
 'decision-funnels/what-ai-stack-fits-my-budget/index.html':'/stack-builder/',
 'decision-funnels/what-ai-tools-does-an-etsy-seller-need/index.html':'/business-types/etsy-sellers/',
 'decision-funnels/which-ai-tool-for-each-business-type/index.html':'/business-types/',
 'decision-funnels/which-crm-should-i-use/index.html':'/guides/crm-vs-spreadsheet-vs-project-management/',
 'problems/ai-phone-systems/index.html':'/guides/ai-receptionist-vs-answering-service-vs-voicemail/',
 'problems/answer-customers-faster/index.html':'/playbooks/customer-support-knowledge-base/',
 'problems/automate-scheduling/index.html':'/playbooks/self-service-booking/',
 'problems/create-content-faster/index.html':'/playbooks/product-launch-content-system/',
 'problems/crm-systems/index.html':'/guides/crm-vs-spreadsheet-vs-project-management/',
 'problems/email-automation/index.html':'/playbooks/email-welcome-sequence/',
 'problems/get-more-leads/index.html':'/playbooks/service-lead-follow-up/',
 'problems/manage-reviews/index.html':'/playbooks/honest-review-request-system/',
 'problems/social-media-systems/index.html':'/playbooks/ai-social-media-agents/',
 'problems/stop-missing-calls/index.html':'/guides/ai-receptionist-vs-answering-service-vs-voicemail/',
 'reports/sample-report.html':'/stack-builder/',
 'implementation/index.html':'/playbooks/',
 'implementation/ai-assistant/index.html':'/playbooks/chatgpt-project-business-brief/',
 'implementation/ai-assistant-setup/index.html':'/playbooks/chatgpt-project-business-brief/',
 'implementation/automation/index.html':'/playbooks/first-reliable-automation/',
 'implementation/automation-setup/index.html':'/playbooks/first-reliable-automation/',
 'implementation/content/index.html':'/playbooks/product-launch-content-system/',
 'implementation/content-system-setup/index.html':'/playbooks/product-launch-content-system/',
 'implementation/crm/index.html':'/playbooks/service-lead-follow-up/',
 'implementation/crm-setup/index.html':'/playbooks/service-lead-follow-up/',
 'implementation/email/index.html':'/playbooks/email-welcome-sequence/',
 'implementation/email-automation-setup/index.html':'/playbooks/email-welcome-sequence/',
 'implementation/phone/index.html':'/guides/ai-receptionist-vs-answering-service-vs-voicemail/',
 'implementation/reviews/index.html':'/playbooks/honest-review-request-system/',
 'implementation/review-system-setup/index.html':'/playbooks/honest-review-request-system/',
 'implementation/scheduling/index.html':'/playbooks/self-service-booking/',
 'implementation/scheduling-setup/index.html':'/playbooks/self-service-booking/',
 'implementation/seller-tools/index.html':'/playbooks/etsy-listing-workflow/',
 'implementation/social-media/index.html':'/playbooks/product-launch-content-system/',
 'use-cases/index.html':'/business-types/',
 'use-cases/creators.html':'/business-types/creators/',
 'use-cases/etsy-seller.html':'/business-types/etsy-sellers/',
 'use-cases/local-business.html':'/business-types/local-businesses/',
 'use-cases/real-estate.html':'/business-types/realtors/',
 'use-cases/service-business.html':'/business-types/',
 'use-cases/busy-moms.html':'/playbooks/chatgpt-project-business-brief/'
}
def refresh_legacy_link(match):
    attrs=match.group(1)
    found=re.search(r'data-tool-id="([^"]+)"',attrs)
    if not found or found.group(1) not in BY_ID:return match.group(0)
    url,rel=outbound(BY_ID[found.group(1)])
    attrs=re.sub(r'\s(?:href|rel|target)="[^"]*"','',attrs)
    return '<a'+attrs+f' href="{e(url)}" rel="{rel}" target="_blank" data-outbound="{e(found.group(1))}" data-outbound-placement="legacy_content">'
def refresh_legacy_byline(match):
    fields=dict(re.findall(r'<div>\s*<strong>([^<]+)</strong>([\s\S]*?)</div>',match.group(0)))
    author=plain(fields.get('Author','Seller Insider Hub'))
    updated=plain(fields.get('Last updated',''))
    return '<div class="article-byline"><span class="author-mark">JM</span><span>By '+e(author)+'</span>'+('<span>· Updated '+e(updated)+'</span>' if updated else '')+'<span>· <a href="/editorial-standards/">Our editorial approach</a></span></div>'
for src in sorted(ROOT.rglob('*.html')):
    rel=src.relative_to(ROOT).as_posix()
    if rel.startswith(('dist/','private/','content/','data/research/','node_modules/','.git/','community/','.openai/')) or rel in overrides: continue
    if rel in retired_routes:
        path='/'+(rel[:-10] if rel.endswith('index.html') else rel[:-5]+'/')
        for old in [path,path.rstrip('/'),'/'+rel]:legacy_redirects.append((old,retired_routes[rel]))
        continue
    stem=src.stem
    if src.parent.name=='tools' and stem in category_aliases and category_aliases[stem] in CATEGORIES:
        legacy_redirects += [(f'/tools/{stem}',f'/tool-library/category/{category_aliases[stem]}/'),(f'/tools/{stem}.html',f'/tool-library/category/{category_aliases[stem]}/'),(f'/tools/{stem}/',f'/tool-library/category/{category_aliases[stem]}/')]
        continue
    text=src.read_text(encoding='utf-8-sig')
    match=re.search(r'<body[^>]*>([\s\S]*?)</body>',text,re.I)
    if not match: continue
    body=match.group(1)
    if '</nav>' in body: body=body.split('</nav>',1)[1]
    body=re.split(r'<footer\b',body,flags=re.I)[0]
    body=re.sub(r'<script\b[\s\S]*?</script>','',body,flags=re.I)
    body=re.sub(r'\sonclick="[^"]*"','',body)
    body=re.sub(r'<a\b([^>]+)>',refresh_legacy_link,body,flags=re.I)
    body=re.sub(r'<div class="review-meta">[\s\S]*?</div>\s*</div>',refresh_legacy_byline,body)
    body=body.replace('SEO landing page for owners actively searching how to solve this problem with AI and workflow tools.','Understand the workflow, compare suitable tools, and follow the related setup guide.')
    body=body.replace('Test with real business data.','Test with representative sample data.')
    body=body.replace('Use real inquiries, posts, orders, calls, or leads.','Use synthetic or anonymized inquiries, posts, orders, calls, or leads.')
    body=body.replace('Add screenshots, logins, naming rules, and what to check weekly.','Add screenshots, access-owner references, naming rules, and what to check weekly. Keep credentials in a password manager.')
    body=re.sub(r'<div class="side"><h3>Disclosure</h3>[\s\S]*?</div>','',body)
    body=re.sub(r'Editorial fit:?\s*[0-9.]+\s*/\s*5','Documentation-based comparison',body,flags=re.I)
    body=re.sub(r'<span[^>]*class="[^"]*tool-rating[^"]*"[^>]*>[\s\S]*?</span>','',body,flags=re.I)
    title_match=re.search(r'<h1[^>]*>([\s\S]*?)</h1>',body,re.I)
    title=plain(title_match.group(1)) if title_match else src.stem.replace('-',' ').title()
    desc_match=re.search(r'<meta name="description" content="([^"]+)"',text,re.I)
    desc=unescape(desc_match.group(1)) if desc_match else 'Practical business guidance from Seller Insider Hub.'
    route='/'+(rel[:-10] if rel.endswith('index.html') else rel[:-5]+'/')
    route=re.sub('/+','/',route)
    styles=''.join(re.findall(r'<style[^>]*>[\s\S]*?</style>',text,re.I))
    section='business' if route.startswith('/business-types') else ('playbooks' if route.startswith('/implementation') else '')
    write(route,title,desc,'<div class="legacy-content">'+body+'</div>','Business guide' if section=='business' else 'Guide',section=section,legacy=True,extrahead=styles)
    if not rel.endswith('index.html'): legacy_redirects.extend([('/'+rel,route),('/'+rel[:-5],route)])

about=hero('Small businesses deserve a clear way into AI.','An independent publication providing practical AI education, software comparisons, and implementation guides for small business owners.','Our mission · Meet the founder')+'''<section class="section"><div class="wrap founder-layout"><img class="founder-image" src="/assets/img/jennie-founder.png" alt="Jennie Malone, founder of Seller Insider Hub" width="700" height="700" loading="lazy"><div><span class="eyebrow">Hi, I'm Jennie.</span><h2>You should be able to put AI to work yourself.</h2><p>I want the owner of a small business to have a clear way to use AI—even when there is no IT department to translate the tools into everyday work. That is the gap I built Seller Insider Hub to fill.</p><p>My background brings together enterprise software engineering and hands-on ecommerce. I previously worked on large business systems at Disney, and later built and operated creative businesses of my own.</p><p>Here, learning means doing something useful: preparing an accurate product listing, writing a welcome email, organizing inquiries, or setting up an automation you know how to check and stop. My goal is for you to leave with more confidence and a system you understand.</p><div class="actions"><a class="button" href="/start-here/">Find your starting point →</a><a class="button light" href="/editorial-standards/">Our editorial promise</a></div></div></div></section><section class="section tint"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Knowledge you can use</span><h2>What readers should be able to do.</h2></div></div><div class="grid three"><div class="card"><h3>Understand the choice.</h3><p>Learn what a tool can do, where it fits, what it costs, and when another approach makes more sense.</p></div><div class="card"><h3>Follow a complete example.</h3><p>Use a realistic starting point, clear instructions, and an example result you can adapt to your own business.</p></div><div class="card"><h3>Stay in control.</h3><p>Know what to check, when to pause, and how to recover if a step fails. Useful automation should be something you understand.</p></div></div></div></section><section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">A note from Jennie</span><h2>Why I built the Hub.</h2></div></div><video controls preload="none" poster="/assets/img/jennie-seller-insider-hub-founder-intro-poster.jpg" style="width:100%;max-width:850px;height:auto;display:block;border-radius:16px"><source src="/assets/video/jennie-seller-insider-hub-founder-intro.mp4" type="video/mp4">Your browser does not support this video.</video><p class="small" style="margin-top:15px">This founder introduction was created with an AI avatar using HeyGen. It introduces the publication's practical approach to tools and business workflows. <a class="link" href="/guides/how-i-made-this-ai-avatar-video-with-heygen/">Read the creation guide →</a></p><div class="card" id="website-development" style="margin-top:30px"><span class="eyebrow">The publication and its technology</span><h3>Seller Insider Hub. Developed by The Local Upgrade.</h3><p>Seller Insider Hub is the publication founded by Jennie Malone. Website software development was provided by The Local Upgrade. The publication is currently operated by The Local Upgrade LLC.</p></div></div></section>'''
write('/about/','About Jennie and Seller Insider Hub','Why Jennie Malone built Seller Insider Hub: practical AI knowledge for small business owners without an IT department. Learn the mission and meet the founder.',about,'About')

editorial=hero('Useful advice needs an honest foundation','How I research tools, build complete examples, explain recommendations, and correct mistakes.','Our editorial standards')+editorial_standards()
write('/editorial-standards/','Editorial standards','How Seller Insider Hub researches products, explains evidence, handles affiliate relationships, and corrects mistakes.',editorial,'Editorial')

write('/authors/jennie-malone/','Jennie Malone: founder and publisher','Meet Jennie Malone, founder of Seller Insider Hub. Her background, editorial approach, tutorials, and software comparisons.',hero('Jennie Malone','Practical technology guidance for the work behind your small business.','Meet the author')+author_profile(PLAYS,COMPARISONS),'Author',modified=REVIEW_DATE)
write('/corrections/','Corrections and article updates','Report a specific error in a Seller Insider Hub guide, comparison, calculation, or software instruction.',hero('Help keep the instructions accurate','Tell us which claim or step needs another look.','Corrections')+corrections_page(),'Editorial',modified=REVIEW_DATE)

partner=hero('A useful home for products worth understanding','Seller Insider Hub helps small business owners understand AI and use it themselves, with practical education for people without an IT department.','For affiliate and partnership teams')+f'''<section class="section"><div class="wrap"><div class="grid three"><div class="card"><span class="eyebrow">Publisher</span><h3>Clear operator identity</h3><p>Seller Insider Hub is operated by The Local Upgrade LLC and founded by Jennie Malone, with a background in enterprise software and ecommerce.</p></div><div class="card"><span class="eyebrow">Audience</span><h3>Business owners with a job to do</h3><p>Coverage serves ecommerce and Etsy sellers, creators, service businesses, local businesses, and small teams choosing practical software.</p></div><div class="card"><span class="eyebrow">Format</span><h3>Useful context around the click</h3><p>Tool profiles, substantive comparisons, implementation playbooks, business guides, and interactive decision tools.</p></div></div><div class="detail-layout"><article class="article-body"><h2>What we look for in a partner</h2><ul><li>A product with a clear use case, accessible documentation, and honest pricing.</li><li>A transparent program with explicit qualifying events, attribution, and payment terms.</li><li>Respect for editorial independence and clear commercial disclosures.</li><li>Onboarding and product support handled by the vendor.</li></ul><h2>What a partnership can include</h2><p>Relevant links within researched profiles, comparisons, and workflow guides; educational product demonstrations when supported by a real test; and clearly disclosed sponsorships agreed separately. No coverage, rankings, traffic, sales, or positive conclusions are guaranteed.</p><h2>Review the publication</h2><div class="actions">{btn('Explore the tool library','/tool-library/','light')}{btn('Read comparisons','/comparisons/','light')}{btn('Editorial standards','/editorial-standards/','light')}</div><h2>Partner contact</h2><p>Email <a href="mailto:partners@sellerinsiderhub.com">partners@sellerinsiderhub.com</a> with the official program information, eligibility requirements, and relevant product documentation.</p></article><aside class="detail-sidebar"><div class="card"><h3>Publisher information</h3><dl><dt>Publication</dt><dd>Seller Insider Hub</dd><dt>Operator</dt><dd>The Local Upgrade LLC</dd><dt>Founder</dt><dd>Jennie Malone</dd><dt>Website</dt><dd>sellerinsiderhub.com</dd><dt>Public research scope</dt><dd>{len(TOOLS)} tool profiles · {len(COMPARISONS)} comparison guides · {len(PLAYS)} playbooks</dd></dl></div></aside></div></div></section>'''
partner=partner.replace('<section class="section">','''<section class="section tint"><div class="wrap section-head"><div><p class="eyebrow">For investors</p><h2>Explore the business behind the publication.</h2><p style="max-width:670px;margin-top:18px">Our investor room brings together sourced market context, software referral economics, and an interactive scenario builder. Explore how commissions, retention, expenses, and payment timing affect a publication over time.</p></div><a class="button" href="/partners/investors/">Investor sign in ↗</a></div></section><section class="section">''',1)
write('/partners/','Partner with Seller Insider Hub','Publisher information, editorial standards, partnership contact, and access to the investor scenario room.',partner,'Partners')

contact=hero('Get in touch','Send a specific editorial question, correction, or partnership inquiry. Please avoid sending confidential customer or account information.','Contact the Hub')+'''<section class="section"><div class="wrap grid two"><div class="card"><h2>Send a note</h2><form name="sih-contact" method="POST" data-netlify="true" netlify-honeypot="website" action="/thank-you/" style="margin-top:25px"><input type="hidden" name="form-name" value="sih-contact"><p hidden><label>Leave empty<input name="website" tabindex="-1"></label></p><div class="field"><label for="contact-name">Name</label><input id="contact-name" name="name" autocomplete="name" required maxlength="120"></div><div class="field"><label for="contact-email">Email</label><input type="email" name="email" id="contact-email" autocomplete="email" required></div><div class="field"><label for="contact-topic">Topic</label><select id="contact-topic" name="topic"><option>Editorial correction</option><option>Partnership inquiry</option><option>Website issue</option><option>Privacy request</option></select></div><div class="field"><label for="contact-message">Your message</label><textarea id="contact-message" name="message" required maxlength="5000"></textarea></div><button class="button" type="submit">Send message →</button><p class="small" style="margin-top:12px">Read how we handle information in our <a class="link" href="/legal/privacy/">privacy policy</a>.</p></form></div><div><div class="card"><h3>Prefer email?</h3><p><a class="link" href="mailto:partners@sellerinsiderhub.com">partners@sellerinsiderhub.com</a></p><p style="margin-top:15px">For product support, billing, cancellations, or account access, contact the software vendor directly. Seller Insider Hub is an independent publication.</p></div><div class="card" style="margin-top:20px"><h3>Useful details for a correction</h3><p>Include the page URL, the specific claim, and a current official source. That makes it easier to investigate and update the guide.</p></div></div></div></section>'''
write('/contact/','Contact Seller Insider Hub','Contact Seller Insider Hub for editorial corrections, partnership inquiries, website issues, and privacy requests.',contact,'Contact')

legal={
'affiliate-disclosure':('Affiliate disclosure','Some links on Seller Insider Hub may earn a commission when a reader purchases or completes a qualifying action. This does not increase the price charged to you by us. Commissions depend on the vendor’s program and do not guarantee a particular outcome.','We choose coverage based on practical relevance and available evidence. Compensation does not buy a favorable review or guaranteed ranking. Links without an active affiliate relationship may still point directly to useful products.','A product mention is not a promise that it will fit your situation. Confirm current features, prices, contract terms, and cancellation conditions with the provider. Contact partners@sellerinsiderhub.com with questions about a specific relationship.'),
'privacy':('Privacy policy','Seller Insider Hub is operated by The Local Upgrade LLC. When you submit a form, we collect the information you enter, such as your name, email address, topic, message, and consent. We use it to process the request or email-list signup. Do not submit confidential customer records, passwords, payment-card details, or sensitive personal information.','The site is hosted on Netlify, which can process form submissions and technical request information. Typography may be loaded from Google Fonts, which receives technical connection information. With your consent, Google Analytics measures visits and interactions. We do not place form contents, email addresses, or calculator inputs into analytics events. You can decline analytics or change your choice in Cookie preferences. Software vendors and affiliate networks have their own privacy practices when you follow their links.','Saved tools, reading lists, and saved stacks are stored locally in your browser. Calculator inputs remain on the current page unless you export them. They do not create a cloud account or sync automatically. You can export or clear your saved workspace. Newsletter signup requests permission for email; each marketing email should include an unsubscribe option. To request access, correction, deletion, or withdrawal of consent, contact partners@sellerinsiderhub.com. We retain submitted information only as needed for the stated purpose, operational requirements, and applicable obligations. We do not sell your personal information. This site is intended for adult business users.'),
'terms':('Terms of use','Seller Insider Hub provides general educational information, tool comparisons, and planning calculators. Information may change, contain errors, or be incomplete. The site does not provide personalized legal, tax, medical, investment, or professional advice. Calculator outputs are estimates based on the inputs and disclosed assumptions, not guaranteed savings, sales, or income.','Software purchases, trials, billing, cancellations, and service agreements are between you and the relevant provider. We do not control vendor availability, features, prices, or support. Review the provider’s current terms before purchasing. Links may be affiliate-supported as explained in the affiliate disclosure.','You may use the free worksheets for your own business. Do not misrepresent our content, submit unlawful material, attempt unauthorized access, or use forms for spam. Browser-local saved work can be lost if you clear storage; export a backup when needed. Contact partners@sellerinsiderhub.com for questions or permissions. These terms and the privacy policy may be updated as site practices change.')}
for slug,(title,a,b,c) in legal.items():
    body=hero(title,'Publication practices and visitor information.','Trust & transparency')+f'<div class="wrap simple-article"><p class="small">Updated {PAGE_DATES.get("/legal/"+slug+"/",{}).get("modified",DATE)}</p><h2>What to know</h2><p>{e(a)}</p><h2>How it works</h2><p>{e(b)}</p><h2>Your choices and responsibilities</h2><p>{e(c)}</p><p>Operator: The Local Upgrade LLC · <a href="mailto:partners@sellerinsiderhub.com">partners@sellerinsiderhub.com</a></p></div>'
    write('/legal/'+slug+'/',title,a[:150],body,'Policy')
write('/thank-you/','Thank you for getting in touch','Your next useful resource is ready to explore.',hero('Thank you. Keep exploring.','You can continue with the tool library, practical playbooks, or your saved workspace.','Your next move')+'<section class="section"><div class="wrap"><div class="grid three">'+''.join(f'<a class="card card-link" href="{url}"><h3>{title}</h3><p>{desc}</p></a>' for url,title,desc in [('/tool-library/','Find a useful tool','Explore the options by the job you need done.'),('/playbooks/','Put a system to work','Follow a complete workflow with checks along the way.'),('/resources/','Keep a useful template','Download free worksheets and planning tools.')])+'</div></div></section>','Confirmation',noindex=True)
write('/start-here/','Find your way through the Hub','Choose a task you want to handle, then follow the explanation, example, and setup steps. Build your understanding as you put AI to work.',hero('Find your way through the Hub','Choose a task you want to handle, then follow the explanation, example, and setup steps. Build your understanding as you put AI to work.','Start here')+learning_banner+'<section class="section"><div class="wrap grid two">'+''.join(f'<a class="card card-link" href="{url}"><span class="eyebrow">{label}</span><h3>{title}</h3><p>{desc}</p></a>' for label,url,title,desc in [('Learn','/guides/getting-started-with-ai/','I am new to using AI','Learn how to brief an AI assistant, check its work, and finish one useful task.'),('Organize','/business-systems-map/','I need to see how it fits together','Map the customer journey and find the handoff that needs fixing.'),('Choose','/stack-builder/','I need a useful toolkit','Build a personalized starting stack from your business and goals.'),('Compare','/comparisons/','I am choosing between tools','Look at the actual differences and when each option makes sense.'),('Implement','/playbooks/','I want a clear setup process','Follow a documented setup, check that it works, and learn how to fix common problems.'),('Calculate','/calculators/','I want to understand the cost','Use your own numbers to compare time, subscriptions, and new storefront costs.'),('Prioritize','/decision-funnels/what-should-i-automate-first/','I need to choose what to automate first','Compare repeated tasks by the time they take, their failure cost, and the checks they need.'),('Plan','/affiliate/best-ai-tools-small-business/','I need a practical software starting point','Build a small-business toolkit around real work and understand its costs.')])+'</div></section>','Guide')

# Redirects retain old entry URLs without publishing duplicate or unsafe legacy widgets.
redirects=[('https://www.sellerinsiderhub.com/*','https://sellerinsiderhub.com/:splat','301!'),('/tools/ai-solutions-concierge','/stack-builder/','301!'),('/tools/ai-solutions-concierge.html','/stack-builder/','301!'),('/tools/ai-solutions-concierge/','/stack-builder/','301!'),('/affiliate/partners','/partners/','301!'),('/affiliate/partners.html','/partners/','301!'),('/affiliate/partners/','/partners/','301!'),('/affiliate/recommended-tools','/tool-library/','301!'),('/affiliate/recommended-tools.html','/tool-library/','301!'),('/affiliate/recommended-tools/','/tool-library/','301!'),('/admin','/workspace/','302!'),('/admin/*','/workspace/','302!'),('/community','/workspace/','302!'),('/community/*','/workspace/','302!')]
# Historical public entry URLs reported by Search Console have useful successors.
# Keep unrelated removed URLs as real 404s; never redirect all missing pages.
historical_entry_routes={
 '/tools/voice-tools':'/tool-library/category/video-audio/',
 '/playbooks/start-using-ai':'/guides/getting-started-with-ai/',
 '/tools/ai-setup-generator':'/stack-builder/',
 '/tools':'/tool-library/'
}
for old,new in historical_entry_routes.items():
    for source in [old,old+'.html',old+'/index.html']:
        redirects.append((source,new,'301!'))
for old,new in legacy_redirects:
    # Netlify matches both trailing-slash variants before applying redirects.
    # A forced /page -> /page/ rule therefore redirects the canonical to itself.
    # Directory index files already receive Netlify's normal slash handling.
    if old.rstrip('/')!=new.rstrip('/'): redirects.append((old,new,'301!'))
for page in PAGES:
    route=page['route']
    if route!='/':
        redirects.append((route.rstrip('/')+'.html',route,'301!'))
        redirects.append((route+'index.html',route,'301!'))
redirects.append(('/index.html','/','301!'))
(OUT/'_redirects').write_text('\n'.join(' '.join(row) for row in dict.fromkeys(redirects))+'\n')
(OUT/'_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/assets/*\n  Cache-Control: public, max-age=86400\n/data/*\n  Cache-Control: public, max-age=0, must-revalidate\n/feed.xml\n  Content-Type: application/rss+xml; charset=utf-8\n  Cache-Control: public, max-age=300, must-revalidate\n/atom.xml\n  Content-Type: application/atom+xml; charset=utf-8\n  Cache-Control: public, max-age=300, must-revalidate\n/feeds/pinterest.xml\n  Content-Type: application/rss+xml; charset=utf-8\n  Cache-Control: public, max-age=300, must-revalidate\n')
(OUT/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /partners/investors\nSitemap: '+ORIGIN+'/sitemap.xml\nSitemap: '+ORIGIN+'/atom.xml\n')
feed_entries = write_feeds(OUT, ORIGIN, FEED)
write_pinterest_feed(OUT, ORIGIN, FEED, load('editorial-images.json')['images'])
(OUT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+ORIGIN+e(s['url'])+'</loc><lastmod>'+s['modified']+'</lastmod></url>' for s in SEARCH)+'</urlset>')
(OUT/'llms.txt').write_text('# Seller Insider Hub\n\n> Independent practical AI and software guidance for small businesses.\n\n## Tutorials\n'+''.join('- ['+p['title']+']('+ORIGIN+'/playbooks/'+p['id']+'/)\n' for p in PLAYS)+'\n## Comparisons\n'+''.join('- ['+c['title']+']('+ORIGIN+'/comparisons/'+c['id']+'/)\n' for c in COMPARISONS)+'\n## Publication\n- [Editorial standards]('+ORIGIN+'/editorial-standards/)\n- [Founder and operator]('+ORIGIN+'/about/)\n- [Tool guides]('+ORIGIN+'/tool-library/)\n',encoding='utf-8')
(OUT/'data/search-index.json').write_text(j(SEARCH),encoding='utf-8')
(OUT/'404.html').write_text(layout('This page took a different turn','Find the resource you need in the tool library or site search.',hero('This page took a different turn.','Try searching the Hub or explore the latest tools and guides.','Page not found')+'<section class="section"><div class="wrap actions">'+btn('Search the Hub','/search/')+btn('Go home','/','light')+'</div></section>','/404.html',noindex=True))
# Keep site verification files; avoid exposing internal notes, source code, or Supabase config.
for src in ROOT.glob('*.txt'):
    if re.fullmatch(r'[a-f0-9]{32}\.txt',src.name): shutil.copy(src,OUT/src.name)
investor_room=build_investor_room(ROOT)
(ROOT/'docs/build-report.json').write_text(json.dumps({'built':REVIEW_DATE,'pages':len(PAGES),'indexed':len(SEARCH),'tools':len(TOOLS),'categories':len(CATEGORIES),'comparisons':len(COMPARISONS),'playbooks':len(PLAYS),'feedEntries':feed_entries,'investorRoom':investor_room,'routes':PAGES},indent=2))
print(json.dumps({'pages':len(PAGES),'tools':len(TOOLS),'comparisons':len(COMPARISONS),'playbooks':len(PLAYS),'output':str(OUT)}))
