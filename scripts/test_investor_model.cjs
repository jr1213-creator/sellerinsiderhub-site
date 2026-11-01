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

test('all audience presets preserve the same operating structure instead of imposing hiring costs', () => {
  const presets = Object.values(model.PRESETS);
  assert.ok(presets.some(p => p.inputs.monthlyVisits >= 250000));
  for (const preset of presets) {
    assert.equal(preset.inputs.fixedMonthlyCosts, model.DEFAULTS.fixedMonthlyCosts);
    assert.equal(preset.inputs.monthlyMarketingSpend, 0);
    assert.equal(preset.inputs.setupCost, 0);
  }
});

test('lean cost integration replaces generic fixed costs and separates founder compensation from overhead', () => {
  const r = simulate({fixedMonthlyCosts: 99999, setupCost: 10,
    costConfig: {domainAnnual: 12, aiToolsMonthly: 0, aiApiMonthly: 0, founderPayMonthly: 20,
      hosting: {planMonthly: 9, creditsPerGB: 0, creditsPer10kRequests: 0, deploysMonthly: 0}}});
  assert.deepEqual(column(r, 'coreOperatingCosts'), [10, 10, 10]);
  assert.deepEqual(column(r, 'founderPay'), [20, 20, 20]);
  assert.deepEqual(column(r, 'beforeFounderResult'), [10, 50, 80]);
  assert.deepEqual(column(r, 'afterFounderResult'), [-10, 30, 60]);
  assert.deepEqual(column(r, 'totalCosts'), [40, 30, 30]);
  assert.equal(r.totals.beforeFounderResult - r.totals.afterFounderResult, 60);
  assert.equal(r.totals.founderPay, 60);
  assert.equal(r.breakEven.operatingMonth, 2);
  assert.equal(r.beforeFounderBreakEven.operatingMonth, 1);
  assert.equal(r.totals.employeePayroll, 0);
});

test('hosting costs follow month-level traffic without automatic employee expense', () => {
  const r = simulate({months: 3, monthlyVisits: 10000, trafficGrowthPct: 100,
    costConfig: {pageviewsPerVisit: 2, megabytesPerPage: 0.5, nonVisitorUsagePct: 20}});
  assert.deepEqual(column(r, 'visits'), [10000, 20000, 40000]);
  assert.deepEqual(column(r, 'hostingCost'), [9, 9, 14]);
  assert.ok(column(r, 'employeePayroll').every(x => x === 0));
  assert.equal(r.months[0].fixedCoreCosts, r.months[2].fixedCoreCosts);
});

test('all 47 catalog-sized allocations consume one referral pool and reconcile program totals', () => {
  const programs = Array.from({length: 47}, (_, index) => ({id: 'program-' + index, sharePct: 100 / 47}));
  const r = simulate({programs});
  close(r.totals.newApprovedCustomers, 3);
  close(r.totals.earnedCommission, 180);
  assert.equal(r.programTotals.length, 47);
  for (const key of ['newApprovedCustomers', 'earnedCommission', 'newCommission', 'renewalCommission',
    'cashReceived', 'unpaidCommission', 'payoutHeldCommission', 'laggedCommission', 'activeCommissionableCustomers']) {
    close(r.programTotals.reduce((sum, p) => sum + p[key], 0), r.totals[key], key);
  }
});

test('a per-customer commission cap limits each surviving referral, including the partial final payment', () => {
  const r = simulate({months: 4, monthlyPrice: 200, commissionPct: 30, commissionCapPerCustomer: 100});
  assert.deepEqual(r.cohorts[0].monthlyEarned, [60, 40, 0, 0]);
  assert.deepEqual(column(r, 'earnedCommission'), [60, 100, 100, 100]);
  assert.deepEqual(column(r, 'activeCommissionableCustomers'), [1, 2, 2, 2]);
  const churn = simulate({months: 3, monthlyPrice: 200, commissionPct: 30, churnPct: 50, commissionCapPerCustomer: 100});
  assert.deepEqual(churn.cohorts[0].monthlyEarned, [60, 20, 0]);
});

test('browser cost integration is equivalent to the Node engine when both modules are loaded in order', () => {
  const context = {};
  for (const file of ['investor-costs.js', 'investor-model.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site-assets/' + file), 'utf8'), context);
  }
  const inputs = {...base, costConfig: {founderPayMonthly: 20}};
  close(context.SIHInvestorModel.simulate(inputs).totals.operatingResult, model.simulate(inputs).totals.operatingResult);
});

