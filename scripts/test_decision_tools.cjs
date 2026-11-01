'use strict';
// Business invariants against the published evidence, plus independent failure cases.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const engine = require('../site-assets/decision-tools.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/decision-evidence.json'), 'utf8'));
function comparison(id) { return data.comparisons.find(c => c.id === id); }
function calculate(id, changes = {}) {
  const c = comparison(id);
  return engine.evaluateComparison(c, data, { ...engine.defaults(c.calculator.kind, c.calculator.defaults), ...changes });
}
function plan(result, tool, id) { return result.plans.find(p => p.toolId === tool && p.id === id); }

test('all four research-backed calculators have valid defaults and cited plans', () => {
  for (const c of data.comparisons) {
    const result = calculate(c.id);
    assert.equal(result.valid, true, c.id);
    assert.ok(result.plans.length >= 2, c.id);
    for (const p of result.plans) {
      assert.ok(p.sourceIds.length, `${p.toolId}:${p.id} has primary evidence`);
      for (const id of p.sourceIds) assert.ok(data.sources.find(s => s.id === id), id);
    }
  }
});

test('broadcasts and welcome sends are counted separately without adding subscribers twice', () => {
  const result = calculate('mailerlite-vs-kit', { subscribers: 500, broadcastsPerMonth: 4, newSubscribers: 100, welcomeEmails: 3 });
  assert.equal(result.metrics.emailsPerMonth, 2300);
  assert.equal(result.metrics.subscribers, 500);
  assert.equal(plan(result, 'mailerlite', 'comfort-500').fit, 'eligible');
  assert.equal(plan(result, 'mailerlite', 'comfort-500').cost.monthly, 12);
  assert.equal(plan(result, 'mailerlite', 'comfort-500').cost.annualTotal, 129.6);
  assert.equal(plan(result, 'mailerlite', 'comfort-500').cost.annualEquivalent, 10.8);
});

test('Kit free fits broadcasts but not a welcome sequence regardless of its large free list', () => {
  const broadcast = calculate('mailerlite-vs-kit', { subscribers: 5000, broadcastsPerMonth: 4, newSubscribers: 0, welcomeEmails: 0, activeAutomations: 0 });
  assert.equal(plan(broadcast, 'kit', 'free').fit, 'eligible');
  assert.equal(plan(broadcast, 'kit', 'free').cost.monthly, 0);
  const sequence = calculate('mailerlite-vs-kit', { subscribers: 250, newSubscribers: 20, welcomeEmails: 3, activeAutomations: 1 });
  assert.equal(plan(sequence, 'kit', 'free').fit, 'ineligible');
  assert.ok(plan(sequence, 'kit', 'free').failed.some(s => /sequences/.test(s)));
});

test('subscriber and sending boundaries are inclusive and independent', () => {
  const at = calculate('mailerlite-vs-kit', { subscribers: 250, broadcastsPerMonth: 10, newSubscribers: 0, welcomeEmails: 0, activeAutomations: 0 });
  assert.equal(plan(at, 'mailerlite', 'free').fit, 'eligible');
  const sendOver = calculate('mailerlite-vs-kit', { subscribers: 250, broadcastsPerMonth: 10, newSubscribers: 1, welcomeEmails: 1, activeAutomations: 1 });
  assert.equal(plan(sendOver, 'mailerlite', 'free').fit, 'ineligible');
  const listOver = calculate('mailerlite-vs-kit', { subscribers: 501, broadcastsPerMonth: 1, newSubscribers: 0, welcomeEmails: 0, activeAutomations: 0 });
  assert.equal(plan(listOver, 'mailerlite', 'comfort-500').fit, 'ineligible');
  assert.equal(plan(listOver, 'mailerlite', 'comfort-500').cost.monthly, null);
  assert.equal(plan(listOver, 'mailerlite', 'comfort-500').cost.annualTotal, null);
  assert.equal(plan(listOver, 'kit', 'creator-1000').cost.monthly, 39);
});

