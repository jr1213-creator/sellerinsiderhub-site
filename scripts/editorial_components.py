"""Publication components: reader jobs and substantial teaching lead the page."""
from html import escape
from brand_components import brand_mark
from editorial_images import cover, cover_credit

def h(value): return escape(str(value), quote=True)

def story_card(p, i=0, *, placement="card"):
    return f'''<article class="editorial-card"><a class="story-image" href="/playbooks/{h(p['id'])}/" tabindex="-1" aria-hidden="true">{cover(p['id'],i,placement=placement)}</a><div class="story-copy"><span class="eyebrow">{h(p['category'])} / Tutorial</span><h3><a href="/playbooks/{h(p['id'])}/">{h(p['title'])}</a></h3><p>{h(p['summary'])}</p><a class="read-link" href="/playbooks/{h(p['id'])}/">Read the tutorial <span>↗</span></a></div></article>'''

def render_home(plays, comparisons, comparecard, newsletter):
    by_id={p['id']:p for p in plays}
    lead=by_id.get('ai-social-media-agents',by_id.get('email-welcome-sequence',plays[0]))
    side=[by_id[id] for id in ['email-welcome-sequence','etsy-listing-workflow'] if id in by_id]
    tutorials=[by_id[id] for id in ['product-launch-content-system','customer-support-knowledge-base','service-lead-follow-up'] if id in by_id]
    paths=[('✳','Learn to use AI','Write a clear brief, check the answer, and improve the result.','/guides/getting-started-with-ai/'),('✉','Build your audience','Email systems that start with a useful promise.','/playbooks/email-welcome-sequence/'),('↗','Automate the repeat work','Connect your tools and catch the failures.','/playbooks/first-reliable-automation/'),('▦','Run a better business','Keep leads, information, and decisions organized.','/playbooks/business-operations-hub/')]
    return f'''<section class="publication-intro"><div class="wrap"><div><span class="eyebrow">AI KNOW-HOW FOR SMALL BUSINESS</span><h1>Understand AI<span class="signature-period">.</span><br><em>Put it to work<span class="signature-period">.</span></em></h1></div><div class="intro-aside"><p>Seller Insider Hub is an independent publication helping small businesses understand and use AI. Our tutorials, software comparisons, and worked examples give owners practical instructions they can follow without an IT department.</p><a class="text-button" href="/start-here/">Find your starting point ↗</a></div></div></section>
    <section class="front-page"><div class="wrap"><div class="editorial-kicker"><span>THE PRACTICAL EDIT</span><span>Detailed guides for the work on your desk.</span></div><div class="lead-grid"><article class="lead-story"><a href="/playbooks/{h(lead['id'])}/" class="lead-image" tabindex="-1" aria-hidden="true">{cover(lead['id'],priority=True,placement='lead')}</a><div class="lead-copy"><span class="eyebrow">{h(lead['category'])} / Step-by-step guide</span><h2><a href="/playbooks/{h(lead['id'])}/">{h(lead['title'])}</a></h2><p>{h(lead['summary'])}</p><div class="lead-meta"><span>Examples · Setup steps · Troubleshooting</span><a href="/playbooks/{h(lead['id'])}/">Read the guide ↗</a></div></div></article><div class="side-stories">{''.join(story_card(p,i,placement="side") for i,p in enumerate(side))}</div></div>{cover_credit()}</div></section>
    <section class="topic-rail"><div class="wrap"><span class="eyebrow">WHAT DO YOU NEED TO DO?</span><div class="topic-paths">{''.join(f'<a href="{url}"><span class="topic-icon">{symbol}</span><div><h3>{title}</h3><p>{desc}</p></div><b>↗</b></a>' for symbol,title,desc,url in paths)}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">THE INSTRUCTIONS, FROM START TO FINISH</span><h2>Build a workflow you understand.</h2></div><a href="/playbooks/">All tutorials ↗</a></div><div class="grid three editorial-grid">{''.join(story_card(p,i+2) for i,p in enumerate(tutorials))}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Choose the right kind of help</span><h2>What should the software handle?</h2></div></div><div class="grid two"><a class="card card-link" href="/tools/ai-assistant/"><span class="eyebrow">AI assistants</span><h3>Choose an assistant with your own business tasks.</h3><p>Compare the job, plan, permissions, and correction work. Start with complete seller, service, and creator examples.</p><span class="read-link">Read the decision guide →</span></a><a class="card card-link" href="/guides/ai-receptionist-vs-answering-service-vs-voicemail/"><span class="eyebrow">Calls and customer intake</span><h3>Voicemail, a phone menu, AI, or a human?</h3><p>Understand the bill, build the handoff, and check what happens when a call or booking fails.</p><span class="read-link">Compare the four options →</span></a></div></div></section><section class="section comparison-section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Before you choose</span><h2>Which tool is worth paying for?</h2></div><a href="/comparisons/">All comparisons ↗</a></div><div class="grid three">{''.join(comparecard(c) for c in comparisons if c['id'] in ['chatgpt-vs-claude','mailerlite-vs-kit','zapier-vs-make'])}</div></div></section>
    <section class="section"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Start with your kind of business</span><h2>Find the guide for your business.</h2></div><a href="/business-types/">All business guides ↗</a></div><div class="audience-grid"><a href="/business-types/etsy-sellers/"><span>01 / SELL</span><h3>Etsy & ecommerce</h3><p>Accurate listings. Better customer emails. A clearer path from order to fulfillment.</p><b>Explore the seller guides ↗</b></a><a href="/business-types/creators/"><span>02 / CREATE</span><h3>Creators & independent brands</h3><p>A repeatable content process, an audience you can reach, and fewer disconnected tools.</p><b>Explore the creator guides ↗</b></a><a href="/business-types/local-businesses/"><span>03 / SERVE</span><h3>Local & service businesses</h3><p>Turn inquiries into organized follow-up. Make bookings and routine questions easier.</p><b>Explore the business guides ↗</b></a></div></div></section>
    <section class="practical-strip"><div class="wrap"><div><span class="eyebrow">Make the decision your own</span><h2>Calculate the cost. Keep the shortlist.</h2><p>Compare your shortlist, work out the costs, or keep the guides you want to come back to.</p></div><div class="practical-links"><a href="/compare/">Compare tools side by side <span>↗</span></a><a href="/calculators/">Run the numbers <span>↗</span></a><a href="/resources/">Download a useful worksheet <span>↗</span></a><a href="/stack-builder/">Find a toolkit for your business <span>↗</span></a></div></div></section>
    <section class="publication-note"><div class="wrap">{brand_mark()}<div><h2>Build skills you can keep using.</h2><p>The purpose of Seller Insider Hub is to help you understand and use AI yourself. We explain the setup, the reasons behind each step, and how to check the result. Dated sources, clear costs, and honest limitations help you decide what belongs in your business. <a href="/editorial-standards/">Read our editorial standards →</a></p></div></div></section>{newsletter()}'''

def tutorial_extras(p):
    html=''
    if p.get('expectedOutcome'): html+=f'<div class="answer-box"><span class="eyebrow">What you’ll have when you finish</span><p>{h(p["expectedOutcome"])}</p></div>'
    if p.get('prerequisites'): html+='<section id="before-you-start"><h2>Before you start</h2><ul class="prerequisite-list">'+''.join('<li>'+h(v)+'</li>' for v in p['prerequisites'])+'</ul></section>'
    if p.get('planTradeoffs'):
        html+='<section id="plan-requirements"><h2>Plan requirements and costs</h2><ul>'+''.join('<li>'+h(v)+'</li>' for v in p['planTradeoffs'])+'</ul></section>'
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
