'use strict';

// Business invariants and independently worked examples, without a browser.
const assert = require('node:assert/strict');
const test = require('node:test');
const math = require('../site-assets/hub.js');

function close(actual, expected, label) {
  assert.ok(Number.isFinite(actual), label + ' must be finite');
  const tolerance = Math.max(1, Math.abs(expected)) * 1e-10;
  assert.ok(Math.abs(actual - expected) <= tolerance,
    label + ': expected ' + expected + ', received ' + actual);
}

const automationBase = {hours: 5, rate: 30, monthly: 20, setup: 240, months: 12};
const storefrontBase = {aov: 50, margin: 50, processing: 3, perorder: 2, fixed: 91, setup: 180, months: 6};

test('automation converts a full 52-week year into monthly hours and charges setup once', () => {
  const result = math.automation(automationBase);
  close(result.hoursMonth, 21.666666666666668, 'monthly hours');
  close(result.value, 650, 'monthly time value');
  close(result.cost, 40, 'monthly allocated cost');
  close(result.net, 610, 'monthly net time value');
  close(result.annualNet, 7320, 'first-year net time value');
  close(result.breakEvenHours, 1.3333333333333333, 'monthly break-even hours');
});

test('automation first-year setup is not charged repeatedly when allocation is shorter than a year', () => {
  const result = math.automation({hours: 3, rate: 40, monthly: 10, setup: 360, months: 3});
  close(result.value, 520, 'monthly time value');
  close(result.net, 390, 'net during setup allocation');
  close(result.annualNet, 5760, 'year value less twelve subscriptions and one setup');
  assert.notEqual(result.annualNet, result.net * 12, 'allocation must not become four setup payments');
});

test('zero hourly value returns a loss and no finite break-even rather than Infinity', () => {
  const result = math.automation({hours: 2, rate: 0, monthly: 30, setup: 120, months: 6});
  close(result.net, -50, 'monthly cost with no valued time');
  close(result.annualNet, -480, 'annual costs');
  assert.equal(result.breakEvenHours, null);
});

test('zero saved hours and genuine zero costs stay valid', () => {
  const result = math.automation({hours: 0, rate: 0, monthly: 0, setup: 0, months: 1});
  close(result.hoursMonth, 0, 'monthly hours');
  close(result.net, 0, 'monthly net');
  close(result.annualNet, 0, 'annual net');
  assert.equal(result.breakEvenHours, null);
});

test('automation rejects negative, missing, nonnumeric, and zero-period inputs', () => {
  for (const field of ['hours', 'rate', 'monthly', 'setup', 'months']) {
    assert.throws(() => math.automation({...automationBase, [field]: -1}), field + ' cannot be negative');
    assert.throws(() => math.automation({...automationBase, [field]: NaN}), field + ' cannot be unknown');
  }
  assert.throws(() => math.automation({...automationBase, months: 0}));
  assert.throws(() => math.automation({...automationBase, hours: ''}));
  assert.throws(() => math.automation({...automationBase, rate: Infinity}));
  assert.throws(() => math.automation({...automationBase, setup: undefined}));
});

test('storefront subtracts processing and per-order costs before rounding required orders up', () => {
  const result = math.storefront(storefrontBase);
  close(result.contribution, 21.5, 'contribution per order');
  close(result.cost, 121, 'monthly cost to recover');
  assert.equal(result.orders, 6);
  assert.ok(5 * result.contribution < result.cost, 'five orders cannot cover these costs');
  assert.ok(6 * result.contribution >= result.cost, 'six orders cover these costs');
});

test('storefront rounds up an incomplete order but not an exact whole-order result', () => {
  const exact = {aov: 10, margin: 50, processing: 0, perorder: 0, fixed: 10, setup: 0, months: 12};
  assert.equal(math.storefront(exact).orders, 2);
  assert.equal(math.storefront({...exact, fixed: 10.01}).orders, 3);
  assert.equal(math.storefront({...exact, fixed: 0}).orders, 0);
});

test('storefront does not invent an eighth order because seven cents divided by one cent has binary noise', () => {
  const result = math.storefront({
    aov: 1, margin: 1, processing: 0, perorder: 0, fixed: 0.07, setup: 0, months: 12,
  });
  close(result.contribution, 0.01, 'one-cent contribution');
  assert.equal(result.orders, 7, 'seven one-cent contributions cover exactly seven cents');
});

test('storefront returns no break-even when contribution is zero or negative', () => {
  const zero = math.storefront({aov: 100, margin: 5, processing: 3, perorder: 2, fixed: 90, setup: 0, months: 12});
  close(zero.contribution, 0, 'zero contribution');
  assert.equal(zero.orders, null);
  const negative = math.storefront({aov: 50, margin: 2, processing: 3, perorder: 1, fixed: 20, setup: 0, months: 12});
  close(negative.contribution, -1.5, 'negative contribution');
  assert.equal(negative.orders, null);
});

test('storefront rejects invalid percentages, nonpositive order value/period, and unknown costs', () => {
  for (const field of ['margin', 'processing', 'perorder', 'fixed', 'setup']) {
    assert.throws(() => math.storefront({...storefrontBase, [field]: -1}), field + ' cannot be negative');
  }
  assert.throws(() => math.storefront({...storefrontBase, margin: 101}));
  assert.throws(() => math.storefront({...storefrontBase, processing: 101}));
  assert.throws(() => math.storefront({...storefrontBase, aov: 0}));
  assert.throws(() => math.storefront({...storefrontBase, months: 0}));
  assert.throws(() => math.storefront({...storefrontBase, fixed: NaN}));
  assert.throws(() => math.storefront({...storefrontBase, margin: ''}));
  assert.throws(() => math.storefront({...storefrontBase, aov: Infinity}));
});

test('subscription costs distinguish annual per-seat billing from monthly equivalents', () => {
  const result = math.subscriptions([
    {cost: 240, quantity: 3, cycle: 'annual'},
    {cost: 15, quantity: 2, cycle: 'monthly'},
  ], 100);
  close(result.monthly, 90, 'monthly equivalent');
  close(result.annual, 1080, 'annual equivalent');
  close(result.annualUpfront, 720, 'annual-billed commitments');
  close(result.remaining, 10, 'monthly budget remaining');
});

test('subscription over-budget amounts stay negative and true free plans stay zero', () => {
  close(math.subscriptions([{cost: 10, quantity: 2, cycle: 'monthly'}], 5).remaining, -15, 'over budget');
  const free = math.subscriptions([{cost: 0, quantity: 1, cycle: 'annual'}], 0);
  for (const field of ['monthly', 'annual', 'annualUpfront', 'remaining']) {
    close(free[field], 0, field);
  }
});

test('subscription blank or NaN prices are rejected rather than silently treated as free', () => {
  for (const cost of ['', null, undefined, NaN, Infinity, -1]) {
    assert.throws(() => math.subscriptions([{cost, quantity: 1, cycle: 'monthly'}], 100), String(cost));
  }
  assert.throws(() => math.subscriptions([], 100));
});

test('subscription inputs require a valid quantity, billing cycle, and numeric nonnegative budget', () => {
  for (const quantity of [0, -1, NaN, Infinity, '']) {
    assert.throws(() => math.subscriptions([{cost: 20, quantity, cycle: 'monthly'}], 100));
  }
  assert.throws(() => math.subscriptions([{cost: 20, quantity: 1, cycle: 'weekly'}], 100));
  for (const budget of [-1, '', null, NaN, Infinity]) {
    assert.throws(() => math.subscriptions([{cost: 20, quantity: 1, cycle: 'monthly'}], budget));
  }
});