test('welcome entrants cannot exceed the total or require an impossible zero-automation setup', () => {
  assert.equal(calculate('mailerlite-vs-kit', { subscribers: 100, newSubscribers: 101 }).valid, false);
  assert.equal(calculate('mailerlite-vs-kit', { activeAutomations: 0, welcomeEmails: 3, newSubscribers: 1 }).valid, false);
});

test('MailerLite automation-step boundaries apply independently of email and list allowances', () => {
  const base = { subscribers: 100, broadcastsPerMonth: 1, newSubscribers: 10, welcomeEmails: 3, activeAutomations: 1 };
  const five = calculate('mailerlite-vs-kit', { ...base, automationSteps: 5 });
  assert.equal(five.valid, true);
  assert.equal(five.metrics.automationSteps, 5);
  assert.equal(plan(five, 'mailerlite', 'free').fit, 'eligible');
  const six = calculate('mailerlite-vs-kit', { ...base, automationSteps: 6 });
  assert.equal(six.valid, true);
  assert.equal(plan(six, 'mailerlite', 'free').fit, 'ineligible');
  assert.ok(plan(six, 'mailerlite', 'free').failed.some(s => /6 needed; this plan covers 5 steps in one automation/.test(s)));
  assert.equal(plan(six, 'mailerlite', 'comfort-500').fit, 'eligible');
  const hundred = calculate('mailerlite-vs-kit', { ...base, automationSteps: 100 });
  assert.equal(plan(hundred, 'mailerlite', 'comfort-500').fit, 'eligible');
  assert.equal(plan(hundred, 'mailerlite', 'power-500').fit, 'eligible');
  const overPaid = calculate('mailerlite-vs-kit', { ...base, automationSteps: 101 });
  assert.equal(plan(overPaid, 'mailerlite', 'comfort-500').fit, 'ineligible');
  assert.equal(plan(overPaid, 'mailerlite', 'power-500').fit, 'ineligible');
});

test('email steps cannot be fewer than welcome emails, even before new subscribers arrive', () => {
  for (const newSubscribers of [0, 10]) {
    const impossible = calculate('mailerlite-vs-kit', { newSubscribers, welcomeEmails: 7, activeAutomations: 1, automationSteps: 5 });
    assert.equal(impossible.valid, false);
    assert.equal(impossible.plans.length, 0);
    assert.ok(impossible.errors.some(e => e.key === 'automationSteps' && /at least 7 email steps/.test(e.message)));
  }
  assert.equal(calculate('mailerlite-vs-kit', { activeAutomations: 1, automationSteps: 0 }).valid, false);
  const seven = calculate('mailerlite-vs-kit', { welcomeEmails: 7, activeAutomations: 1, automationSteps: 7 });
  assert.equal(seven.valid, true, 'delays are reader-counted, not silently invented');
  assert.equal(plan(seven, 'mailerlite', 'free').fit, 'ineligible');
});

test('broadcast-only requirements do not acquire an automation-step gate', () => {
  for (const automationSteps of [0, 5, 101]) {
    const result = calculate('mailerlite-vs-kit', { subscribers: 100, broadcastsPerMonth: 1, newSubscribers: 0, welcomeEmails: 0, activeAutomations: 0, automationSteps });
    assert.equal(result.valid, true);
    assert.equal(result.metrics.automationSteps, 0);
    assert.equal(plan(result, 'mailerlite', 'free').fit, 'eligible');
    assert.equal(plan(result, 'kit', 'free').fit, 'eligible');
    assert.ok(result.metricNotes.some(s => /step count is not applied/.test(s)));
  }
});