test('annual commission caps reset at calendar boundaries and separate capped commissions from reversals', () => {
  const r = simulate({months: 14, commissionType: 'one-time', oneTimeCommission: 200,
    annualCommissionCap: 500, payoutDelayMonths: 1});
  assert.deepEqual(column(r, 'earnedCommission'), [200, 200, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200, 200]);
  assert.equal(r.totals.earnedCommission, 900);
  assert.equal(r.totals.capLimitedCommission, 1900);
  assert.equal(r.totals.reversedCommission, 0);
  assert.equal(r.totals.cashReceived, 700);
  assert.equal(r.totals.unpaidCommission, 200);
  close(r.programTotals[0].capLimitedCommission, 1900);
  close(r.cohorts.reduce((sum, c) => sum + c.cumulativeEarnedCommission, 0), r.totals.earnedCommission);
  const november = simulate({months: 6, startingCalendarMonth: 11, commissionType: 'one-time', oneTimeCommission: 200, annualCommissionCap: 500});
  assert.deepEqual(column(november, 'earnedCommission'), [200, 200, 200, 200, 100, 0]);
});

test('annual caps apply after reversal assumptions and preserve each cohort contribution', () => {
  const r = simulate({months: 6, reversalPct: 20, annualCommissionCap: 100});
  assert.deepEqual(column(r, 'earnedCommission'), [24, 48, 28, 0, 0, 0]);
  close(r.totals.grossCommission - r.totals.reversedCommission - r.totals.capLimitedCommission, r.totals.earnedCommission);
  close(r.totals.newCommission + r.totals.renewalCommission, r.totals.earnedCommission);
  for (let month = 0; month < r.months.length; month++) {
    close(r.cohorts.reduce((sum, c) => sum + c.monthlyEarned[month], 0), r.months[month].earnedCommission);
  }
});

test('the multi-month simulator spends carried hosting credits before buying more packs', () => {
  const r = simulate({months: 6, costConfig: {hosting: {creditsPerGB: 0, creditsPer10kRequests: 0,
    creditsPerDeploy: 100, deploysMonthly: 11}}});
  assert.deepEqual(column(r, 'hostingCost'), [14, 9, 9, 9, 9, 14]);
  assert.equal(r.months[0].costDetails.creditCarryOut, 400);
  assert.equal(r.months[4].costDetails.creditCarryOut, 0);
});

test('one buyer can acquire three different affiliate tools without becoming three buyer businesses', () => {
  const programs = ['a', 'b', 'c'].map(id => ({id, sharePct: 100 / 3}));
  const r = simulate({programs, paidToolsPerBusiness: 3});
  assert.deepEqual(column(r, 'newBuyerBusinesses'), [1, 1, 1]);
  assert.deepEqual(column(r, 'firstToolReferrals'), [1, 1, 1]);
  assert.deepEqual(column(r, 'stackExpansionReferrals'), [2, 2, 2]);
  assert.deepEqual(column(r, 'grossPaidSubscriptions'), [3, 3, 3]);
  assert.deepEqual(column(r, 'newApprovedSubscriptions'), [3, 3, 3]);
  assert.deepEqual(column(r, 'earnedCommission'), [90, 180, 270]);
  assert.equal(r.totals.newBuyerBusinesses, 3);
  assert.equal(r.totals.newApprovedSubscriptions, 9);
  assert.equal(r.totals.activeCommissionableCustomers, 9);
  assert.ok(r.programTotals.every(p => p.adoptionRatePerBusiness === 1));
});

test('a two-month stack expansion delay starts additional commission cohorts only when each tool is acquired', () => {
  const programs = ['a', 'b', 'c'].map(id => ({id, sharePct: 100 / 3}));
  const r = simulate({months: 4, programs, paidToolsPerBusiness: 3, stackExpansionDelayMonths: 2});
  assert.deepEqual(column(r, 'newBuyerBusinesses'), [1, 1, 1, 1]);
  assert.deepEqual(column(r, 'stackExpansionReferrals'), [0, 0, 2, 2]);
  assert.deepEqual(column(r, 'grossPaidSubscriptions'), [1, 1, 3, 3]);
  for (const [i, expected] of [30, 60, 150, 240].entries()) close(r.months[i].earnedCommission, expected);
  close(r.totals.grossPaidSubscriptions, 8);
  close(r.totals.pendingStackExpansionReferrals, 4);
  close(r.totals.grossPaidSubscriptions + r.totals.pendingStackExpansionReferrals,
    r.totals.newBuyerBusinesses * 3);
});

