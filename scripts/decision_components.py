"""Source-backed comparison tool, with a useful non-JavaScript plan reference.

Integration: render_decision_tool(comparison_id, evidence_dict) returns one section.
Load decision-tools.css and deferred decision-tools.js on comparison pages. This
module never changes content data, makes network requests or embeds executable JS.
"""
from html import escape
import json
import math
import re
from urllib.parse import urlparse


def _h(value):
    return escape(str(value), quote=True)


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def _money(value):
    return f'USD {value:,.2f}' if _number(value) else 'Not verified'


def _sources(data):
    entries = data.get('sources', [])
    return {entry['id']: entry for entry in entries if isinstance(entry, dict) and entry.get('id')} if isinstance(entries, list) else entries


def _source_links(ids, sources):
    result = []
    for source_id in dict.fromkeys(ids):
        source = sources.get(source_id, {})
        url = source.get('url', '')
        parsed = urlparse(url)
        if parsed.scheme != 'https' or not parsed.netloc:
            continue
        result.append(f'<a href="{_h(url)}" target="_blank" rel="noopener">{_h(source.get("title") or source.get("publisher") or "Official source")} ↗</a>')
    return '<div class="decision-plan-sources">' + ''.join(result) + '</div>' if result else ''


def _list(items):
    return '<ul>' + ''.join('<li>' + _h(item.get('text', '') if isinstance(item, dict) else item) + '</li>' for item in items) + '</ul>' if items else ''


def _limits(plan):
    labels = {
        'usersMax': 'people', 'subscribersMax': 'active subscribers',
        'emailsPerMonthMax': 'emails / month', 'activeAutomationsMax': 'active automations',
        'automationStepsMax': 'steps in one automation',
        'tasksPerMonthMax': 'tasks / month', 'creditsPerMonthMax': 'credits / month',
        'actionStepsMax': 'action steps / run', 'stepsMax': 'total steps / run',
        'channelsMax': 'channels', 'brandsMax': 'brands',
        'postsPerMonthMax': 'posts / month', 'queuedPerChannelMax': 'queued posts / channel',
    }
    values = []
    for key, label in labels.items():
        value = plan.get('limits', {}).get(key)
        if isinstance(value, dict):
            value = value.get('value')
        if _number(value):
            values.append(f'{value:,.0f} {label}')
        elif key in plan.get('unlimitedLimits', []):
            values.append(f'{label}: no published numeric cap in this evidence')
    scope = plan.get('scope')
    if scope:
        values.append(scope)
    minimum = plan.get('minQuantity', 1)
    if _number(minimum) and minimum > 1:
        values.append(f'Minimum purchase: {minimum:g} {plan.get("billingUnit", "unit")}s.')
    price_scope = plan.get('priceScope', {})
    if _number(price_scope.get('maxQuantity')):
        values.append(f'Price verified through {price_scope["maxQuantity"]:g} {plan.get("billingUnit", "unit")}s; higher quantities need a fresh quote.')
    if _number(price_scope.get('subscriberMax')):
        values.append(f'Quoted price band: up to {price_scope["subscriberMax"]:,.0f} subscribers.')
    return values