test('unknown Kit step capacity is explicit and never invented as unlimited', () => {
  const result = calculate('mailerlite-vs-kit', { subscribers: 100, broadcastsPerMonth: 1, newSubscribers: 10, welcomeEmails: 3, activeAutomations: 1, automationSteps: 5 });
  const creator = plan(result, 'kit', 'creator-1000');
  assert.equal(creator.fit, 'unverified');
  assert.ok(creator.unknown.some(s => /Confirm capacity for 5 steps in one automation/.test(s)));
  assert.equal(creator.failed.length, 0, 'unknown is not a fabricated hard limit');
  for (const kit of data.tools.kit.plans) {
    assert.equal(engine.limitValue(kit, 'automationStepsMax'), null);
    assert.ok(!(kit.unlimitedLimits || []).includes('automationStepsMax'));
    assert.ok(!(kit.notMeteredLimits || []).includes('automationStepsMax'));
  }
  const summary = engine.summaryText(result, comparison('mailerlite-vs-kit'), data);
  assert.match(summary, /Steps in your largest automation: 5/);
  assert.match(summary, /Confirm capacity for 5 steps in one automation/);
});

test('Zapier tasks and Make credits use their disclosed independent arithmetic', () => {
  const result = calculate('zapier-vs-make', { workflowRuns: 200, actionSteps: 3, triggerModules: 1, extraCredits: 100 });
  assert.equal(result.metrics.tasksPerMonth, 600);
  assert.equal(result.metrics.creditsPerMonth, 900);
  assert.equal(plan(result, 'zapier', 'free').fit, 'ineligible');
  assert.equal(plan(result, 'make', 'free').fit, 'eligible');
  assert.equal(plan(result, 'zapier', 'professional-750').cost.monthly, null);
  assert.equal(plan(result, 'zapier', 'professional-750').cost.annualTotal, 239.88);
  assert.equal(plan(result, 'zapier', 'professional-750').cost.annualEquivalent, 19.99);
});

test('free Zapier rejects multistep and premium workflows even at low volume', () => {
  const two = calculate('zapier-vs-make', { workflowRuns: 1, actionSteps: 2 });
  assert.equal(plan(two, 'zapier', 'free').fit, 'ineligible');
  const premium = calculate('zapier-vs-make', { workflowRuns: 1, actionSteps: 1, premiumApps: true });
  assert.equal(plan(premium, 'zapier', 'free').fit, 'ineligible');
  const simple = calculate('zapier-vs-make', { workflowRuns: 100, actionSteps: 1, premiumApps: false });
  assert.equal(plan(simple, 'zapier', 'free').fit, 'eligible');
  const tooManySteps = calculate('zapier-vs-make', { workflowRuns: 1, actionSteps: 100, premiumApps: false });
  assert.equal(plan(tooManySteps, 'zapier', 'professional-750').fit, 'ineligible', 'a trigger plus 100 actions exceeds 100 total steps');
});

test('automation quotes stop at their verified tiers without invented overages', () => {
  const result = calculate('zapier-vs-make', { workflowRuns: 6000, actionSteps: 2 });
  assert.equal(plan(result, 'zapier', 'professional-750').cost.annualTotal, null);
  assert.equal(plan(result, 'make', 'core-10000').cost.monthly, null);
  assert.equal(plan(result, 'make', 'core-10000').fit, 'ineligible');
});

test('a refillable Buffer queue is not mistaken for a monthly publishing quota', () => {
  const result = calculate('buffer-vs-metricool', { channels: 3, brands: 1, postsPerMonth: 100, queuedPerChannel: 10, linkedIn: false });
  assert.equal(plan(result, 'buffer', 'free').fit, 'eligible');
  assert.equal(plan(result, 'metricool', 'free').fit, 'ineligible');
  const moreQueue = calculate('buffer-vs-metricool', { queuedPerChannel: 11 });
  assert.equal(plan(moreQueue, 'buffer', 'free').fit, 'ineligible');
});