test('high first-tool weights are capped at one account per program and expansion is redistributed', () => {
  const programs = [{id: 'a', sharePct: 90}, {id: 'b', sharePct: 5}, {id: 'c', sharePct: 5}];
  const allocation = model.allocateStack(programs, 2);
  assert.deepEqual(allocation.map(p => p.adoptionRatePerBusiness), [1, 0.5, 0.5]);
  close(allocation[0].expansionRatePerBusiness, 0.1);
  assert.deepEqual(allocation.slice(1).map(p => p.expansionRatePerBusiness), [0.45, 0.45]);
  assert.deepEqual(allocation.map(p => p.stackSharePct), [50, 25, 25]);
  const r = simulate({programs, paidToolsPerBusiness: 2});
  assert.deepEqual(r.months[0].programs.map(p => p.grossPaidSubscriptions), [1, 0.5, 0.5]);
  assert.deepEqual(r.months[0].programs.map(p => p.realizedReferralSharePct), [50, 25, 25]);
  close(r.totals.grossPaidSubscriptions, 6);
});

test('fractional average stack sizes conserve adoption and keep every program below one account per business', () => {
  const programs = [{id: 'a', sharePct: 70}, {id: 'b', sharePct: 20}, {id: 'c', sharePct: 10}, {id: 'unused', sharePct: 0}];
  for (const size of [1, 1.25, 2, 2.5, 3]) {
    const allocation = model.allocateStack(programs, size);
    close(allocation.reduce((sum, p) => sum + p.adoptionRatePerBusiness, 0), size);
    close(allocation.reduce((sum, p) => sum + p.expansionRatePerBusiness, 0), size - 1);
    assert.ok(allocation.every(p => p.adoptionRatePerBusiness <= 1 && p.adoptionRatePerBusiness >= p.firstToolSharePct / 100));
    assert.equal(allocation[3].adoptionRatePerBusiness, 0);
  }
});

test('one-tool mode preserves the original single-referral arithmetic even when an expansion delay is entered', () => {
  const programs = [{id: 'a', sharePct: 50}, {id: 'b', sharePct: 50, commissionType: 'one-time', oneTimeCommission: 200}];
  const implicit = simulate({programs});
  const explicit = simulate({programs, paidToolsPerBusiness: 1, stackExpansionDelayMonths: 2});
  assert.deepEqual(column(implicit, 'earnedCommission'), [115, 130, 145]);
  assert.deepEqual(explicit.months, implicit.months);
  assert.equal(explicit.totals.pendingStackExpansionReferrals, 0);
});

test('stack expansion can continue after new acquisition stops, without inventing more buyer businesses', () => {
  const programs = [{id: 'a', sharePct: 50}, {id: 'b', sharePct: 50}];
  const r = simulate({programs, trafficGrowthPct: -100, paidToolsPerBusiness: 2, stackExpansionDelayMonths: 2});
  assert.deepEqual(column(r, 'newBuyerBusinesses'), [1, 0, 0]);
  assert.deepEqual(column(r, 'grossPaidSubscriptions'), [1, 0, 1]);
  assert.deepEqual(column(r, 'earnedCommission'), [30, 30, 60]);
  assert.equal(r.totals.newBuyerBusinesses, 1);
  assert.equal(r.totals.grossPaidSubscriptions, 2);
});

test('invalid stack sizes, unavailable distinct programs, and fractional expansion delays are rejected', () => {
  const programs = [{id: 'a', sharePct: 50}, {id: 'b', sharePct: 50}, {id: 'zero', sharePct: 0}];
  for (const overrides of [{paidToolsPerBusiness: 0.9}, {paidToolsPerBusiness: 2.1},
    {paidToolsPerBusiness: NaN}, {paidToolsPerBusiness: '2'}, {stackExpansionDelayMonths: -1},
    {stackExpansionDelayMonths: 0.5}]) assert.throws(() => simulate({programs, ...overrides}));
  assert.throws(() => simulate({paidToolsPerBusiness: 2}), /cannot exceed/);
});