def render_decision_tool(comparison_id, data):
    """Render a scoped, safely escaped calculator and its primary-source fallback."""
    comparisons = data.get('comparisons', [])
    if isinstance(comparisons, dict):
        comparison = comparisons.get(comparison_id)
    else:
        comparison = next((item for item in comparisons if item.get('id') == comparison_id), None)
    if not comparison or comparison.get('calculator', {}).get('kind') not in {'assistant', 'email', 'automation', 'social'}:
        return ''
    safe_id = re.sub(r'[^a-z0-9_-]', '-', comparison_id.lower())
    prefix = 'decision-' + safe_id
    sources = _sources(data)
    calculator = comparison['calculator']
    allowed = calculator.get('eligiblePlanIds', [])
    tool_ids = comparison.get('toolIds', [])
    selected_tools = {tool_id: data.get('tools', {}).get(tool_id, {}) for tool_id in tool_ids}
    payload = {'comparison': comparison, 'data': {
        'schemaVersion': data.get('schemaVersion', 1),
        'checkedAt': data.get('checkedAt'),
        'tools': selected_tools,
        'sources': data.get('sources', []),
    }}
    encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    # Prevent a source string from terminating the inert JSON script element.
    encoded = encoded.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    result = f'<section class="decision-tool" id="{_h(prefix)}" data-decision-tool aria-labelledby="{_h(prefix)}-heading">'
    result += '<span class="eyebrow">Apply the evidence to your business</span>'
    result += f'<h2 id="{_h(prefix)}-heading">{_h(calculator.get("title") or "Check the plans against your needs")}</h2>'
    result += '<p class="decision-intro">' + _h(comparison.get('decisionQuestion') or comparison.get('summary') or 'Compare the verified limits, payment options and feature requirements for your situation.') + '</p>'
    result += '<p class="decision-evidence-date">Official plan evidence checked ' + _h(data.get('checkedAt', 'See sources')) + '. Prices are in USD, before tax and unlisted add-ons.</p>'
    result += '<form data-decision-form hidden aria-label="Compare plan requirements"></form>'
    result += '<p class="decision-privacy">Only counts and feature choices are needed. Inputs stay in this browser; this tool does not save or send them.</p>'
    result += '<div class="decision-status" data-decision-status role="status" aria-live="polite" aria-atomic="true"></div>'
    result += '<div data-decision-results hidden tabindex="-1" aria-label="Your plan comparison"></div>'
    result += '<div class="decision-export-actions" data-decision-exports hidden><button class="button light small" type="button" data-decision-copy>Copy decision summary</button><button class="button light small" type="button" data-decision-download>Download summary</button><button class="button light small" type="button" data-decision-print>Print comparison</button></div>'
    result += '<textarea class="decision-copy-text" data-decision-copy-text hidden readonly aria-label="Decision summary — select and copy" rows="15"></textarea>'
    assumptions = calculator.get('assumptions', [])
    caveats = calculator.get('caveats', [])
    result += '<div class="decision-method"><h3>What the calculation includes</h3>'
    result += _list(assumptions)
    result += '<p>It checks the requirements listed here against reviewed plan facts. It does not measure product quality or predict your results. A missing price or limit stays unknown. Higher tiers are not estimated beyond the verified bands.</p>'
    result += '<p>Monthly-pay prices and full-year charges are shown separately. A monthly equivalent for an annual plan is the annual charge divided by 12; it is not a monthly cancellation option.</p>'
    result += _list(caveats) + '</div>'
    result += '<details class="decision-reference" open><summary>Verified plan reference and primary sources</summary><p class="decision-static-note">This reference is available without JavaScript. Prices below are per stated billing unit; use the limits to check the correct tier.</p>'
    for tool_id in tool_ids:
        tool = selected_tools[tool_id]
        plans = [plan for plan in tool.get('plans', []) if not allowed or f'{tool_id}:{plan["id"]}' in allowed or plan['id'] in allowed]
        if not plans:
            continue
        result += '<div class="decision-reference-tool"><h3>' + _h(tool.get('name', tool_id)) + '</h3>'
        result += '<div class="table-scroll"><table class="data-table decision-reference-table"><caption>' + _h(tool.get('name', tool_id)) + ' — reviewed prices and allowances</caption><thead><tr><th scope="col">Plan and unit</th><th scope="col">Pay monthly</th><th scope="col">Pay for a year</th><th scope="col">Verified scope</th></tr></thead><tbody>'
        for plan in plans:
            unit = {'flat': 'per plan', 'seat': 'per seat', 'channel': 'per channel', 'brand': 'per brand'}.get(plan.get('billingUnit'), 'unit unverified')
            currency = plan.get('currency', 'USD')
            monthly = _money(plan.get('monthlyUsd')) if currency == 'USD' else 'Currency needs verification'
            annual = _money(plan.get('annualTotalUsd')) if currency == 'USD' else 'Currency needs verification'
            if plan.get('annualAvailable') is False:
                annual = 'No annual plan'
            elif currency == 'USD' and _number(plan.get('annualTotalUsd')):
                annual += '<br><span class="decision-help">' + _h(_money(plan['annualTotalUsd'] / 12)) + ' / month equivalent</span>'
            result += '<tr><th scope="row">' + _h(plan.get('name', 'Plan')) + '<small>' + _h(unit) + '</small></th><td>' + _h(monthly) + '</td><td>' + annual + '</td><td>' + _list(_limits(plan))
            plan_source_ids = list(plan.get('sourceIds', []))
            for evidence in plan.get('limitEvidence', {}).values():
                if isinstance(evidence, dict):
                    plan_source_ids.extend(evidence.get('sourceIds', []))
            result += _source_links(plan_source_ids, sources) + '</td></tr>'
        result += '</tbody></table></div>'
        if tool.get('constraints'):
            result += '<div class="decision-tool-constraints">' + _list(tool['constraints']) + '</div>'
        result += '</div>'
    result += '</details>'
    if comparison.get('trialChecklist'):
        result += '<div class="decision-trial"><h3>Before you pay: test the actual job</h3>' + _list(comparison['trialChecklist']) + '</div>'
    result += '<script type="application/json" data-decision-data>' + encoded + '</script></section>'
    return result