test('Buffer charges every paid channel while Metricool uses a flat brand bundle', () => {
  const result = calculate('buffer-vs-metricool', { channels: 6, brands: 3, postsPerMonth: 30 });
  assert.equal(plan(result, 'buffer', 'essentials').fit, 'eligible');
  assert.equal(plan(result, 'buffer', 'essentials').cost.monthly, 36);
  assert.equal(plan(result, 'buffer', 'essentials').cost.annualTotal, 360);
  assert.equal(plan(result, 'buffer', 'essentials').cost.annualEquivalent, 30);
  assert.equal(plan(result, 'metricool', 'starter-5').cost.monthly, 25);
  assert.equal(plan(result, 'metricool', 'starter-5').cost.annualTotal, 240);
  const beyond = calculate('buffer-vs-metricool', { channels: 11, brands: 6 });
  assert.equal(plan(beyond, 'buffer', 'essentials').cost.monthly, null);
  assert.equal(plan(beyond, 'buffer', 'essentials').fit, 'unverified');
  assert.equal(plan(beyond, 'metricool', 'starter-5').cost.monthly, null);
  assert.equal(plan(beyond, 'metricool', 'advanced-15').cost.monthly, 67);
});

test('social network and approval gates affect fit, and unpriced add-ons remain incomplete', () => {
  const result = calculate('buffer-vs-metricool', { postsPerMonth: 10, linkedIn: true, approvals: true, x: true });
  assert.equal(plan(result, 'metricool', 'free').fit, 'ineligible');
  assert.equal(plan(result, 'buffer', 'essentials').fit, 'ineligible');
  assert.equal(plan(result, 'buffer', 'team').fit, 'eligible');
  const advanced = plan(result, 'metricool', 'advanced-15');
  assert.equal(advanced.fit, 'unverified');
  assert.equal(advanced.cost.incomplete, true);
  assert.ok(advanced.cost.reasons.some(s => /Base price only/.test(s)));
});

test('fair-use review thresholds create an explicit check, not an invented hard cap', () => {
  const result = calculate('buffer-vs-metricool', { brands: 2, channels: 4, postsPerMonth: 1201 });
  const starter = plan(result, 'metricool', 'starter-5');
  assert.equal(starter.fit, 'unverified');
  assert.equal(starter.failed.length, 0);
  assert.ok(starter.unknown.some(s => /review threshold/.test(s)));
  assert.equal(starter.cost.monthly, 25);
});

test('personal assistant subscriptions do not imply team capacity or business administration', () => {
  const c = data.comparisons.find(c => c.calculator.kind === 'assistant');
  const single = calculate(c.id);
  assert.equal(plan(single, 'chatgpt', 'plus').cost.annualTotal, null);
  assert.equal(plan(single, 'chatgpt', 'plus').cost.annualAvailable, false);
  assert.equal(plan(single, 'claude', 'pro').cost.annualTotal, 200);
  assert.equal(plan(single, 'claude', 'pro').cost.annualEquivalent, 16.67);
  const team = calculate(c.id, { users: 2, teamAdministration: true });
  assert.ok(team.plans.every(p => p.fit === 'ineligible'));
});

test('unknown prices, limits and currencies never become zero or eligible by accident', () => {
  const unknown = { id: 'unknown', name: 'Unknown', billingUnit: 'flat', monthlyUsd: null, annualTotalUsd: null, limits: {}, features: {} };
  const cost = engine.pricePlan(unknown, {});
  assert.equal(cost.monthly, null);
  assert.equal(cost.annualTotal, null);
  assert.equal(cost.known, false);
  const fit = engine.evaluatePlan(unknown, 'example', 'email', { subscribers: 10, activeAutomations: 0, newSubscribers: 0, welcomeEmails: 0 }, { subscribers: 10, emailsPerMonth: 10, activeAutomations: 0 });
  assert.equal(fit.fit, 'unverified');
  const currencyMismatch = engine.pricePlan({ ...unknown, currency: 'EUR', monthlyUsd: 20, annualTotalUsd: 200 }, {});
  assert.equal(currencyMismatch.monthly, null);
  assert.equal(currencyMismatch.annualTotal, null);
  assert.equal(engine.pricePlan({ ...unknown, billingUnit: 'unmapped', monthlyUsd: 20 }, {}).known, false);
});

