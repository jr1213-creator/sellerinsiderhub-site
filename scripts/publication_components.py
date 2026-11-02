"""Evidence-led article components shared by the publication."""
from html import escape
from urllib.parse import urlparse


def h(value):
    return escape(str(value), quote=True)


def ul(items):
    return '<ul>' + ''.join('<li>' + h(x) + '</li>' for x in items) + '</ul>'


def source_link(url, label='Source'):
    if not url:
        return ''
    return f'<a class="source-link" href="{h(url)}" target="_blank" rel="noopener">{h(label)} ↗</a>'


def named_sources(record, fallback_urls=()):
    entries = record.get('namedSources') or record.get('sources') or []
    date = record.get('lastReviewed') or record.get('checkedAt') or '2026-11-01'
    seen = set()
    rows = []
    for entry in entries:
        if isinstance(entry, str):
            entry = {'url': entry}
        url = entry.get('url', '')
        if not url or url in seen:
            continue
        seen.add(url)
        title = entry.get('title') or urlparse(url).netloc.replace('www.', '')
        support = entry.get('claims') or entry.get('supports') or []
        if isinstance(support, str):
            support = [support]
        detail = ' '.join(support[:2])
        rows.append(f'<li>{source_link(url, title)}<span class="source-date">Checked {h(entry.get("checkedAt", date))}</span>' + (f'<p>{h(detail)}</p>' if detail else '') + '</li>')
    for url in fallback_urls:
        if url not in seen:
            seen.add(url)
            rows.append(f'<li>{source_link(url, urlparse(url).netloc.replace("www.", "") + " · " + urlparse(url).path.rstrip("/").split("/")[-1].replace("-", " "))}</li>')
    notes = record.get('reviewNotes') or ([record['reviewNote']] if record.get('reviewNote') else [])
    if isinstance(notes, str):
        notes = [notes]
    intro = ''.join(f'<p>{h(note)}</p>' for note in notes)
    if not rows:
        return '<section class="research-record" id="research-record"><h2>About this guide</h2>' + intro + '</section>'
    return '<section class="research-record" id="research-record"><span class="eyebrow">The evidence behind this guide</span><h2>Sources and review notes</h2>' + intro + '<ol class="named-sources">' + ''.join(rows) + '</ol></section>'


def table(headers, rows):
    return '<div class="table-scroll"><table class="data-table"><thead><tr>' + ''.join(f'<th scope="col">{h(x)}</th>' for x in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join((f'<th scope="row">{cell}</th>' if i == 0 else f'<td>{cell}</td>') for i, cell in enumerate(row)) + '</tr>' for row in rows) + '</tbody></table></div>'


def comparison_details(c, first, second):
    result = ''
    pricing = c.get('pricingRows', [])
    if pricing:
        rows = []
        for item in pricing:
            rows.append([h(item['label']), h(item['first']) + ('<br>' + source_link(item.get('firstSource')) if item.get('firstSource') else ''), h(item['second']) + ('<br>' + source_link(item.get('secondSource')) if item.get('secondSource') else '')])
        result += '<section id="plans-and-costs"><span class="eyebrow">Plans, allowances, and the bill</span><h2>What the relevant plans cost</h2><p class="small">Prices reviewed ' + h(c.get('lastReviewed', '2026-11-01')) + '. Billing periods, units, and scenario assumptions are shown below.</p>' + table(['Decision', first, second], rows) + '</section>'
    scenario = c.get('scenario')
    if scenario:
        result += f'<section class="scenario-panel" id="worked-scenario"><span class="eyebrow">A worked decision</span><h2>{h(scenario.get("title", "Compare the same job"))}</h2><p class="example-tag">Illustrative scenario · calculations use the assumptions below</p>'
        result += ul(scenario.get('assumptions', []))
        rows = []
        for row in scenario.get('calculationRows', []):
            rows.append([h(row['label']), h(row['first']) + ('<br>' + source_link(row.get('firstSource')) if row.get('firstSource') else ''), h(row['second']) + ('<br>' + source_link(row.get('secondSource')) if row.get('secondSource') else '')])
        if rows:
            result += table(['Step in the calculation', first, second], rows)
        if scenario.get('conclusion'):
            result += f'<p class="scenario-conclusion">{h(scenario["conclusion"])}</p>'
        if scenario.get('caution'):
            result += f'<p class="small">{h(scenario["caution"])}</p>'
        result += '</section>'
    for section in c.get('sections', []):
        result += f'<section><h2>{h(section.get("title", ""))}</h2>'
        for paragraph in section.get('paragraphs', []):
            result += '<p>' + h(paragraph) + '</p>'
        if section.get('items'):
            result += ul(section['items'])
        result += '</section>'
    recommendations = c.get('recommendations', {})
    if recommendations:
        result += '<section id="our-recommendation"><span class="eyebrow">Make the decision</span><h2>Which one should you choose?</h2><div class="decision-grid">'
        for key, title in [('pickFirst', 'Choose ' + first), ('pickSecond', 'Choose ' + second), ('skipBoth', 'When to use neither')]:
            if recommendations.get(key):
                result += '<div class="decision-card"><h3>' + h(title) + '</h3>' + ul(recommendations[key]) + '</div>'
        result += '</div></section>'
    if c.get('selectionChecklist'):
        result += '<section id="before-you-pay"><h2>Before you pay</h2>' + ul(c['selectionChecklist']) + '</section>'
    return result


