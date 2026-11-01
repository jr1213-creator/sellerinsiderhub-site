'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const costs = require('../site-assets/investor-costs.js');

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8 * Math.max(1, Math.abs(expected)), 'expected ' + expected + ', got ' + actual);
}

test('default fixed costs reflect a solo technical founder with no employees or compulsory marketing', () => {
  const r = costs.evaluate({}, 1000);
  close(r.hostingCost, 9);
  close(r.fixedCoreCosts, 60 + 25 + 11.08 / 12);
  close(r.coreOperatingCosts, 9 + 60 + 25 + 11.08 / 12);
  assert.equal(r.employeePayroll, 0);
  assert.equal(r.founderPay, 0);
  assert.equal(r.aiSupportCost, 0);
  close(r.lineItems.reduce((sum, row) => sum + row.amount, 0), r.coreOperatingCosts);
});

test('bandwidth, requests, bot allowance and deployment charges have separate measurable drivers', () => {
  const r = costs.evaluate({}, 100000);
  assert.equal(r.pageviews, 200000);
  assert.equal(r.bandwidthGB, 120);
  assert.equal(r.webRequests, 1920000);
  assert.equal(r.bandwidthCredits, 2400);
  assert.equal(r.requestCredits, 384);
  assert.equal(r.deploymentCredits, 120);
  assert.equal(r.usageCredits, 2904);
  assert.equal(r.topupPacks, 4);
  assert.equal(r.hostingCost, 29);
});

test('high traffic changes infrastructure charges without adding staff or inflating fixed subscriptions', () => {
  const low = costs.evaluate({}, 1000);
  const high = costs.evaluate({hosting: costs.PLANS.pro}, 1000000);
  assert.equal(high.usageCredits, 27960);
  assert.equal(high.topupPacks, 17);
  assert.equal(high.hostingCost, 190);
  assert.equal(high.fixedCoreCosts, low.fixedCoreCosts);
  assert.equal(high.employeePayroll, 0);
  assert.equal(high.founderPay, 0);
});

test('credit top-ups use whole blocks without buying another block at an exact boundary', () => {
  const r = costs.evaluate({hosting: {creditsPerGB: 0, creditsPer10kRequests: 0, deploysMonthly: 100}}, 0);
  assert.equal(r.usageCredits, 1500);
  assert.equal(r.overageCredits, 500);
  assert.equal(r.topupPacks, 1);
  assert.equal(r.hostingCost, 14);
});

test('unused purchased credits carry forward while included monthly credits reset', () => {
  const config = {hosting: {creditsPerGB: 0, creditsPer10kRequests: 0, creditsPerDeploy: 100, deploysMonthly: 11}};
  const first = costs.evaluate(config, 0);
  assert.equal(first.hostingCost, 14);
  assert.equal(first.creditCarryOut, 400);
  const second = costs.evaluate(config, 0, first.creditCarryOut);
  assert.equal(second.hostingCost, 9);
  assert.equal(second.carriedCreditsUsed, 100);
  assert.equal(second.creditCarryOut, 300);
  const quiet = costs.evaluate({...config, hosting: {...config.hosting, deploysMonthly: 0}}, 0, second.creditCarryOut);
  assert.equal(quiet.creditCarryOut, 300);
  assert.equal(quiet.unusedCredits, 1300);
});

test('Free capacity exhaustion is flagged rather than pretending unlimited hosting is free', () => {
  const low = costs.evaluate({hosting: costs.PLANS.free}, 1000);
  const high = costs.evaluate({hosting: costs.PLANS.free}, 1000000);
  assert.equal(low.hostingCapacityExceeded, false);
  assert.equal(high.hostingCapacityExceeded, true);
  assert.equal(high.topupPacks, 0);
  assert.equal(high.hostingCost, 0);
});

test('optional AI support is driven by contacts, not by charging a model call for every static page view', () => {
  const r = costs.evaluate({supportContactsPer1000Visits: 2, supportCostPerContact: 0.05}, 1000000);
  assert.equal(r.supportContacts, 2000);
  assert.equal(r.aiSupportCost, 100);
  assert.equal(r.employeePayroll, 0);
});

test('allocated and incremental AI views do not double-count shared subscriptions', () => {
  const config = {aiToolsMonthly: 100, aiToolsAllocationPct: 30, aiIncrementalMonthly: 5};
  const allocated = costs.evaluate(config, 1000);
  const incremental = costs.evaluate({...config, costView: 'incremental'}, 1000);
  assert.equal(allocated.aiToolsCost, 30);
  assert.equal(incremental.aiToolsCost, 5);
  close(allocated.coreOperatingCosts - incremental.coreOperatingCosts, 25);
  assert.equal(allocated.allocatedCoreOperatingCosts, incremental.allocatedCoreOperatingCosts);
  assert.equal(allocated.incrementalCoreOperatingCosts, incremental.incrementalCoreOperatingCosts);
});

test('founder compensation is separate from core overhead and never silently inserted', () => {
  const a = costs.evaluate({}, 1000);
  const b = costs.evaluate({founderPayMonthly: 4000}, 1000);
  assert.equal(a.coreOperatingCosts, b.coreOperatingCosts);
  assert.equal(b.founderPay, 4000);
  assert.equal(b.totalWithFounderPay - b.totalBeforeFounderPay, 4000);
});

test('bad cost inputs are rejected instead of rendering misleading finite totals', () => {
  for (const config of [null, [], 'free', {domainAnnual: -1}, {aiToolsMonthly: NaN},
    {aiToolsAllocationPct: 101}, {costView: 'revenue'}, {hosting: null},
    {hosting: {canTopup: true, creditPackSize: 0}}, {hosting: {canTopup: 1}},
    {supportCostPerContact: Infinity}]) assert.throws(() => costs.evaluate(config, 1000));
  assert.throws(() => costs.evaluate({}, -1));
});

test('browser cost global produces the same arithmetic without external dependencies', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site-assets/investor-costs.js'), 'utf8'), context);
  assert.equal(context.SIHInvestorCosts.evaluate({}, 100000).hostingCost, 29);
});
