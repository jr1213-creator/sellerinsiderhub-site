"""A short, evidence-backed decision section for the existing automation category."""
from html import escape


def render_automation_hub(evidence, origin):
    """Render below the category hero and before its existing tool-card grid."""
    h = lambda value: escape(str(value), quote=True)
    sources = {source['id']: source for source in evidence['sources']}
    plans = {tool_id + ':' + plan['id']: plan
             for tool_id in ('zapier', 'make')
             for plan in evidence['tools'][tool_id]['plans']}
    comparison = next(item for item in evidence['comparisons'] if item['id'] == 'zapier-vs-make')
    inputs = comparison['calculator']['defaults']
    runs, actions, triggers = inputs['workflowRuns'], inputs['actionSteps'], inputs['triggerModules']
    tasks = runs * actions
    credits = runs * (actions + triggers) + inputs['extraCredits']
    zapier_free, zapier_paid = plans['zapier:free'], plans['zapier:professional-750']
    make_free, make_paid = plans['make:free'], plans['make:core-10000']
    if any(plan.get('currency') != 'USD' for plan in plans.values()):
        raise ValueError('The automation reference requires the recorded USD price basis.')

    def reference(source_id, label):
        url = sources[source_id]['url']
        if not url.startswith('https://'):
            raise ValueError('Automation evidence needs an official HTTPS source.')
        return f'<a href="{h(url)}" target="_blank" rel="noopener">{h(label)} ↗</a>'

    def internal(route, label):
        return f'<a href="{h(origin.rstrip("/") + route)}">{h(label)}</a>'

    return f'''<section class="section"><div class="wrap"><article class="article-body">
<h2>Choose an automation tool around one workflow</h2>
<p>Write down what starts the workflow, each action it must finish, and how often it will run. Then check the exact app actions, account permissions, scheduling needs, and plan limits. A low starting price helps only when the complete route fits.</p>
<h3>What the entry plans cover</h3>
<p class="small">Evidence checked {h(evidence['checkedAt'])}. USD before tax, external app/API charges, and overages. These are specific recorded tiers; confirm current checkout before buying.</p>
<div class="table-scroll"><table class="data-table"><caption>Zapier and Make: recorded entry-plan boundaries</caption><thead><tr><th scope="col">Plan</th><th scope="col">Payment basis</th><th scope="col">Main boundary</th><th scope="col">Source</th></tr></thead><tbody>
<tr><th scope="row">Zapier Free</th><td>USD {zapier_free['monthlyUsd']:,.2f}/month</td><td>{zapier_free['limits']['tasksPerMonthMax']:,} tasks/month; a trigger plus {zapier_free['limits']['actionStepsMax']} action. Premium apps require a paid plan.</td><td>{reference('zapier-pricing', 'Plan limits')}</td></tr>
<tr><th scope="row">Zapier Professional</th><td>USD {zapier_paid['annualTotalUsd']:,.2f}/year; USD {zapier_paid['annualTotalUsd'] / 12:,.2f}/month equivalent, paid annually</td><td>{zapier_paid['limits']['tasksPerMonthMax']:,} tasks/month; multi-step routes and premium apps. Monthly-pay quote not recorded.</td><td>{reference('zapier-pricing-guide', 'Price and tier')}</td></tr>
<tr><th scope="row">Make Free</th><td>USD {make_free['monthlyUsd']:,.2f}/month</td><td>{make_free['limits']['creditsPerMonthMax']:,} credits/month. Confirm the required app actions and schedule.</td><td>{reference('make-plan-guide', 'Plan guide')}</td></tr>
<tr><th scope="row">Make Core</th><td>USD {make_paid['monthlyUsd']:,.2f}/month in the recorded June 2026 vendor guide</td><td>{make_paid['limits']['creditsPerMonthMax']:,} credits/month. Annual charge not recorded.</td><td>{reference('make-plan-guide', 'Price and tier')}</td></tr>
</tbody></table></div>
<h3>A task is not a credit</h3>
<p>For the simple route in our comparison, {runs:,} runs × {actions} billable actions gives <strong>{tasks:,} Zapier tasks</strong>. Counting {triggers} trigger module per run gives {runs:,} × ({actions} + {triggers}) + {inputs['extraCredits']:,} extra = <strong>{credits:,} Make credits</strong>. These are planning estimates, not equivalent-work benchmarks. Polling, repeated items, retries, AI, and special action rates can change consumption. {reference('zapier-tasks', 'Zapier task accounting')} · {reference('make-credits', 'Make credit accounting')}.</p>
<p>Check both volume and features: the example exceeds Zapier Free’s task and action limits. Make Free’s recorded credits cover the arithmetic, but app support and scheduling still need verification. {internal('/comparisons/zapier-vs-make/', 'Adjust the inputs in the full Zapier versus Make comparison')}.</p>
<h3>Prove recovery before switching it on</h3>
<ol><li><strong>Test one complete record.</strong> Use a harmless sample and confirm every destination field, owner, and timestamp.</li><li><strong>Try a missing field and a repeated record.</strong> Decide what should stop, what should alert you, and how to prevent duplicate contacts or messages.</li><li><strong>Rehearse a failed action.</strong> Check what already succeeded before retrying. Keep a clear way to pause the workflow and finish the task manually.</li></ol>
<p>Build that first controlled workflow with {internal('/playbooks/first-reliable-automation/', 'the reliable automation tutorial')}, or use {internal('/playbooks/service-lead-follow-up/', 'the service-lead follow-up example')}. For the underlying prices, units, and downloadable evidence, see {internal('/research/software-plan-costs/', 'our software plan cost and capacity data')}.</p>
</article></div></section>'''
