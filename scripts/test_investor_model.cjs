'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const model = require('../site-assets/investor-model.js');
const base = {
  months: 3, monthlyVisits: 100, trafficGrowthPct: 0, maxMonthlyVisits: 0,
  merchantClickPct: 10, clickToPaidPct: 10, approvalPct: 100, reversalPct: 0,
  monthlyPrice: 100, commissionPct: 30, churnPct: 0, commissionMonths: 0,
  payoutDelayMonths: 0, payoutMinimum: 0, payoutMinimumCustomers: 0,
  fixedMonthlyCosts: 0, monthlyMarketingSpend: 0, paidTrafficPct: 0,
  costPerPaidVisit: 0, setupCost: 0, startingCash: 0,
  commissionType: 'recurring', oneTimeCommission: 200
};
const simulate = overrides => model.simulate({...base, ...overrides});
function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)), (message || '') + ' expected ' + expected + ', got ' + actual);
}
function column(result, key) { return result.months.map(row => row[key]); }

test('one new customer per month builds three recurring cohorts with exact new/renewal split', () => {
  const r = simulate();
  assert.deepEqual(column(r, 'activeCommissionableCustomers'), [1, 2, 3]);
  assert.deepEqual(column(r, 'earnedCommission'), [30, 60, 90]);
  assert.deepEqual(column(r, 'newCommission'), [30, 30, 30]);
  assert.deepEqual(column(r, 'renewalCommission'), [0, 30, 60]);
  assert.equal(r.totals.earnedCommission, 180);
  assert.equal(r.totals.cashReceived, 180);
  assert.deepEqual(r.cohortMatrix.map(cohort => cohort.values), [[30, 30, 30], [0, 30, 30], [0, 0, 30]]);
});

test('churn begins after the first payment and preserves fractional expected customers', () => {
  const r = simulate({churnPct: 50});
  assert.deepEqual(column(r, 'activeCommissionableCustomers'), [1, 1.5, 1.75]);
  assert.deepEqual(column(r, 'churnedCustomers'), [0, 0.5, 0.75]);
  assert.deepEqual(column(r, 'earnedCommission'), [30, 45, 52.5]);
  close(r.cohorts[0].remainingCustomers, 0.25);
  close(r.totals.newApprovedCustomers - r.totals.churnedCustomers, r.totals.activeReferredCustomers);
});

test('two-month commission cap stops earnings exactly while the underlying subscriptions remain', () => {
  const r = simulate({months: 4, commissionMonths: 2});
  assert.deepEqual(column(r, 'activeCommissionableCustomers'), [1, 2, 2, 2]);
  assert.deepEqual(column(r, 'activeReferredCustomers'), [1, 2, 3, 4]);
  assert.deepEqual(column(r, 'expiredCustomers'), [0, 0, 1, 1]);
  assert.deepEqual(column(r, 'earnedCommission'), [30, 60, 60, 60]);
  assert.deepEqual(r.cohorts[0].monthlyEarned, [30, 30, 0, 0]);
  assert.equal(r.cohorts[0].commissionExpired, true);
});

test('churn and expiry are distinct: a surviving customer can lose commission eligibility', () => {
  const r = simulate({churnPct: 50, commissionMonths: 2});
  assert.deepEqual(column(r, 'activeCommissionableCustomers'), [1, 1.5, 1.5]);
  assert.deepEqual(column(r, 'activeReferredCustomers'), [1, 1.5, 1.75]);
  assert.deepEqual(column(r, 'expiredCustomers'), [0, 0, 0.25]);
  assert.deepEqual(column(r, 'earnedCommission'), [30, 45, 45]);
});

test('one-time commissions do not accumulate renewal commission or commissionable subscriptions', () => {
  const r = simulate({commissionType: 'one-time', oneTimeCommission: 200});
  assert.deepEqual(column(r, 'earnedCommission'), [200, 200, 200]);
  assert.deepEqual(column(r, 'renewalCommission'), [0, 0, 0]);
  assert.deepEqual(column(r, 'activeCommissionableCustomers'), [0, 0, 0]);
  assert.equal(r.totals.earnedCommission, 600);
  assert.deepEqual(r.cohorts[0].monthlyEarned, [200, 0, 0]);
});