def tool_details(t, by_id):
    result = ''
    prices = t.get('pricingDetails', {})
    if prices:
        result += '<section id="costs"><h2>Plans and real cost drivers</h2><p>' + h(t.get('pricingSummary', '')) + '</p>'
        rows = []
        for plan in prices.get('plans', []):
            amount = plan.get('amount')
            cost = (str(amount) if amount is not None else plan.get('price', 'Quote / account dependent'))
            unit = plan.get('unit', '')
            period = plan.get('period', '')
            if isinstance(amount, (int, float)):
                cost = prices.get('currency', 'USD') + ' ' + f'{amount:g}'
            if period:
                cost += ' / ' + str(period)
            if unit:
                cost += ' · ' + str(unit)
            included = plan.get('included', '')
            if isinstance(included, list):
                included = '; '.join(included)
            rows.append([h(plan.get('name', 'Plan')), h(cost) + '<br><span class="small">' + h(plan.get('billingBasis', '')) + '</span>', h(included) + '<br>' + source_link(plan.get('sourceUrl') or t.get('pricingUrl'))])
        if rows:
            result += table(['Plan / option', 'Price and billing', 'Included scope'], rows)
        if prices.get('costDrivers'):
            result += '<h3>What changes your bill</h3>' + ul(prices['costDrivers'])
        if prices.get('verificationNote'):
            result += '<p class="small">' + h(prices['verificationNote']) + '</p>'
        result += '</section>'
    sample = t.get('workedExample')
    if sample:
        result += '<section class="scenario-panel" id="example"><span class="eyebrow">See the work</span><h2>' + h(sample.get('title', 'A representative business task')) + '</h2><p class="example-tag">' + h(sample.get('exampleType', 'Illustrative workflow')) + '</p>'
        if sample.get('inputs'):
            result += '<h3>Start with</h3>' + ul(sample['inputs'])
        if sample.get('workflow'):
            result += '<h3>Build it</h3><ol class="plain-steps">' + ''.join('<li>' + h(x) + '</li>' for x in sample['workflow']) + '</ol>'
        if sample.get('expectedOutput'):
            result += '<h3>The output to look for</h3><div class="sample-output">' + h(sample['expectedOutput']).replace('\n', '<br>') + '</div>'
        if sample.get('check'):
            result += '<p class="step-check"><strong>Check the result:</strong> ' + h(sample['check']) + '</p>'
        if sample.get('limits'):
            result += '<p class="small">' + h(sample['limits']) + '</p>'
        result += '</section>'
    alternatives = t.get('alternatives', [])
    if alternatives:
        result += '<section id="alternatives"><h2>When another tool makes more sense</h2><div class="alternative-list">'
        for alternative in alternatives:
            target = by_id.get(alternative.get('toolId'))
            if target:
                result += f'<article><h3><a href="/tool/{h(target["id"])}/">{h(target["name"])} ↗</a></h3><p>{h(alternative.get("reason", ""))}</p></article>'
        result += '</div></section>'
    return result


def related_guides(tool_id, plays, comparisons):
    matches = [(p['title'], '/playbooks/' + p['id'] + '/', 'Tutorial') for p in plays if tool_id in p.get('toolIds', [])]
    matches += [(c['title'], '/comparisons/' + c['id'] + '/', 'Comparison') for c in comparisons if tool_id in c.get('toolIds', [])]
    if not matches:
        return ''
    return '<section class="article-related"><h2>Put this decision into practice</h2>' + ''.join(f'<a class="related-story" href="{h(url)}"><span>{h(kind)}</span><strong>{h(title)}</strong><b>↗</b></a>' for title, url, kind in matches[:5]) + '</section>'


