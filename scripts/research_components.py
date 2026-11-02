"""Publish a reproducible, scoped export of the reviewed decision evidence.

Builds never fetch prices, rewrite evidence dates, or mutate the source archive.
The current data and any validated archived releases are published as exact bytes.
"""
from copy import deepcopy
import csv
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from hashlib import sha256
from html import escape
import io
import json
import math
from pathlib import Path
import re
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'research-data/software-plan-costs'
ROUTE = '/research/software-plan-costs/'
TITLE = 'Small-business software plan cost and capacity data'
DESCRIPTION = 'Compare documented software prices, billing terms, usage limits, and feature requirements. Download a versioned data snapshot and see the calculations.'
FORMAT_VERSION = 1
FILE_PREFIX = 'software-plan-costs-'
DOWNLOAD_ROOT = '/downloads/research/'
METHOD = 'A curated compilation of official plan documentation, with billing units and recorded capacity limits preserved. Arithmetic examples use disclosed inputs; no vendor performance or business outcomes were measured.'
LIMIT_LABELS = {
    'usersMax': 'Users', 'subscribersMax': 'Active subscribers',
    'emailsPerMonthMax': 'Emails per month', 'activeAutomationsMax': 'Active automations',
    'automationStepsMax': 'Steps in one automation', 'tasksPerMonthMax': 'Tasks per month',
    'creditsPerMonthMax': 'Credits per month', 'actionStepsMax': 'Action steps per run',
    'stepsMax': 'Total steps per run', 'channelsMax': 'Channels', 'brandsMax': 'Brands',
    'postsPerMonthMax': 'Posts per month', 'queuedPerChannelMax': 'Queued posts per channel',
}
FEATURE_LABELS = {
    'teamAdministration': 'Shared team administration', 'sequences': 'Email sequences',
    'premiumApps': 'Premium app access', 'approvals': 'Approval workflows',
    'linkedIn': 'LinkedIn connection', 'x': 'X connection',
}
UNIT_LABELS = {'flat': 'Per plan', 'seat': 'Per seat', 'channel': 'Per channel', 'brand': 'Per brand'}
INPUT_LABELS = {
    'users': 'People', 'projection_months': 'Months in the projection',
    'subscribers': 'Peak active subscribers', 'broadcastsPerMonth': 'Full-list broadcasts per month',
    'newSubscribers': 'New welcome-sequence entrants', 'welcomeEmails': 'Welcome emails per entrant',
    'activeAutomations': 'Active automations', 'automationSteps': 'Steps in the largest automation',
    'workflowRuns': 'Workflow runs per month', 'actionSteps': 'Billable action steps per run',
    'triggerModules': 'Trigger modules per run', 'extraCredits': 'Additional Make credits per month',
    'premiumApps': 'Premium app required', 'channels': 'Connected paid channels', 'plan_id': 'Selected plan',
}
RESULT_LABELS = {
    'plus_twelve_monthly_payments_usd': 'Twelve monthly Plus payments',
    'claude_annual_charge_usd': 'Claude Pro annual payment',
    'claude_annual_monthly_equivalent_usd': 'Claude Pro monthly equivalent',
    'estimated_sends_per_month': 'Estimated recipient sends per month',
    'estimated_zapier_tasks_per_month': 'Estimated Zapier tasks per month',
    'estimated_make_credits_per_month': 'Estimated Make credits per month',
    'monthly_payment_usd': 'Monthly payment', 'annual_charge_usd': 'Annual payment',
}
CSV_FIELDS = [
    'snapshot_id', 'observation_id', 'tool_id', 'tool_name', 'plan_id', 'plan_name',
    'checked_at', 'currency', 'billing_unit', 'min_quantity',
    'monthly_payment_usd', 'monthly_price_status', 'monthly_period_months',
    'annual_total_usd', 'annual_price_status', 'annual_period_months',
    'annual_monthly_equivalent_usd', 'annual_amount_basis', 'price_scope',
    'limits', 'features', 'fair_use_review_threshold', 'scope', 'notes',
    'tool_constraints', 'evidence_type', 'source_ids', 'source_urls',
    'comparison_ids', 'comparison_urls', 'methodology_url',
]