test('approval reduces new customers; reversals reduce commissions without double-counting customer churn', () => {
  const r = simulate({approvalPct: 50, reversalPct: 20});
  assert.deepEqual(column(r, 'newApprovedCustomers'), [0.5, 0.5, 0.5]);
  assert.deepEqual(column(r, 'activeReferredCustomers'), [0.5, 1, 1.5]);
  assert.deepEqual(column(r, 'grossCommission'), [15, 30, 45]);
  assert.deepEqual(column(r, 'earnedCommission'), [12, 24, 36]);
  assert.equal(r.totals.reversedCommission, 18);
});

test('two-month payout lag separates accrual from cash without discarding unpaid commissions', () => {
  const r = simulate({months: 4, payoutDelayMonths: 2});
  assert.deepEqual(column(r, 'earnedCommission'), [30, 60, 90, 120]);
  assert.deepEqual(column(r, 'cashReceived'), [0, 0, 30, 60]);
  assert.equal(r.totals.unpaidCommission, 210);
  assert.equal(r.totals.laggedCommission, 210);
  assert.equal(r.totals.payoutHeldCommission, 0);
});

test('payout floor holds and aggregates small commissions; paid balances are not paid twice', () => {
  const r = simulate({months: 4, payoutMinimum: 100});
  assert.deepEqual(column(r, 'cashReceived'), [0, 0, 180, 120]);
  assert.equal(r.totals.cashReceived, 300);
  assert.equal(r.totals.unpaidCommission, 0);
});

test('minimum referral count waits for each referral’s delay before unlocking payout', () => {
  const r = simulate({payoutDelayMonths: 1, payoutMinimumCustomers: 2});
  assert.deepEqual(column(r, 'cashReceived'), [0, 0, 90]);
  assert.equal(r.totals.payoutHeldCommission, 0);
  assert.equal(r.totals.laggedCommission, 90);
});

test('fractional expected referrals stay below the minimum without rounding into an early payout', () => {
  const r = simulate({months: 3, approvalPct: 50, payoutMinimumCustomers: 2});
  assert.deepEqual(column(r, 'cashReceived'), [0, 0, 0]);
  assert.equal(r.totals.payoutHeldCommission, 90);
});

test('program shares allocate the same pool once and keep payout thresholds separate', () => {
  const r = simulate({programs: [
    {id: 'recurring', sharePct: 50, payoutMinimum: 100},
    {id: 'bounty', sharePct: 50, commissionType: 'one-time', oneTimeCommission: 200}
  ]});
  assert.deepEqual(column(r, 'newApprovedCustomers'), [1, 1, 1]);
  assert.deepEqual(column(r, 'earnedCommission'), [115, 130, 145]);
  assert.deepEqual(column(r, 'cashReceived'), [100, 100, 100]);
  assert.equal(r.totals.payoutHeldCommission, 90);
  assert.equal(r.totals.earnedCommission, 390);
});

test('traffic grows only to the specified cap, and a complete traffic loss does not erase old cohorts', () => {
  const capped = simulate({trafficGrowthPct: 100, maxMonthlyVisits: 250, months: 4});
  assert.deepEqual(column(capped, 'visits'), [100, 200, 250, 250]);
  const declineFromAboveCap = simulate({monthlyVisits: 400, trafficGrowthPct: -50, maxMonthlyVisits: 250});
  assert.deepEqual(column(declineFromAboveCap, 'visits'), [250, 200, 100]);
  const stopped = simulate({trafficGrowthPct: -100});
  assert.deepEqual(column(stopped, 'visits'), [100, 0, 0]);
  assert.deepEqual(column(stopped, 'earnedCommission'), [30, 30, 30]);
});

