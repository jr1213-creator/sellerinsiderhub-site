/* Source-backed plan comparisons. All inputs and calculations stay in this browser. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SIHDecisionTools = api; if (root.document) api.mount(root.document); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var fields = {
    assistant: [
      { key: 'users', label: 'People who need access', min: 1, max: 1000, value: 1 },
      { key: 'teamAdministration', label: 'I need shared business administration', type: 'checkbox', value: false, help: 'Separate personal accounts do not provide a managed team workspace.' }
    ],
    email: [
      { key: 'subscribers', label: 'Active subscribers', min: 1, max: 1000000, value: 500 },
      { key: 'broadcastsPerMonth', label: 'Full-list broadcasts each month', min: 0, max: 1000, value: 4 },
      { key: 'newSubscribers', label: 'New subscribers in that month', min: 0, max: 1000000, value: 100, help: 'Include these people in your active subscriber total above.' },
      { key: 'welcomeEmails', label: 'Welcome emails per new subscriber', min: 0, max: 100, value: 3, help: 'Enter 0 if you only send broadcasts. A welcome sequence needs sequence support.' },
      { key: 'activeAutomations', label: 'Active automations you need', min: 0, max: 10000, value: 1 },
      { key: 'automationSteps', label: 'Steps in your largest automation', min: 0, max: 10000, value: 5, help: 'Count email, delay, condition and other action blocks after the trigger. Three emails plus two delays = 5. Ignored when active automations is 0.' }
    ],
    automation: [
      { key: 'workflowRuns', label: 'Workflow runs each month', min: 1, max: 10000000, value: 100 },
      { key: 'actionSteps', label: 'Billable action steps per run', min: 1, max: 1000, value: 2, help: 'For this simple estimate, each action is one Zapier task and one standard Make credit.' },
      { key: 'triggerModules', label: 'Make trigger modules per run', min: 0, max: 1000, value: 1, help: 'Make can also meter its trigger modules. Zapier triggers are not counted as tasks here.' },
      { key: 'extraCredits', label: 'Extra Make credits each month', min: 0, max: 100000000, value: 0, help: 'Add known polling, retry, iterator or other credit usage. Inspect your execution logs.' },
      { key: 'premiumApps', label: 'I need a Zapier premium app', type: 'checkbox', value: false }
    ],
    social: [
      { key: 'channels', label: 'Social profiles / channels', min: 1, max: 1000, value: 3 },
      { key: 'brands', label: 'Brands you manage', min: 1, max: 1000, value: 1, help: 'A brand is a business or client. Check each network’s profile allowance within a brand.' },
      { key: 'postsPerMonth', label: 'Published posts each month', min: 0, max: 1000000, value: 30, help: 'Count each publication to each network. One post sent to 3 networks counts as 3.' },
      { key: 'queuedPerChannel', label: 'Most posts queued on one channel', min: 0, max: 100000, value: 10, help: 'Queue size is a separate limit from the number you publish in a month.' },
      { key: 'approvals', label: 'I need an approval workflow', type: 'checkbox', value: false },
      { key: 'linkedIn', label: 'I need LinkedIn', type: 'checkbox', value: false },
      { key: 'x', label: 'I need X / Twitter', type: 'checkbox', value: false }
    ]
  };
  var limitLabels = {
    usersMax: 'people', subscribersMax: 'active subscribers', emailsPerMonthMax: 'emails / month',
    activeAutomationsMax: 'active automations', automationStepsMax: 'steps in one automation', tasksPerMonthMax: 'tasks / month', creditsPerMonthMax: 'credits / month',
    actionStepsMax: 'action steps / run', stepsMax: 'total steps / run', channelsMax: 'channels', brandsMax: 'brands',
    postsPerMonthMax: 'posts / month', queuedPerChannelMax: 'queued posts / channel'
  };
  function number(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
  function round(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
  function count(value) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value); }
  function money(value, currency) {
    if (!number(value)) return 'Not verified';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(value); }
    catch (_) { return String(currency || 'USD') + ' ' + value.toFixed(2); }
  }
  function defaults(kind, overrides) {
    var out = {};
    (fields[kind] || []).forEach(function (f) { out[f.key] = f.value; });
    return Object.assign(out, overrides || {});
  }
  function validateInputs(kind, raw, bounds) {
    var errors = [], inputs = {};
    if (!fields[kind]) return { valid: false, errors: [{ key: '', message: 'This comparison has no supported calculator.' }], inputs: inputs };
    fields[kind].forEach(function (field) {
      field = Object.assign({}, field);
      var bound = (bounds || {})[field.key] || {};
      if (number(bound.min)) field.min = Math.max(field.min, bound.min);
      if (number(bound.max)) field.max = Math.min(field.max, bound.max);
      var val = raw && raw[field.key];
      if (field.type === 'checkbox') {
        if (val === undefined) val = false;
        if (val !== true && val !== false) errors.push({ key: field.key, message: field.label + ': choose on or off.' });
        else inputs[field.key] = val;
        return;
      }
      if (typeof val !== 'number' && typeof val !== 'string') val = NaN;
      else if (typeof val === 'string' && !/^\d+$/.test(val.trim())) val = NaN;
      var n = Number(val);
      if (!Number.isSafeInteger(n) || n < field.min || n > field.max) {
        errors.push({ key: field.key, message: field.label + ': enter a whole number from ' + count(field.min) + ' to ' + count(field.max) + '.' });
      } else inputs[field.key] = n;
    });
    if (kind === 'email' && number(inputs.newSubscribers) && number(inputs.subscribers) && inputs.newSubscribers > inputs.subscribers) {
      errors.push({ key: 'newSubscribers', message: 'New subscribers must be included in, and cannot exceed, your active subscriber total.' });
    }
    if (kind === 'email' && inputs.welcomeEmails > 0 && inputs.newSubscribers > 0 && inputs.activeAutomations === 0) {
      errors.push({ key: 'activeAutomations', message: 'A welcome sequence needs at least one active automation. Enter 1 or more, or set welcome emails to 0.' });
    }
    if (kind === 'email' && inputs.activeAutomations > 0 && inputs.automationSteps === 0) {
      errors.push({ key: 'automationSteps', message: 'An active automation needs at least one step. Count its email, delay, condition and other action blocks.' });
    } else if (kind === 'email' && inputs.activeAutomations > 0 && number(inputs.automationSteps) && inputs.automationSteps < inputs.welcomeEmails) {
      errors.push({ key: 'automationSteps', message: 'The largest automation must contain at least ' + count(inputs.welcomeEmails) + ' email steps for your welcome sequence, plus any delay or other blocks. Increase the step count or reduce the welcome emails.' });
    }
    if (kind === 'social' && inputs.brands > inputs.channels) errors.push({ key: 'brands', message: 'Each brand in this estimate needs at least one channel. Brands cannot exceed channels.' });
    return { valid: errors.length === 0, errors: errors, inputs: inputs };
  }
  function deriveMetrics(kind, i) {
    if (kind === 'assistant') return { users: i.users };
    if (kind === 'email') return { subscribers: i.subscribers, emailsPerMonth: i.subscribers * i.broadcastsPerMonth + i.newSubscribers * i.welcomeEmails, activeAutomations: i.activeAutomations, automationSteps: i.activeAutomations > 0 ? i.automationSteps : 0 };
    if (kind === 'automation') return { tasksPerMonth: i.workflowRuns * i.actionSteps, creditsPerMonth: i.workflowRuns * (i.actionSteps + i.triggerModules) + i.extraCredits, actionSteps: i.actionSteps, steps: i.actionSteps + 1 };
    if (kind === 'social') return { channels: i.channels, brands: i.brands, postsPerMonth: i.postsPerMonth, queuedPerChannel: i.queuedPerChannel };
    return {};
  }
  function metricNotes(kind, i, m) {
    if (kind === 'assistant') return [count(i.users) + (i.users === 1 ? ' person' : ' people') + (i.teamAdministration ? '; shared business administration required.' : '; no shared business administration required.')];
    if (kind === 'email') return [count(i.subscribers) + ' × ' + count(i.broadcastsPerMonth) + ' broadcast sends + ' + count(i.newSubscribers) + ' × ' + count(i.welcomeEmails) + ' welcome sends = ' + count(m.emailsPerMonth) + ' estimated emails / month. This is a conservative full-list estimate; it includes new subscribers in every broadcast.', i.activeAutomations > 0 ? count(i.activeAutomations) + ' active automations; the largest contains ' + count(m.automationSteps) + ' steps. Step capacity is checked separately from subscriber and sending limits.' : 'No active automations requested; the step count is not applied.'];
    if (kind === 'automation') return [count(i.workflowRuns) + ' runs × ' + count(i.actionSteps) + ' billable actions = ' + count(m.tasksPerMonth) + ' estimated Zapier tasks / month.', count(i.workflowRuns) + ' × (' + count(i.actionSteps) + ' actions + ' + count(i.triggerModules) + ' triggers) + ' + count(i.extraCredits) + ' extra = ' + count(m.creditsPerMonth) + ' estimated Make credits / month. Standard one-credit modules only; tasks and credits are different meters.'];
    if (kind === 'social') return [count(i.channels) + ' channels across ' + count(i.brands) + (i.brands === 1 ? ' brand' : ' brands') + '; ' + count(i.postsPerMonth) + ' posts / month and up to ' + count(i.queuedPerChannel) + ' queued posts on any one channel.'];
    return [];
  }
  function limitValue(plan, key) {
    if ((plan.unlimitedLimits || []).indexOf(key) >= 0) return Infinity;
    var val = (plan.limits || {})[key];
    if (val && typeof val === 'object') val = val.value;
    return number(val) ? val : null;
  }
  function pricePlan(plan, inputs, metrics) {
    var unit = plan.billingUnit || 'flat';
    var quantities = { flat: 1, seat: inputs.users, channel: inputs.channels, brand: inputs.brands };
    var requested = quantities[unit], reasons = [], quantity = requested;
    if (!number(requested) || requested < 1) return { known: false, quantity: null, currency: plan.currency || 'USD', reasons: ['The billing unit could not be matched to your inputs.'], monthly: null, annualTotal: null, annualEquivalent: null };
    var minimum = number(plan.minQuantity) ? plan.minQuantity : (number((plan.priceScope || {}).minQuantity) ? plan.priceScope.minQuantity : 1);
    quantity = Math.max(requested, minimum);
    if (quantity > requested) reasons.push('Minimum purchase: ' + count(quantity) + ' ' + unit + (quantity === 1 ? '' : 's') + ', even for ' + count(requested) + ' requested.');
    var scope = plan.priceScope || {};
    var unsupported = false;
    metrics = metrics || {};
    [['maxQuantity', quantity], ['subscriberMax', inputs.subscribers], ['subscribersMax', inputs.subscribers], ['channelsMax', inputs.channels], ['brandsMax', inputs.brands], ['tasksPerMonthMax', metrics.tasksPerMonth], ['creditsPerMonthMax', metrics.creditsPerMonth]].forEach(function (entry) {
      if (number(scope[entry[0]]) && number(entry[1]) && entry[1] > scope[entry[0]]) unsupported = true;
    });
    if (unsupported) reasons.push('Your needs exceed this verified price band. Check the vendor’s current tier; no higher-tier price is inferred.');
    var currency = plan.currency || 'USD';
    var monthly = !unsupported && number(plan.monthlyUsd) ? round(plan.monthlyUsd * quantity) : null;
    var annual = !unsupported && number(plan.annualTotalUsd) ? round(plan.annualTotalUsd * quantity) : null;
    // Explicit currency-specific amounts can be supplied without pretending USD is another currency.
    if (currency !== 'USD' && (plan.monthlyUsd != null || plan.annualTotalUsd != null)) {
      monthly = null; annual = null; reasons.push('The price currency does not match the supplied USD fields. Confirm the quote.');
    }
    if (!number(monthly) && !number(annual) && !unsupported) reasons.push('A complete price for this plan has not been verified. Ask the vendor or check its pricing page.');
    return { known: number(monthly) || number(annual), outOfRange: unsupported, quantity: quantity, requestedQuantity: requested, billingUnit: unit, currency: currency, monthly: monthly, annualAvailable: plan.annualAvailable, annualTotal: annual, annualEquivalent: number(annual) ? round(annual / 12) : null, reasons: reasons };
  }
  function evaluatePlan(plan, toolId, kind, inputs, metrics) {
    var failed = [], unknown = [], passed = [], sourceIds = (plan.sourceIds || []).slice();
    function checkLimit(key, value, required) {
      if (!number(value) || value === 0) return;
      if ((plan.notMeteredLimits || []).indexOf(key) >= 0) {
        passed.push('No separate quota is applied here for ' + (limitLabels[key] || key) + '; check the plan’s published scope.');
        return;
      }
      var cap = limitValue(plan, key), evidence = (plan.limitEvidence || {})[key];
      if (evidence && evidence.sourceIds) sourceIds = sourceIds.concat(evidence.sourceIds);
      if (cap === null) { if (required) unknown.push('Confirm capacity for ' + count(value) + ' ' + (limitLabels[key] || key) + '.'); return; }
      if (value > cap) failed.push(count(value) + ' needed; this plan covers ' + count(cap) + ' ' + (limitLabels[key] || key) + '.');
      else passed.push(cap === Infinity ? 'No published numeric cap in this evidence for ' + (limitLabels[key] || key) + '.' : count(value) + ' of ' + count(cap) + ' ' + (limitLabels[key] || key) + '.');
    }
    function checkFeature(key, needed, label) {
      if (!needed) return;
      var feature = (plan.features || {})[key];
      if (feature && typeof feature === 'object') feature = feature.value;
      if (feature === false) failed.push(label + ' is not included in this plan.');
      else if (feature !== true) unknown.push('Confirm whether ' + label.toLowerCase() + ' is included.');
      else passed.push(label + ' is included.');
    }
    if (kind === 'assistant') {
      checkLimit('usersMax', metrics.users, plan.billingUnit !== 'seat');
      checkFeature('teamAdministration', inputs.teamAdministration, 'Shared business administration');
    } else if (kind === 'email') {
      checkLimit('subscribersMax', metrics.subscribers, true);
      checkLimit('emailsPerMonthMax', metrics.emailsPerMonth, true);
      checkLimit('activeAutomationsMax', metrics.activeAutomations, true);
      checkLimit('automationStepsMax', metrics.automationSteps, true);
      checkFeature('sequences', inputs.newSubscribers > 0 && inputs.welcomeEmails > 0, 'Automated email sequences');
    } else if (kind === 'automation') {
      if (toolId === 'zapier') {
        checkLimit('tasksPerMonthMax', metrics.tasksPerMonth, true);
        checkLimit('actionStepsMax', metrics.actionSteps, true);
        checkLimit('stepsMax', metrics.steps, false);
        checkFeature('premiumApps', inputs.premiumApps, 'Premium app access');
      } else if (toolId === 'make') checkLimit('creditsPerMonthMax', metrics.creditsPerMonth, true);
      else unknown.push('This platform’s usage meter has not been mapped.');
    } else if (kind === 'social') {
      checkLimit('channelsMax', metrics.channels, toolId === 'buffer');
      checkLimit('brandsMax', metrics.brands, toolId === 'metricool');
      checkLimit('postsPerMonthMax', metrics.postsPerMonth, true);
      checkLimit('queuedPerChannelMax', metrics.queuedPerChannel, toolId === 'buffer');
      checkFeature('approvals', inputs.approvals, 'Approval workflows');
      checkFeature('linkedIn', inputs.linkedIn, 'LinkedIn publishing');
      checkFeature('x', inputs.x, 'X / Twitter publishing');
    }
    if (kind === 'social' && number(plan.fairUseReviewThresholdPostsPerBrandPerMonth) && inputs.postsPerMonth > inputs.brands * plan.fairUseReviewThresholdPostsPerBrandPerMonth) {
      unknown.push('Your total guarantees at least one brand exceeds the ' + count(plan.fairUseReviewThresholdPostsPerBrandPerMonth) + '-post monthly review threshold. Confirm capacity with Metricool; this is a review threshold, not a hard limit.');
    }
    var cost = pricePlan(plan, inputs, metrics);
    if (cost.outOfRange) unknown.push('The current verified price band does not cover your requirements.');
    if (kind === 'social' && toolId === 'metricool' && inputs.x && (plan.features || {}).x == null) {
      cost.incomplete = true;
      cost.reasons.push('Base price only: required X access needs a separately priced add-on. The complete cost has not been verified.');
    }
    return { id: plan.id, name: plan.name, toolId: toolId, fit: failed.length ? 'ineligible' : unknown.length ? 'unverified' : 'eligible', failed: failed, unknown: unknown, passed: passed, cost: cost, notes: plan.notes || [], scope: plan.scope || '', sourceIds: Array.from(new Set(sourceIds)), plan: plan };
  }
  function evaluateComparison(comparison, data, raw) {
    var kind = comparison.calculator && comparison.calculator.kind;
    var checked = validateInputs(kind, raw, (comparison.calculator || {}).inputBounds);
    var result = { valid: checked.valid, errors: checked.errors, inputs: checked.inputs, kind: kind, plans: [], metrics: {}, metricNotes: [], checkedAt: data.checkedAt, caveats: ((comparison.calculator || {}).caveats || []).slice() };
    if (!checked.valid) return result;
    result.metrics = deriveMetrics(kind, checked.inputs);
    result.metricNotes = metricNotes(kind, checked.inputs, result.metrics);
    var allowed = (comparison.calculator || {}).eligiblePlanIds || [];
    (comparison.toolIds || []).forEach(function (toolId) {
      var tool = (data.tools || {})[toolId];
      if (!tool) return;
      (tool.plans || []).forEach(function (plan) {
        if (allowed.length && allowed.indexOf(toolId + ':' + plan.id) < 0 && allowed.indexOf(plan.id) < 0) return;
        var evaluated = evaluatePlan(plan, toolId, kind, checked.inputs, result.metrics);
        evaluated.toolName = tool.name || toolId;
        evaluated.toolConstraints = tool.constraints || [];
        result.plans.push(evaluated);
      });
    });
    result.empty = result.plans.length === 0;
    return result;
  }
  function fitLabel(fit) { return { eligible: 'Fits the checked requirements', ineligible: 'Does not fit these inputs', unverified: 'Check a limit or price tier' }[fit] || 'Check with vendor'; }
  function planCostText(cost) {
    var text = [];
    text.push(number(cost.monthly) ? money(cost.monthly, cost.currency) + ' / month, paid monthly' : 'Monthly-pay price: not verified');
    text.push(cost.annualAvailable === false ? 'No annual billing option' : number(cost.annualTotal) ? money(cost.annualTotal, cost.currency) + ' paid for a full year (' + money(cost.annualEquivalent, cost.currency) + ' / month equivalent)' : 'Annual price: not verified');
    if (cost.incomplete) text.unshift('BASE PRICE ONLY — required add-on not priced');
    return text;
  }
  function sourcesMap(data) {
    var map = {};
    if (Array.isArray(data.sources)) data.sources.forEach(function (s) { map[s.id] = s; });
    else Object.keys(data.sources || {}).forEach(function (id) { map[id] = data.sources[id]; });
    return map;
  }
  function summaryText(result, comparison, data) {
    if (!result.valid) return 'Please correct the inputs before saving a comparison.';
    var lines = ['Seller Insider Hub — ' + comparison.title, 'Plan evidence checked: ' + (data.checkedAt || 'See linked sources'), 'Prepared: ' + new Date().toISOString().slice(0, 10), '', 'YOUR INPUTS'];
    (fields[result.kind] || []).forEach(function (f) { lines.push(f.label + ': ' + (f.type === 'checkbox' ? result.inputs[f.key] ? 'Yes' : 'No' : count(result.inputs[f.key]))); });
    lines.push('', 'THE CALCULATION');
    lines = lines.concat(result.metricNotes);
    var sources = sourcesMap(data), used = new Set();
    result.plans.forEach(function (p) {
      lines.push('', p.toolName + ' — ' + p.name, fitLabel(p.fit));
      lines = lines.concat(planCostText(p.cost), p.failed, p.unknown, p.cost.reasons, p.passed, typeof p.notes === 'string' ? [p.notes] : p.notes);
      p.sourceIds.forEach(function (id) { used.add(id); });
    });
    lines.push('', 'WHAT THIS ESTIMATE DOES NOT PROVE', 'Capacity and feature checks are not a quality score or a hands-on performance test. Taxes, exchange rates, add-ons and unverified higher tiers are excluded. Annual equivalents require the stated full-year payment.');
    lines = lines.concat((comparison.calculator || {}).assumptions || [], result.caveats);
    if (comparison.trialChecklist && comparison.trialChecklist.length) lines = lines.concat('', 'BEFORE YOU PAY', comparison.trialChecklist);
    lines.push('', 'PRIMARY SOURCES');
    used.forEach(function (id) { var s = sources[id]; if (s && safeUrl(s.url)) lines.push((s.title || s.publisher || id) + ' — ' + s.url + (s.checkedAt ? ' (checked ' + s.checkedAt + ')' : '')); });
    lines.push('', 'https://sellerinsiderhub.com/comparisons/' + comparison.id + '/', 'Inputs stay in your browser. This file contains only the numeric needs and choices you entered.');
    return lines.join('\n');
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(url) { return typeof url === 'string' && /^https:\/\//i.test(url); }
  function list(items) { return '<ul>' + items.map(function (x) { return '<li>' + esc(typeof x === 'object' ? x.text : x) + '</li>'; }).join('') + '</ul>'; }
  function mount(doc) {
    if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', function () { mount(doc); }, { once: true }); return; }
    doc.querySelectorAll('[data-decision-tool]').forEach(function (container) {
      if (container.dataset.decisionReady) return;
      var payload, comparison, data, kind;
      try {
        payload = JSON.parse(container.querySelector('[data-decision-data]').textContent);
        comparison = payload.comparison; data = payload.data; kind = comparison.calculator.kind;
        if (!fields[kind]) return;
      } catch (_) { return; }
      var form = container.querySelector('[data-decision-form]'), output = container.querySelector('[data-decision-results]'), status = container.querySelector('[data-decision-status]'), exportActions = container.querySelector('[data-decision-exports]'), manualCopy = container.querySelector('[data-decision-copy-text]');
      var initial = defaults(kind, comparison.calculator.defaults), prefix = container.id || ('decision-' + comparison.id), current = null;
      var controls = fields[kind].map(function (f) {
        f = Object.assign({}, f);
        var bound = (comparison.calculator.inputBounds || {})[f.key] || {};
        if (number(bound.min)) f.min = Math.max(f.min, bound.min);
        if (number(bound.max)) f.max = Math.min(f.max, bound.max);
        var id = prefix + '-' + f.key, help = f.help ? '<span class="decision-help" id="' + esc(id) + '-help">' + esc(f.help) + '</span>' : '';
        var described = f.help ? ' aria-describedby="' + esc(id) + '-help"' : '';
        if (f.type === 'checkbox') return '<div class="decision-field decision-check"><label for="' + esc(id) + '"><input id="' + esc(id) + '" name="' + esc(f.key) + '" type="checkbox"' + (initial[f.key] ? ' checked' : '') + described + '><span>' + esc(f.label) + '</span></label>' + help + '</div>';
        return '<div class="decision-field"><label for="' + esc(id) + '">' + esc(f.label) + '</label><input id="' + esc(id) + '" name="' + esc(f.key) + '" type="number" inputmode="numeric" required min="' + f.min + '" max="' + f.max + '" step="1" value="' + esc(initial[f.key]) + '"' + described + '>' + help + '</div>';
      }).join('');
      form.innerHTML = '<fieldset><legend>Your needs</legend><div class="decision-fields">' + controls + '</div></fieldset><div class="decision-form-actions"><button class="button" type="submit">Check plans for my needs</button><button class="button light" type="reset">Reset example</button></div>';
      form.noValidate = true;
      function values() { var result = {}; fields[kind].forEach(function (f) { result[f.key] = f.type === 'checkbox' ? form.elements[f.key].checked : form.elements[f.key].value; }); return result; }
      function render(focus) {
        current = evaluateComparison(comparison, data, values());
        form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
        manualCopy.hidden = true;
        exportActions.hidden = !current.valid || current.empty;
        if (!current.valid) {
          current.errors.forEach(function (e) { if (form.elements[e.key]) form.elements[e.key].setAttribute('aria-invalid', 'true'); });
          output.innerHTML = '<div class="decision-error"><h3>Check these inputs</h3>' + list(current.errors.map(function (e) { return e.message; })) + '</div>';
          status.textContent = 'The comparison was not calculated. ' + current.errors.length + (current.errors.length === 1 ? ' input needs' : ' inputs need') + ' attention.';
          if (focus && current.errors[0] && form.elements[current.errors[0].key]) form.elements[current.errors[0].key].focus();
          return;
        }
        if (current.empty) {
          output.innerHTML = '<p class="decision-error">No verified plans are available for this comparison yet. Use the source-linked plan reference below.</p>';
          status.textContent = 'No plan estimate is available.'; return;
        }
        var sources = sourcesMap(data), fits = current.plans.filter(function (p) { return p.fit === 'eligible'; }).length;
        var html = '<div class="decision-math"><h3>Your calculated usage</h3>' + current.metricNotes.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>';
        html += '<p class="decision-result-intro">' + (fits ? count(fits) + ' reviewed ' + (fits === 1 ? 'plan meets' : 'plans meet') + ' the capacity and feature checks below.' : 'No reviewed plan has a fully verified fit for these inputs. Check the limits and unknowns below.') + ' This is a requirements check, not a quality ranking.</p><div class="decision-plan-results">';
        current.plans.forEach(function (p) {
          html += '<article class="decision-plan decision-' + esc(p.fit) + '"><div class="decision-plan-heading"><h4>' + esc(p.toolName) + ' <span>' + esc(p.name) + '</span></h4><span class="decision-fit">' + esc(fitLabel(p.fit)) + '</span></div>';
          html += '<dl class="decision-costs"><div><dt>' + (p.cost.incomplete ? 'Base price · pay monthly' : 'Pay monthly') + '</dt><dd>' + (number(p.cost.monthly) ? esc(money(p.cost.monthly, p.cost.currency)) + '<small>per month</small>' : '<span class="decision-unknown">Not verified</span>') + '</dd></div><div><dt>' + (p.cost.incomplete ? 'Base price · pay for a full year' : 'Pay for a full year') + '</dt><dd>' + (p.cost.annualAvailable === false ? '<span class="decision-unknown">No annual plan</span>' : number(p.cost.annualTotal) ? esc(money(p.cost.annualTotal, p.cost.currency)) + '<small>upfront · ' + esc(money(p.cost.annualEquivalent, p.cost.currency)) + ' / month equivalent</small>' : '<span class="decision-unknown">Not verified</span>') + '</dd></div></dl>';
          if (p.cost.quantity > 1) html += '<p class="decision-price-units">Total for ' + esc(count(p.cost.quantity)) + ' ' + esc(p.cost.billingUnit) + (p.cost.quantity === 1 ? '' : 's') + '.</p>';
          var reasons = p.failed.concat(p.unknown, p.cost.reasons);
          if (reasons.length) html += '<div class="decision-reasons">' + list(reasons) + '</div>';
          if (p.passed.length) html += '<details class="decision-plan-detail"><summary>See the checked allowances</summary>' + list(p.passed) + '</details>';
          var notes = typeof p.notes === 'string' ? [p.notes] : p.notes;
          if (p.scope) html += '<p class="decision-scope">' + esc(p.scope) + '</p>';
          if (notes.length) html += '<div class="decision-plan-notes">' + list(notes) + '</div>';
          html += '<div class="decision-plan-sources">' + p.sourceIds.map(function (id) { var s = sources[id]; return s && safeUrl(s.url) ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title || s.publisher || 'Official source') + ' ↗</a>' : ''; }).join('') + '</div></article>';
        });
        output.innerHTML = html + '</div>';
        status.textContent = 'Comparison updated. ' + fits + ' of ' + current.plans.length + ' reviewed plans meet the checked requirements.';
        if (focus) output.focus({ preventScroll: true });
      }
      form.addEventListener('submit', function (event) { event.preventDefault(); render(true); });
      form.addEventListener('input', function () {
        current = null; exportActions.hidden = true; manualCopy.hidden = true;
        output.innerHTML = '<p class="decision-pending">Your inputs have changed. Select “Check plans for my needs” to update the result.</p>';
        status.textContent = 'Inputs changed. Update your comparison.';
      });
      form.addEventListener('reset', function () { setTimeout(function () { render(false); status.textContent = 'Example inputs restored. ' + status.textContent; }, 0); });
      container.querySelector('[data-decision-copy]').addEventListener('click', async function () {
        if (!current || !current.valid) return;
        var text = summaryText(current, comparison, data);
        try { await navigator.clipboard.writeText(text); status.textContent = 'Decision summary copied.'; }
        catch (_) { manualCopy.value = text; manualCopy.hidden = false; manualCopy.focus(); manualCopy.select(); status.textContent = 'Copy is unavailable here. The summary is selected below; use your device’s copy command.'; }
      });
      container.querySelector('[data-decision-download]').addEventListener('click', function () {
        if (!current || !current.valid) return;
        var link = doc.createElement('a'), url = URL.createObjectURL(new Blob([summaryText(current, comparison, data)], { type: 'text/plain;charset=utf-8' }));
        link.href = url; link.download = comparison.id + '-decision-summary.txt'; doc.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        status.textContent = 'Decision summary downloaded.';
      });
      container.querySelector('[data-decision-print]').addEventListener('click', function () { window.print(); });
      container.dataset.decisionReady = 'true';
      container.classList.add('decision-ready');
      container.querySelector('.decision-reference').removeAttribute('open');
      form.hidden = false; output.hidden = false;
      render(false);
    });
  }
  return { fields: fields, defaults: defaults, validateInputs: validateInputs, deriveMetrics: deriveMetrics, limitValue: limitValue, pricePlan: pricePlan, evaluatePlan: evaluatePlan, evaluateComparison: evaluateComparison, summaryText: summaryText, money: money, mount: mount };
}));
