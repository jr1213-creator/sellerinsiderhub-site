"""Publication components: reader jobs and substantial teaching lead the page."""
from html import escape

def h(value): return escape(str(value), quote=True)

def cover(slug, variant=0):
    if slug == 'ai-social-media-agents':
        return '''<div class="story-art art-social" aria-hidden="true"><span class="art-caption">YOUR SOCIAL MEDIA, WORKING TOGETHER</span><div class="social-cover"><span class="social-cover-pill">THE PRACTICAL FIELD GUIDE</span><strong>Plan it.<br>Publish it.<br>Keep the conversation going.</strong><div><span>AI + your expertise</span><span>Connected tools ↗</span></div></div></div>'''
    if any(word in slug for word in ('email','welcome')):
        return '''<div class="story-art art-email" aria-hidden="true"><span class="art-caption">THE WELCOME SEQUENCE</span><div class="mail-sheet"><span class="mail-topline">YOUR BUSINESS · A BETTER FIRST IMPRESSION</span><div class="mail-subject">You’re in.<br>Here’s what comes next.</div><div class="mail-rule"></div><span class="mail-line"></span><span class="mail-line short"></span><span class="mail-cta">One useful next step →</span></div><span class="art-stamp">Write. Build. Check.</span></div>'''
    if any(word in slug for word in ('automation','lead')):
        return '''<div class="story-art art-automation" aria-hidden="true"><span class="art-caption">A WORKFLOW YOU CAN RELY ON</span><div class="flow-art"><div><b>01</b><strong>New inquiry</strong><span>The right trigger</span></div><i>↓</i><div><b>02</b><strong>Check the details</strong><span>No missing information</span></div><i>↓</i><div><b>03</b><strong>Follow through</strong><span>A clear next action</span></div></div><span class="art-stamp">Connect the work.</span></div>'''
    if any(word in slug for word in ('etsy','product','launch')):
        return '''<div class="story-art art-content" aria-hidden="true"><span class="art-caption">BETTER INPUTS. BETTER CONTENT.</span><div class="product-art"><div class="product-shape"><span>THE<br>REAL<br>DETAILS.</span></div><div class="product-notes"><span>✓ Materials</span><span>✓ Dimensions</span><span>✓ Care instructions</span><span>✓ What’s included</span><strong>Facts first.<br>AI draft second.</strong></div></div><span class="art-stamp">Make every claim count.</span></div>'''
    palettes=['#e9e3f3','#e8eddc','#f5e8b9','#e2e9e9']
    return f'''<div class="story-art art-system" style="background:{palettes[variant%4]}" aria-hidden="true"><span class="art-caption">SMALL BUSINESS, BETTER SYSTEMS</span><div class="system-art"><span>THE TASK</span><i>↘</i><strong>A clear<br>way forward.</strong><div><b>Prepare</b><b>Put it to work</b><b>Check the result</b></div></div></div>'''

def story_card(p, i=0):
    return f'''<article class="editorial-card"><a class="story-image" href="/playbooks/{h(p['id'])}/" tabindex="-1" aria-hidden="true">{cover(p['id'],i)}</a><div class="story-copy"><span class="eyebrow">{h(p['category'])} / Tutorial</span><h3><a href="/playbooks/{h(p['id'])}/">{h(p['title'])}</a></h3><p>{h(p['summary'])}</p><a class="read-link" href="/playbooks/{h(p['id'])}/">Read the complete guide <span>↗</span></a></div></article>'''