def business_article(g, by_id, plays, support_cta=''):
    play_map = {p['id']: p for p in plays}
    html = '<p class="article-lede">' + h(g['intro']) + '</p><div class="answer-box"><span class="eyebrow">Our starting recommendation</span><p>' + h(g['recommendation']) + '</p></div>'
    html += '<div class="journey-strip" aria-label="The customer journey">' + ''.join(f'<div><b>{i+1:02}</b><strong>{h(label)}</strong></div>' for i, label in enumerate(g['journey'])) + '</div>'
    html += '<section id="toolkit"><h2>Choose tools around the job</h2>'
    rows = []
    tool_ids = []
    for title, ids, why, guide in g['jobs']:
        tool_ids += ids
        links = ' / '.join(f'<a class="link" href="/tool/{h(tid)}/">{h(by_id[tid]["name"])}</a>' for tid in ids if tid in by_id)
        rows.append([h(title), links, h(why) + (f'<br><a class="source-link" href="/playbooks/{h(guide)}/">Follow the setup guide →</a>' if guide in play_map else '')])
    html += table(['The job', 'Useful options', 'How to decide'], rows) + '</section>'
    for i, section in enumerate(g['sections']):
        html += f'<section id="business-step-{i+1}"><h2>{h(section["title"])}</h2>' + ''.join('<p>' + h(p) + '</p>' for p in section['paragraphs']) + '</section>'
    example = g['example']
    html += '<section class="scenario-panel" id="worked-example"><span class="eyebrow">A finished example</span><h2>' + h(example['title']) + '</h2><p class="example-tag">Illustrative example; replace the sample facts with your own</p><h3>The input</h3><p>' + h(example['input']) + '</p><div class="example-label"><h3>The output</h3><button class="button light small" data-copy-target="business-example">Copy example</button></div><pre class="sample-output" id="business-example">' + h(example['output']) + '</pre><h3>Check the result</h3>' + ul(example['checks']) + '</section>'
    html += '<section id="cost"><h2>Build the budget from the actual plans</h2><p>These are alternative choices for different jobs. Add only the tools required by your workflow; the list is not a suggested bundle.</p>'
    primary = list(dict.fromkeys(job[1][0] for job in g['jobs']))
    rows = []
    for tid in primary:
        t = by_id[tid]
        rows.append([f'<a href="/tool/{h(tid)}/">{h(t["name"])}</a>', h(t['pricingSummary']), source_link(t['pricingUrl'], 'Official plans') + '<span class="source-date">Reviewed ' + h(t['checkedAt']) + '</span>'])
    html += table(['Tool', 'Reviewed plan economics', 'Source'], rows) + '<p>Include seats, contacts, usage, tax, and annual commitments in your own calculation. The <a class="link" href="/calculators/stack-cost/">software cost planner</a> converts those inputs into a monthly equivalent.</p></section>'
    html += '<section id="measure"><h2>Measure the result that matters</h2>' + ul(g['metrics']) + support_cta + '</section><section class="article-related" id="next"><h2>Build the complete workflow</h2>'
    for pid in g['related']:
        if pid in play_map:
            html += f'<a class="related-story" href="/playbooks/{h(pid)}/"><span>Tutorial</span><strong>{h(play_map[pid]["title"])}</strong><b>↗</b></a>'
    for comparison in g.get('relatedComparisons', []):
        html += f'<a class="related-story" href="/comparisons/{h(comparison["id"])}/"><span>Comparison</span><strong>{h(comparison["title"])}</strong><b>↗</b></a>'
    html += '</section>'
    sources = list(g.get('extraSources', []))
    for tid in dict.fromkeys(tool_ids):
        t = by_id[tid]
        entries = t.get('sources') or t.get('namedSources') or []
        sources.extend(entries[:2] if entries else [{'title':t['name']+' official plans','url':t['pricingUrl'],'checkedAt':t['checkedAt']}])
    html += named_sources({**g,'namedSources':sources})
    return html


def feature_article(g, by_id):
    """Render a complete buying or implementation guide with a useful reading order."""
    result = '<p class="article-lede">' + h(g['intro']) + '</p>'
    if g.get('answer'):
        result += '<div class="answer-box"><span class="eyebrow">The practical answer</span><p>' + h(g['answer']) + '</p></div>'
    for index, section in enumerate(g['sections']):
        result += '<section id="' + h(section['id']) + '"><h2>' + h(section['title']) + '</h2>'
        result += ''.join('<p>' + h(p) + '</p>' for p in section.get('paragraphs', []))
        if section.get('items'):
            result += ul(section['items'])
        if section.get('steps'):
            result += '<ol class="plain-steps">' + ''.join('<li>' + h(p) + '</li>' for p in section['steps']) + '</ol>'
        if section.get('table'):
            detail = section['table']
            result += table(detail['headers'], [[h(v) for v in row] for row in detail['rows']])
        if section.get('example'):
            sample = section['example']
            sample_id = 'guide-example-' + str(index)
            result += '<div class="worked-example"><div class="example-label"><h3>' + h(sample['title']) + '</h3><button class="button light small" data-copy-target="' + sample_id + '">Copy example</button></div><p class="example-tag">Illustrative example · adapt the facts before use</p><pre id="' + sample_id + '">' + h(sample['content']) + '</pre></div>'
        for link in section.get('links', []):
            result += '<a class="related-story" href="' + h(link['url']) + '"><span>' + h(link.get('label','Next step')) + '</span><strong>' + h(link['title']) + '</strong><b>↗</b></a>'
        if section.get('sourceUrls'):
            result += '<p class="step-references">' + ' · '.join(source_link(u, next((s['title'] for s in g.get('namedSources',[]) if s['url']==u), 'Official reference')) for u in section['sourceUrls']) + '</p>'
        result += '</section>'
    if g.get('toolIds'):
        result += '<section id="tools-and-costs"><h2>Tools and current plan costs</h2>'
        rows=[]
        for tid in g['toolIds']:
            t = by_id[tid]
            rows.append([f'<a class="link" href="/tool/{h(tid)}/">{h(t["name"])}</a>', h(t['pricingSummary']), source_link(t['pricingUrl'],'Official plans')])
        result += table(['Tool guide', 'Reviewed costs and limits', 'Source'], rows) + '</section>'
    result += named_sources(g)
    return result