test('costs, setup, delayed cash, funding need, and first crossing months use different correct bases', () => {
  const r = simulate({months: 4, fixedMonthlyCosts: 10, monthlyMarketingSpend: 5,
    paidTrafficPct: 50, costPerPaidVisit: 0.1, setupCost: 40, startingCash: 50, payoutDelayMonths: 1});
  assert.deepEqual(column(r, 'totalCosts'), [60, 20, 20, 20]);
  assert.deepEqual(column(r, 'operatingResult'), [-30, 40, 70, 100]);
  assert.deepEqual(column(r, 'cashReceived'), [0, 30, 60, 90]);
  assert.deepEqual(column(r, 'cashBalance'), [-10, 0, 40, 110]);
  assert.deepEqual(r.breakEven, {operatingMonth: 2, cumulativeOperatingMonth: 2, cashFlowMonth: 2, cashRecoveryMonth: 4});
  assert.equal(r.totals.operatingResult, 180);
  assert.equal(r.totals.cashFlow, 60);
  assert.equal(r.totals.fundingRequired, 60);
  assert.equal(r.totals.additionalFundingRequired, 10);
  assert.equal(r.runway.firstNegativeCashMonth, 1);
  assert.equal(r.runway.monthsCovered, 0);
});

test('starting capital is never counted as profit or cash recovery', () => {
  const r = simulate({monthlyVisits: 0, fixedMonthlyCosts: 10, startingCash: 1000});
  assert.equal(r.totals.operatingResult, -30);
  assert.equal(r.totals.endingCashBalance, 970);
  assert.equal(r.breakEven.cashRecoveryMonth, null);
  assert.equal(r.runway.extendsBeyondHorizon, true);
});

test('zero activity stays finite without a fake break-even and 100% churn still allows the first payment', () => {
  const zero = simulate({monthlyVisits: 0});
  assert.equal(zero.totals.earnedCommission, 0);
  assert.ok(Object.values(zero.breakEven).every(x => x === null));
  const allChurn = simulate({churnPct: 100});
  assert.deepEqual(column(allChurn, 'earnedCommission'), [30, 30, 30]);
});

test('invalid numbers, fractional timing, incorrect mix shares and duplicated IDs are rejected', () => {
  for (const input of [null, false, 0, '', [], '100']) assert.throws(() => model.simulate(input));
  for (const overrides of [{months: 0}, {months: 2.5}, {monthlyVisits: -1}, {monthlyPrice: NaN},
    {trafficGrowthPct: -101}, {merchantClickPct: 101}, {approvalPct: '80'}, {churnPct: null},
    {payoutDelayMonths: 0.5}, {commissionMonths: -1}, {startingCash: Infinity},
    {programs: []}, {programs: [{id: 'a', sharePct: 99}]},
    {programs: [{id: 'a', sharePct: 50}, {id: 'a', sharePct: 50}]}, {commissionType: 'lifetime'}]) {
    assert.throws(() => simulate(overrides));
  }
});

test('presets/scenario helpers are reproducible, do not mutate inputs, and remain finite for requested horizons', () => {
  const snapshot = JSON.stringify(model.PRESETS);
  for (const key of Object.keys(model.PRESETS)) {
    for (const months of [12, 24, 36, 60]) {
      const original = {...model.PRESETS[key].inputs, months};
      const down = model.simulate(model.scenarioInputs(original, 'downside'));
      const normal = model.simulate(model.scenarioInputs(original, 'base'));
      const up = model.simulate(model.scenarioInputs(original, 'upside'));
      assert.ok(down.totals.earnedCommission <= normal.totals.earnedCommission);
      assert.ok(up.totals.earnedCommission >= normal.totals.earnedCommission);
      assert.ok(Object.values(normal.totals).every(Number.isFinite));
      close(normal.totals.earnedCommission, normal.totals.cashReceived + normal.totals.payoutHeldCommission + normal.totals.laggedCommission);
      close(normal.totals.newApprovedCustomers, normal.totals.activeReferredCustomers + normal.totals.churnedCustomers);
    }
  }
  assert.equal(JSON.stringify(model.PRESETS), snapshot);
});

test('browser global exposes the same engine without Node dependencies', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site-assets/investor-model.js'), 'utf8'), context);
  assert.equal(typeof context.SIHInvestorModel.simulate, 'function');
  const result = context.SIHInvestorModel.simulate(base);
  assert.equal(result.totals.earnedCommission, 180);
});