test('per-seat minimum purchases and annual cash obligations are explicit', () => {
  const result = engine.pricePlan({ billingUnit: 'seat', minQuantity: 3, monthlyUsd: 20, annualTotalUsd: 180 }, { users: 1 });
  assert.equal(result.quantity, 3);
  assert.equal(result.monthly, 60);
  assert.equal(result.annualTotal, 540);
  assert.equal(result.annualEquivalent, 45);
  assert.ok(result.reasons.some(s => /Minimum purchase: 3/.test(s)));
});

test('invalid or missing inputs yield no stale estimates', () => {
  for (const value of ['', ' ', -1, Infinity, NaN, 'abc', '3.5', false, null, undefined, '1e3']) {
    const result = calculate('mailerlite-vs-kit', { subscribers: value });
    assert.equal(result.valid, false, String(value));
    assert.equal(result.plans.length, 0);
  }
  assert.equal(calculate('buffer-vs-metricool', { brands: 4, channels: 3 }).valid, false);
  assert.equal(calculate('zapier-vs-make', { workflowRuns: 1000001 }).valid, false, 'documented input bounds apply');
});

test('no reviewed plans is a genuine empty state and unknown comparison is rejected', () => {
  const c = comparison('zapier-vs-make');
  const result = engine.evaluateComparison({ ...c, calculator: { ...c.calculator, eligiblePlanIds: ['missing:plan'] } }, data, engine.defaults('automation', c.calculator.defaults));
  assert.equal(result.empty, true);
  assert.equal(result.plans.length, 0);
  assert.equal(engine.evaluateComparison({ toolIds: [] }, data, {}).valid, false);
});

test('portable summaries retain inputs, commitments, caveats and primary-source URLs', () => {
  const c = comparison('zapier-vs-make');
  const result = calculate(c.id);
  const text = engine.summaryText(result, c, data);
  assert.match(text, /YOUR INPUTS/);
  assert.match(text, /\$239\.88 paid for a full year/);
  assert.match(text, /Monthly-pay price: not verified/);
  assert.match(text, /https:\/\/help\.make\.com\/credits/);
  assert.match(text, /not a quality score or a hands-on performance test/);
  assert.doesNotMatch(text, /undefined|NaN|\[object Object\]/);
});

test('server rendering provides source-backed no-JS content and safely embeds hostile text', () => {
  const python = String.raw`
import json,sys
sys.path.insert(0,'scripts')
from decision_components import render_decision_tool
x=json.load(open('data/decision-evidence.json'))
for c in x['comparisons']:
 html=render_decision_tool(c['id'],x)
 assert 'data-decision-form hidden' in html
 assert '<caption>' in html
 assert 'Verified plan reference and primary sources' in html
 assert 'https://' in html
 assert 'USD ' in html
 assert html.count('type="application/json"') == 1
 assert '<script>alert' not in html
 if c['id']=='mailerlite-vs-kit':
  assert '5 steps in one automation' in html
  assert '100 steps in one automation' in html
assert render_decision_tool('missing',x) == ''
x['comparisons'][0]['decisionQuestion']='</script><script>alert("unsafe")</script>'
x['sources'][0]['title']='<img src=x onerror=alert(1)>'
x['sources'][0]['url']='javascript:alert(1)'
html=render_decision_tool(x['comparisons'][0]['id'],x)
assert '<script>alert' not in html
assert '<img src=x' not in html
assert 'href="javascript:' not in html
assert r'\u003c/script' in html
print('safe static reference confirmed')
`;
  const result = spawnSync('python3', ['-c', python], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test('the standalone calculator neither persists nor sends numeric input data', () => {
  const script = fs.readFileSync(path.join(__dirname, '../site-assets/decision-tools.js'), 'utf8');
  assert.doesNotMatch(script, /\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\b|\bgtag\s*\(|\bdataLayer\b|\blocalStorage\b|\bsessionStorage\b/);
});