def _json(value, pretty=False):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False,
                      indent=2 if pretty else None, separators=None if pretty else (',', ':'))


def _slug(value):
    if not isinstance(value, str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]*', value):
        raise ValueError('Invalid research record identifier.')
    return value


def _date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('An actual ISO source-check date is required.')
    date.fromisoformat(value)
    return value


def _url(value):
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Research sources must have public HTTPS URLs.')
    return value


def _amount(value):
    if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))
                              or not math.isfinite(value) or value < 0):
        raise ValueError('Amounts and capacities must be nonnegative numbers or null.')
    return value


def _money(value):
    return 'Not recorded' if value is None else f'USD {value:,.2f}'


def _rounded(value):
    return float(Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def _sources_for_plan(plan):
    return sorted(set(plan.get('sourceIds', [])) | {
        source_id for evidence in plan.get('limitEvidence', {}).values()
        for source_id in evidence.get('sourceIds', [])
    })


def _annual_basis(tool_id, plan):
    if plan.get('annualAvailable') is False:
        return 'not_offered'
    if plan.get('annualTotalUsd') is None:
        return 'unknown'
    if plan['annualTotalUsd'] == 0:
        return 'no_charge'
    # These describe the recorded derivations, without maintaining another price list.
    if tool_id == 'mailerlite' and any('Annual total applies' in note for note in plan.get('notes', [])):
        return 'derived_from_recorded_monthly_price_and_annual_discount'
    if 'annual total is' in plan.get('scope', '').lower():
        return 'derived_from_recorded_annual_monthly_equivalent'
    return 'recorded_annual_total'


def _normalize_plan(tool_id, tool, plan, contexts, sources, origin):
    plan_id = _slug(plan['id'])
    checked = _date(plan['checkedAt'])
    if plan.get('currency') != 'USD':
        raise ValueError('USD price fields cannot represent another currency.')
    unit = plan.get('billingUnit')
    if unit not in UNIT_LABELS:
        raise ValueError('An explicit supported billing unit is required.')
    monthly, annual = _amount(plan.get('monthlyUsd')), _amount(plan.get('annualTotalUsd'))
    if plan.get('annualAvailable') is False and annual is not None:
        raise ValueError('An unavailable annual offer cannot have an annual price.')
    minimum = _amount(plan.get('minQuantity', 1))
    if minimum is None or minimum < 1:
        raise ValueError('Minimum billing quantity must be positive.')
    unlimited, not_metered = set(plan.get('unlimitedLimits', [])), set(plan.get('notMeteredLimits', []))
    if unlimited & not_metered:
        raise ValueError('Unlimited and not-metered limits are distinct states.')
    limits = {}
    for key in sorted(set(plan.get('limits', {})) | unlimited | not_metered):
        value = plan.get('limits', {}).get(key)
        value = value.get('value') if isinstance(value, dict) else value
        _amount(value)
        state = 'unlimited' if key in unlimited else 'not_metered' if key in not_metered else 'unknown' if value is None else 'finite'
        if state in {'unlimited', 'not_metered'} and value is not None:
            raise ValueError('A capacity cannot be both finite and unbounded/not metered.')
        evidence = plan.get('limitEvidence', {}).get(key, {})
        limits[key] = {
            'value': value, 'state': state,
            'source_ids': sorted(set(evidence.get('sourceIds', plan.get('sourceIds', [])))),
            'scope': evidence.get('scope', plan.get('scope', '')),
            'checked_at': _date(evidence.get('checkedAt', checked)),
        }
    features = {}
    for key, raw in sorted(plan.get('features', {}).items()):
        value = raw.get('value') if isinstance(raw, dict) else raw
        if value is not None and not isinstance(value, bool):
            raise ValueError('Feature availability must be true, false, or null.')
        features[key] = {'value': value, 'state': 'unknown' if value is None else 'included' if value else 'not_included'}
    source_ids = _sources_for_plan(plan)
    if not source_ids or any(source_id not in sources for source_id in source_ids):
        raise ValueError('Every plan and capacity claim must resolve to a recorded source.')
    annual_status = 'not_offered' if plan.get('annualAvailable') is False else 'unknown' if annual is None else 'no_charge' if annual == 0 else 'recorded'
    threshold = plan.get('fairUseReviewThresholdPostsPerBrandPerMonth')
    if threshold is not None:
        _amount(threshold)
    return {
        'observation_id': tool_id + ':' + plan_id, 'tool_id': tool_id, 'tool_name': tool['name'],
        'plan_id': plan_id, 'plan_name': plan['name'], 'checked_at': checked,
        'currency': 'USD', 'billing_unit': unit, 'min_quantity': minimum,
        'monthly_payment_usd': monthly,
        'monthly_price_status': 'unknown' if monthly is None else 'no_charge' if monthly == 0 else 'recorded',
        'monthly_period_months': 1,
        'annual_total_usd': annual, 'annual_price_status': annual_status, 'annual_period_months': 12,
        'annual_monthly_equivalent_usd': _rounded(Decimal(str(annual)) / 12) if annual is not None else None,
        'annual_amount_basis': _annual_basis(tool_id, plan),
        'price_scope': deepcopy(plan.get('priceScope', {})), 'limits': limits, 'features': features,
        'fair_use_review_threshold': {'posts_per_brand_per_month': threshold, 'is_hard_cap': False} if threshold is not None else None,
        'scope': plan.get('scope', ''), 'notes': deepcopy(plan.get('notes', [])),
        'tool_constraints': deepcopy(tool.get('constraints', [])),
        'evidence_type': plan.get('evidenceType', ''),
        'source_ids': source_ids, 'source_urls': [sources[source_id]['url'] for source_id in source_ids],
        'comparison_ids': sorted(contexts),
        'comparison_urls': [origin + '/comparisons/' + context + '/' for context in sorted(contexts)],
        'methodology_url': origin + ROUTE + '#methodology',
    }


def _scenarios(contexts, observations):
    """Show existing calculator inputs and simple arithmetic, not a new fit score."""
    rows = {row['observation_id']: row for row in observations}
    comparisons = {item['id']: item for item in contexts}
    examples = []
    assistant = comparisons.get('chatgpt-vs-claude')
    if assistant and {'chatgpt:plus', 'claude:pro'} <= rows.keys():
        plus, claude = rows['chatgpt:plus'], rows['claude:pro']
        examples.append({
            'id': 'individual-assistant-billing', 'comparison_id': assistant['id'],
            'title': 'Compare the payment commitment',
            'inputs': {'users': 1, 'projection_months': 12},
            'formula': 'Twelve monthly payments = monthly payment × 12; annual equivalent = recorded annual charge ÷ 12.',
            'results': {'plus_twelve_monthly_payments_usd': _rounded(Decimal(str(plus['monthly_payment_usd'])) * 12),
                        'claude_annual_charge_usd': claude['annual_total_usd'],
                        'claude_annual_monthly_equivalent_usd': claude['annual_monthly_equivalent_usd']},
            'explanation': 'The twelve-payment projection assumes the monthly price stays unchanged. It is not an annual subscription offer or a product-quality comparison.',
            'observation_ids': [plus['observation_id'], claude['observation_id']],
        })
    email = comparisons.get('mailerlite-vs-kit')
    if email:
        values = email['defaults']
        examples.append({
            'id': 'email-send-volume', 'comparison_id': email['id'], 'title': 'Count email sends before choosing a tier',
            'inputs': deepcopy(values),
            'formula': 'Estimated sends = peak active subscribers × full-list broadcasts + new sequence entrants × welcome emails.',
            'results': {'estimated_sends_per_month': values['subscribers'] * values['broadcastsPerMonth'] + values['newSubscribers'] * values['welcomeEmails']},
            'explanation': 'New subscribers are already included in the peak list. The example assumes all welcome emails are sent in the same month; other sends and every automation limit still need checking.',
            'observation_ids': [row['observation_id'] for row in observations if email['id'] in row['comparison_ids']],
        })
    automation = comparisons.get('zapier-vs-make')
    if automation:
        values = automation['defaults']
        examples.append({
            'id': 'automation-usage', 'comparison_id': automation['id'], 'title': 'Keep tasks and credits separate',
            'inputs': deepcopy(values),
            'formula': 'Zapier tasks = runs × billable action steps. Make credits = runs × (standard action modules + trigger modules) + extra credits.',
            'results': {'estimated_zapier_tasks_per_month': values['workflowRuns'] * values['actionSteps'],
                        'estimated_make_credits_per_month': values['workflowRuns'] * (values['actionSteps'] + values['triggerModules']) + values['extraCredits']},
            'explanation': 'These are different usage meters. Polling, bundles, loops, retries, AI and nonstandard actions can change consumption; this is not an equivalent-work benchmark.',
            'observation_ids': [row['observation_id'] for row in observations if automation['id'] in row['comparison_ids']],
        })
    social = comparisons.get('buffer-vs-metricool')
    if social and 'buffer:essentials' in rows:
        row, channels = rows['buffer:essentials'], social['defaults']['channels']
        if channels <= row['price_scope']['maxQuantity']:
            examples.append({
                'id': 'paid-social-channels', 'comparison_id': social['id'], 'title': 'Multiply the paid channel price',
                'inputs': {'channels': channels, 'plan_id': row['observation_id']},
                'formula': 'Paid-channel total = per-channel price × number of connected paid channels.',
                'results': {'monthly_payment_usd': _rounded(Decimal(str(row['monthly_payment_usd'])) * channels),
                            'annual_charge_usd': _rounded(Decimal(str(row['annual_total_usd'])) * channels)},
                'explanation': 'This example assumes you choose Essentials. It does not establish that you need a paid plan. Annual payment and monthly payment are separate options; free channels are not added to a paid allowance.',
                'observation_ids': [row['observation_id']],
            })
    return examples


def make_snapshot(evidence, origin):
    """Create the public snapshot from an explicit allowlist of evidence fields."""
    _url(origin)
    origin = origin.rstrip('/')
    sources = {}
    for source in evidence['sources']:
        source_id = _slug(source['id'])
        if source_id in sources:
            raise ValueError('Source identifiers must be unique.')
        sources[source_id] = {key: deepcopy(source.get(key, '')) for key in
                              ['id', 'publisher', 'title', 'url', 'checkedAt', 'scope', 'evidenceType']}
        _url(sources[source_id]['url'])
        _date(sources[source_id]['checkedAt'])
    contexts, membership = [], {}
    for comparison in evidence['comparisons']:
        calculator = comparison.get('calculator', {})
        if calculator.get('kind') not in {'assistant', 'email', 'automation', 'social'}:
            continue
        comparison_id = _slug(comparison['id'])
        contexts.append({
            'id': comparison_id, 'title': comparison['title'],
            'kind': calculator['kind'], 'url': origin + '/comparisons/' + comparison_id + '/',
            'defaults': deepcopy(calculator['defaults']),
            'assumptions': deepcopy(calculator.get('assumptions', [])),
            'caveats': deepcopy(calculator.get('caveats', [])),
        })
        for tool_id in comparison['toolIds']:
            _slug(tool_id)
            for plan in evidence['tools'][tool_id]['plans']:
                observation_id = tool_id + ':' + _slug(plan['id'])
                allowed = calculator.get('eligiblePlanIds', [])
                if not allowed or observation_id in allowed or plan['id'] in allowed:
                    membership.setdefault(observation_id, set()).add(comparison_id)
    observations = []
    for tool_id, tool in sorted(evidence['tools'].items()):
        for plan in sorted(tool['plans'], key=lambda item: item['id']):
            observation_id = tool_id + ':' + plan['id']
            if observation_id in membership:
                observations.append(_normalize_plan(tool_id, tool, plan, membership[observation_id], sources, origin))
    if not observations or len({row['observation_id'] for row in observations}) != len(observations):
        raise ValueError('The snapshot needs nonempty, unique plan observations.')
    used_sources = {source_id for row in observations for source_id in row['source_ids']}
    selected_sources = [sources[source_id] for source_id in sorted(used_sources)]
    source_dates = sorted({row['checked_at'] for row in observations}
                          | {limit['checked_at'] for row in observations for limit in row['limits'].values()}
                          | {source['checkedAt'] for source in selected_sources})
    contexts.sort(key=lambda item: item['id'])
    snapshot = {
        'format_version': FORMAT_VERSION, 'source_schema_version': evidence['schemaVersion'],
        'title': TITLE, 'description': DESCRIPTION, 'canonical_url': origin + ROUTE,
        'source_checked_at': _date(evidence['checkedAt']), 'source_dates': source_dates,
        'methodology': {'measurement_technique': METHOD,
                        'selection': 'Plans already eligible for the four documented comparison calculators; a curated sample, not a representative market survey.',
                        'exclusions': deepcopy(evidence['methodology']['priceExclusions']),
                        'null_meaning': 'Unknown or unavailable, never zero. Each price and capacity includes an explicit state; free plans have numeric zero.',
                        'scope_notes': 'No live price feed, historical price-change claim, industry spending average, vendor-quality score, or measured ROI.',
                        'url': origin + ROUTE + '#methodology'},
        'counts': {'observations': len(observations), 'tools': len({row['tool_id'] for row in observations}),
                   'contexts': len(contexts), 'sources': len(selected_sources)},
        'contexts': contexts, 'observations': observations, 'sources': selected_sources,
        'scenarios': _scenarios(contexts, observations),
    }
    snapshot['snapshot_id'] = sha256(_json(snapshot).encode('utf-8')).hexdigest()[:16]
    return snapshot


def snapshot_files(snapshot):
    """Return canonical release bytes. Null CSV amounts stay blank with a state."""
    payload = {key: value for key, value in snapshot.items() if key != 'snapshot_id'}
    expected = sha256(_json(payload).encode('utf-8')).hexdigest()[:16]
    if snapshot.get('format_version') != FORMAT_VERSION or snapshot.get('snapshot_id') != expected:
        raise ValueError('Snapshot format or content hash does not match.')
    rows = snapshot.get('observations', [])
    if not rows or snapshot['counts']['observations'] != len(rows):
        raise ValueError('Snapshot observation count does not match.')
    if len({row['observation_id'] for row in rows}) != len(rows):
        raise ValueError('Duplicate archived observation.')
    sources = {source['id']: source for source in snapshot['sources']}
    for source in sources.values():
        _url(source['url'])
        _date(source['checkedAt'])
    for row in rows:
        _date(row['checked_at'])
        _amount(row['monthly_payment_usd'])
        _amount(row['annual_total_usd'])
        if any(source_id not in sources for source_id in row['source_ids']):
            raise ValueError('Archived plan has an unresolved source.')
    csv_buffer = io.StringIO(newline='')
    writer = csv.DictWriter(csv_buffer, fieldnames=CSV_FIELDS, lineterminator='\n')
    writer.writeheader()
    for observation in rows:
        row = {'snapshot_id': snapshot['snapshot_id'], **observation}
        writer.writerow({key: _json(row[key]) if isinstance(row.get(key), (list, dict)) else
                         '' if row.get(key) is None else row[key] for key in CSV_FIELDS})
    stem = FILE_PREFIX + snapshot['snapshot_id']
    return {stem + '.json': (_json(snapshot, pretty=True) + '\n').encode('utf-8'),
            stem + '.csv': csv_buffer.getvalue().encode('utf-8')}


def _archive_files(directory):
    """Fail closed on incomplete or modified releases; never rewrite the archive."""
    if not directory.is_dir():
        raise ValueError('The reviewed research snapshot archive is missing.')
    files, snapshots = {}, []
    json_paths = sorted(directory.glob(FILE_PREFIX + '*.json'))
    expected_names = set()
    for path in json_paths:
        if not re.fullmatch(FILE_PREFIX + r'[a-f0-9]{16}\.json', path.name):
            raise ValueError('Invalid archived research filename.')
        snapshot = json.loads(path.read_text(encoding='utf-8'))
        release = snapshot_files(snapshot)
        if path.name not in release:
            raise ValueError('Archived filename and content hash disagree.')
        for filename, content in release.items():
            source = directory / filename
            if not source.is_file() or source.read_bytes() != content:
                raise ValueError('An archived release is missing or its bytes were changed.')
            expected_names.add(filename)
            files[filename] = content
        snapshots.append(snapshot)
    actual_names = {path.name for path in directory.glob(FILE_PREFIX + '*') if path.suffix in {'.json', '.csv'}}
    if actual_names != expected_names:
        raise ValueError('The research archive contains an unpaired release file.')
    return files, snapshots


def _h(value):
    return escape(str(value), quote=True)


def _list(values):
    return '<ul>' + ''.join('<li>' + _h(value) + '</li>' for value in values) + '</ul>'


def _label(key, labels):
    return labels.get(key, re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', key.replace('_', ' ')).capitalize())


def _input_value(key, value, observations):
    if key == 'plan_id':
        row = next((row for row in observations if row['observation_id'] == value), None)
        if row:
            return row['tool_name'] + ' ' + row['plan_name']
    if isinstance(value, bool):
        return 'Yes' if value else 'No'
    return f'{value:,}' if isinstance(value, (int, float)) else str(value)


def _capacity(row):
    lines = []
    for key, limit in row['limits'].items():
        state = limit['state']
        label = LIMIT_LABELS.get(key, key)
        if state == 'finite':
            lines.append(f'{label}: {limit["value"]:g}')
        elif state == 'unlimited':
            lines.append(label + ': no published numeric cap; applicable fair use remains')
        elif state == 'unknown':
            lines.append(label + ': not recorded')
        else:
            lines.append(label + ': no separate meter in this comparison')
    for key, feature in row['features'].items():
        lines.append(FEATURE_LABELS.get(key, key) + ': ' +
                     {'included': 'included', 'not_included': 'not included', 'unknown': 'needs confirmation'}[feature['state']])
    threshold = row['fair_use_review_threshold']
    if threshold:
        lines.append(f'Fair-use review above {threshold["posts_per_brand_per_month"]:g} posts per brand per month; this is not a hard cap.')
    return _list(lines)


def _render(snapshot, archives):
    counts, version = snapshot['counts'], snapshot['snapshot_id']
    dates = snapshot['source_dates']
    date_label = dates[0] if len(dates) == 1 else dates[0] + ' through ' + dates[-1]
    json_path, csv_path = [DOWNLOAD_ROOT + FILE_PREFIX + version + suffix for suffix in ['.json', '.csv']]
    chunks = [
        '<section class="section"><div class="wrap"><div class="card">',
        f'<span class="eyebrow">A documented planning reference</span><h2>{counts["observations"]} plan observations, with the limits beside the price</h2>',
        f'<p>This release covers {counts["tools"]} tools across {counts["contexts"]} decisions: an individual AI assistant, email marketing, workflow automation, and social publishing. The source-check dates recorded in the evidence are {_h(date_label)}.</p>',
        '<p>Use it to check what a quoted price buys: the payment term, the billing unit, and the workload it covers. These selected plans do not represent average small-business spending.</p>',
        f'<div class="actions"><a class="button" href="{csv_path}" download>Download CSV</a><a class="button light" href="{json_path}" download>Download JSON</a><a class="button light" href="#methodology">Read the method</a></div>',
        f'<p class="small">Snapshot <code>{version}</code> · USD before tax and excluded add-ons. Prices can change; confirm the vendor’s current checkout for a purchase.</p>',
        '</div></div></section><section class="section"><div class="wrap"><article class="article-body">',
        '<h2 id="plan-reference">Plan costs and capacity</h2><p>The annual column shows a full-year amount paid upfront or derived from the documented annual offer. Its monthly equivalent is a comparison aid, not a monthly cancellation option. A free plan’s zero does not create an annual commitment.</p>',
    ]
    source_numbers = {source['id']: index + 1 for index, source in enumerate(snapshot['sources'])}
    for context in snapshot['contexts']:
        chunks.append(f'<h3>{_h(context["title"])}</h3><p><a href="/comparisons/{_h(context["id"])}/">Apply the full comparison to your requirements →</a></p>')
        chunks.append('<div class="table-scroll"><table class="data-table"><caption>' + _h(context['title']) + ' — recorded plan observations</caption><thead><tr><th scope="col">Plan</th><th scope="col">Monthly payment</th><th scope="col">Annual option</th><th scope="col">Unit and quoted scope</th><th scope="col">Capacity and features</th><th scope="col">Evidence</th></tr></thead><tbody>')
        for row in snapshot['observations']:
            if context['id'] not in row['comparison_ids']:
                continue
            annual = 'No annual option' if row['annual_price_status'] == 'not_offered' else _money(row['annual_total_usd'])
            if row['annual_total_usd'] is not None and row['annual_total_usd'] > 0:
                annual += '<br><span class="small">' + _money(row['annual_monthly_equivalent_usd']) + ' / month equivalent</span>'
            if row['annual_amount_basis'].startswith('derived_'):
                annual += '<br><span class="small">Derived total; calculation in notes.</span>'
            source_links = ' '.join(f'<a href="#source-{source_numbers[source_id]}">[{source_numbers[source_id]}]</a>' for source_id in row['source_ids'])
            notes = '<details><summary>Plan notes</summary>' + _list(row['notes'] + row['tool_constraints']) + '</details>' if row['notes'] or row['tool_constraints'] else ''
            chunks.append(f'<tr><th scope="row"><a href="/tool/{_h(row["tool_id"])}/">{_h(row["tool_name"])}</a><br>{_h(row["plan_name"])}</th><td>{_money(row["monthly_payment_usd"])}</td><td>{annual}</td><td>{_h(UNIT_LABELS[row["billing_unit"]])}<br>{_h(row["scope"])}<br><span class="small">Minimum quantity: {row["min_quantity"]:g}</span></td><td>{_capacity(row)}{notes}</td><td>{source_links}<br><span class="small">Checked {_h(row["checked_at"])}</span></td></tr>')
        chunks.append('</tbody></table></div><details><summary>Comparison assumptions and limits</summary>'
                      + _list(context['assumptions'] + context['caveats']) + '</details>')
    chunks.append('<h2 id="worked-examples">Worked examples</h2><p>These are reproducible planning examples using the recorded facts and calculator defaults. They are not measured savings, product rankings, or recommendations to buy a paid plan.</p><div class="grid two">')
    for example in snapshot['scenarios']:
        inputs = [_label(key, INPUT_LABELS) + ': ' + _input_value(key, value, snapshot['observations'])
                  for key, value in example['inputs'].items()]
        results = [_label(key, RESULT_LABELS) + ': ' + (f'USD {value:,.2f}' if key.endswith('_usd') else f'{value:,}')
                   for key, value in example['results'].items()]
        chunks.append('<div class="card"><h3>' + _h(example['title']) + '</h3><p>' + _h(example['formula']) + '</p><details><summary>Exact inputs</summary>' + _list(inputs) + '</details>' + _list(results) + '<p>' + _h(example['explanation']) + '</p><a href="/comparisons/' + _h(example['comparison_id']) + '/">Use this comparison →</a></div>')
    chunks.append('</div><h2 id="methodology">Method and scope</h2>')
    chunks.append('<p>' + _h(METHOD) + '</p>')
    chunks.append('<ol><li><strong>Select a defined sample.</strong> Include the plan tiers already reviewed for these four comparison calculators. This is not a census of software, a random sample of businesses, or a measure of what businesses actually spend.</li><li><strong>Keep the units.</strong> Preserve the billing currency, payment period, plan tier, billing unit, minimum quantity, features and capacity boundaries. Tasks, credits, sends, subscribers, seats, channels and brands are not interchangeable.</li><li><strong>Show the payment obligation.</strong> Keep monthly payments separate from annual totals. Annual equivalents divide the recorded annual total by twelve and round to cents. The MailerLite totals apply the recorded annual discount; the Zapier total multiplies its annual-billing monthly equivalent by twelve. The associated notes retain those calculations.</li><li><strong>Preserve uncertainty.</strong> Zero means no charge. A blank CSV amount or JSON null has an explicit unknown/not-offered state. Capacity states distinguish finite, unlimited subject to scope, not separately metered, and unknown. No missing tier is extrapolated.</li><li><strong>Retain the evidence.</strong> Every row links to its primary sources and original check date. Rebuilding the page does not refresh those dates. A content-derived version identifies the exact downloadable release.</li></ol>')
    chunks.append('<h3>What is outside the figures?</h3>' + _list(snapshot['methodology']['exclusions']))
    chunks.append('<p>Consumer assistant subscriptions and software plans are not interchangeable with API credits or a complete business stack. These calculations exclude implementation work and do not measure model quality, reliability, deliverability, revenue, saved time, or cash savings. There is no aggregate ROI score or industry-average cost.</p>')
    chunks.append('<h3>Read the downloads</h3><p>The CSV has one row per tool-and-plan observation. Structured limits, features, sources, notes and comparison links are JSON values inside their CSV cells. The JSON download also contains the source register, methodology, comparison defaults and worked-example arithmetic. The original records remain the source of truth; the downloads are generated from them.</p>')
    chunks.append('<h2 id="sources">Primary source register</h2><ol class="source-list">')
    for index, source in enumerate(snapshot['sources'], 1):
        chunks.append(f'<li id="source-{index}"><a href="{_h(source["url"])}" target="_blank" rel="noopener">{_h(source["title"])} ↗</a><br><span class="small">{_h(source["publisher"])} · evidence checked {_h(source["checkedAt"])}</span></li>')
    chunks.append('</ol><h2 id="versions">Release versions</h2><p>These links identify exact snapshot bytes. The dates describe the source checks recorded in each release, not a claimed history of market prices.</p><ul>')
    versions = {item['snapshot_id']: item for item in archives}
    versions[version] = snapshot
    for snapshot_id, release in sorted(versions.items()):
        chunks.append(f'<li><code>{snapshot_id}</code>{" — current release" if snapshot_id == version else ""}; evidence dates {_h(", ".join(release["source_dates"]))}. <a href="{DOWNLOAD_ROOT}{FILE_PREFIX}{snapshot_id}.csv">CSV</a> · <a href="{DOWNLOAD_ROOT}{FILE_PREFIX}{snapshot_id}.json">JSON</a></li>')
    chunks.append('</ul><p>Found a changed price or limitation? <a href="/corrections/">Send a correction</a> with the affected plan and its official source. See our <a href="/editorial-standards/">editorial standards</a> for how researched guidance is prepared.</p></article></div></section>')
    return ''.join(chunks)


def build_research_asset(evidence, origin, output_dir, archive_dir=None):
    """Write safe public exports; return body and metadata for the site's layout.

    output_dir is the publication output root (normally dist). archive_dir is a
    read-only source archive; omit it to use research-data/software-plan-costs.
    No source record or archive file is created or updated by this function.
    """
    snapshot = make_snapshot(evidence, origin)
    archived, archives = _archive_files(Path(archive_dir) if archive_dir is not None else ARCHIVE)
    current = snapshot_files(snapshot)
    for name, content in current.items():
        if name not in archived:
            raise ValueError('Archive the reviewed current research release ' + snapshot['snapshot_id']
                             + ' before publishing: write its snapshot_files(make_snapshot(evidence, origin))'
                             + ' JSON/CSV pair to research-data/software-plan-costs/ without replacing older releases.')
        if archived[name] != content:
            raise ValueError('A published snapshot cannot change under the same filename.')
    published = {**archived, **current}
    destination = Path(output_dir) / DOWNLOAD_ROOT.lstrip('/')
    destination.mkdir(parents=True, exist_ok=True)
    for name, content in published.items():
        (destination / name).write_bytes(content)
    distributions = [
        {'path': DOWNLOAD_ROOT + FILE_PREFIX + snapshot['snapshot_id'] + suffix,
         'encodingFormat': mime, 'name': TITLE + ' — ' + label}
        for suffix, mime, label in [('.csv', 'text/csv', 'CSV'), ('.json', 'application/json', 'JSON')]
    ]
    return {
        'route': ROUTE, 'title': TITLE, 'description': DESCRIPTION, 'body': _render(snapshot, archives),
        'snapshot_id': snapshot['snapshot_id'], 'source_checked_at': snapshot['source_checked_at'],
        'source_dates': snapshot['source_dates'], 'counts': snapshot['counts'],
        'downloads': distributions, 'published_files': sorted(DOWNLOAD_ROOT + name for name in published),
        'dataset_metadata': {
            'route': ROUTE, 'name': TITLE, 'description': DESCRIPTION,
            'version': snapshot['snapshot_id'], 'source_dates': snapshot['source_dates'],
            'distributions': distributions, 'methodology_url': origin.rstrip('/') + ROUTE + '#methodology',
            'measurementTechnique': METHOD, 'isBasedOn': [source['url'] for source in snapshot['sources']],
        },
    }