def render_home(plays, comparisons, comparecard, newsletter):
    by_id={p['id']:p for p in plays}
    lead=by_id.get('ai-social-media-agents',by_id.get('email-welcome-sequence',plays[0]))
    side=[by_id[id] for id in ['email-welcome-sequence','etsy-listing-workflow'] if id in by_id]
    tutorials=[by_id[id] for id in ['product-launch-content-system','customer-support-knowledge-base','service-lead-follow-up'] if id in by_id]
    paths=[('✳','Use AI well','Prompts, product facts, research, and reliable outputs.','/comparisons/chatgpt-vs-claude/'),('✉','Build your audience','Email systems that start with a useful promise.','/playbooks/email-welcome-sequence/'),('↗','Automate the repeat work','Connect your tools and catch the failures.','/playbooks/first-reliable-automation/'),('▦','Run a better business','Keep leads, information, and decisions organized.','/playbooks/business-operations-hub/')]
    return f'''<section class="publication-intro"><div class="wrap"><div><span class="eyebrow">Practical intelligence for independent businesses</span><h1>Make AI work for<br><em>your small business.</em></h1></div><div class="intro-aside"><p>Learn what’s useful. Understand the tradeoffs.<br>Build something that makes your work better.</p><a class="text-button" href="/playbooks/">Explore the tutorials ↗</a></div></div></section>
    <section class="front-page"><div class="wrap"><div class="editorial-kicker"><span>THE INSIDER EDIT</span><span>Clear explanations. Useful examples. Work you can put into practice.</span></div><div class="lead-grid"><article class="lead-story"><a href="/playbooks/{h(lead['id'])}/" class="lead-image" tabindex="-1" aria-hidden="true">{cover(lead['id'])}</a><div class="lead-copy"><span class="eyebrow">{h(lead['category'])} / The complete guide</span><h2><a href="/playbooks/{h(lead['id'])}/">{h(lead['title'])}</a></h2><p>{h(lead['summary'])}</p><div class="lead-meta"><span>Examples · Setup steps · Troubleshooting</span><a href="/playbooks/{h(lead['id'])}/">Read the guide ↗</a></div></div></article><div class="side-stories">{''.join(story_card(p,i) for i,p in enumerate(side))}</div></div></div></section>
    <section class="topic-rail"><div class="wrap"><span class="eyebrow">Find your next useful answer</span><div class="topic-paths">{''.join(f'<a href="{url}"><span class="topic-icon">{symbol}</span><div><h3>{title}</h3><p>{desc}</p></div><b>↗</b></a>' for symbol,title,desc,url in paths)}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Understand it. Then put it to work.</span><h2>From a good idea to a working system.</h2></div><a href="/playbooks/">All tutorials ↗</a></div><div class="grid three editorial-grid">{''.join(story_card(p,i+2) for i,p in enumerate(tutorials))}</div></div></section>
    <section class="section comparison-section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Before you choose</span><h2>The differences that actually matter.</h2></div><a href="/comparisons/">All comparisons ↗</a></div><div class="grid three">{''.join(comparecard(c) for c in comparisons if c['id'] in ['chatgpt-vs-claude','mailerlite-vs-omnisend','zapier-vs-make'])}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Start with your kind of business</span><h2>Advice with your work in mind.</h2></div><a href="/business-types/">All business guides ↗</a></div><div class="audience-grid"><a href="/business-types/etsy-sellers/"><span>01 / SELL</span><h3>Etsy & ecommerce</h3><p>Accurate listings. Better customer emails. A clearer path from order to fulfillment.</p><b>Explore the seller guides ↗</b></a><a href="/business-types/creators/"><span>02 / CREATE</span><h3>Creators & independent brands</h3><p>A repeatable content process, an audience you can reach, and fewer disconnected tools.</p><b>Explore the creator guides ↗</b></a><a href="/business-types/local-businesses/"><span>03 / SERVE</span><h3>Local & service businesses</h3><p>Turn inquiries into organized follow-up. Make bookings and routine questions easier.</p><b>Explore the business guides ↗</b></a></div></div></section>
    <section class="practical-strip"><div class="wrap"><div><span class="eyebrow">Make the decision your own</span><h2>A little help with the details.</h2><p>Compare your shortlist, work out the costs, or keep the guides you want to come back to.</p></div><div class="practical-links"><a href="/compare/">Compare tools side by side <span>↗</span></a><a href="/calculators/">Run the numbers <span>↗</span></a><a href="/resources/">Download a useful worksheet <span>↗</span></a><a href="/stack-builder/">Find a toolkit for your business <span>↗</span></a></div></div></section>
    <section class="publication-note"><div class="wrap"><span class="brand-mark">si.</span><div><h2>Better decisions start with a clear explanation.</h2><p>We connect official product documentation with practical business workflows, explain limitations, and show our sources. <a href="/editorial-standards/">Read our editorial standards →</a></p></div></div></section>{newsletter()}'''

def tutorial_extras(p):
    html=''
    if p.get('expectedOutcome'): html+=f'<div class="answer-box"><span class="eyebrow">What you’ll have when you finish</span><p>{h(p["expectedOutcome"])}</p></div>'
    if p.get('prerequisites'): html+='<section id="before-you-start"><h2>Before you start</h2><ul class="prerequisite-list">'+''.join('<li>'+h(v)+'</li>' for v in p['prerequisites'])+'</ul></section>'
    example=p.get('example')
    if example:
        html+=f'<section class="worked-example" id="worked-example"><span class="eyebrow">A worked example</span><h2>{h(example.get("title","Use this example"))}</h2><p>Illustrative sample: adapt the business details before using it.</p><div class="example-label"><h3>Start with this input</h3><button class="button light small" data-copy-target="example-input">Copy input</button></div><pre id="example-input">{h(example.get("input",""))}</pre><h3>What a useful result looks like</h3><pre class="example-output">{h(example.get("output",""))}</pre></section>'
    return html

def tutorial_troubleshooting(p):
    items=p.get('troubleshooting',[])
    if not items:return ''
    return '<section id="troubleshooting"><h2>Troubleshooting</h2>'+''.join(f'<details class="troubleshoot-item"><summary>{h(t["problem"])}</summary><p>{h(t["fix"])}</p></details>' for t in items)+'</section>'

def tutorial_templates(p):
    html=''
    if p.get('configuration'):
        html+='<section id="configuration"><h2>The example setup, field by field</h2><p>These settings belong to the example in this guide. Adapt them to your own workflow.</p><div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Field</th><th scope="col">Example setting</th><th scope="col">Why it matters</th></tr></thead><tbody>'+''.join(f'<tr><th scope="row">{h(row["field"])}</th><td>{h(row["value"])}</td><td>{h(row["why"])}</td></tr>' for row in p['configuration'])+'</tbody></table></div></section>'
    for i,t in enumerate(p.get('copyableTemplates',[])):
        html+=f'<section class="worked-example"><div class="example-label"><h3>{h(t["title"])}</h3><button class="button light small" data-copy-target="template-{i}">Copy template</button></div><pre id="template-{i}">{h(t["content"])}</pre></section>'
    if p.get('instructionBasis'):html+=f'<p class="small muted">{h(p["instructionBasis"])}</p>'
    return html
