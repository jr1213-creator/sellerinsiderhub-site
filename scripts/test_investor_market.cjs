'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const market = require('../site-assets/investor-market.js');
const model = require('../site-assets/investor-model.js');
const base = {months: 24, monthlyVisits: 999999, maxMonthlyVisits: 10, trafficGrowthPct: 20,
  merchantClickPct: 10, clickToPaidPct: 10, approvalPct: 100, reversalPct: 0,
  monthlyPrice: 100, commissionPct: 30, churnPct: 0, commissionMonths: 0,
  payoutDelayMonths: 0, payoutMinimum: 0, payoutMinimumCustomers: 0,
  fixedMonthlyCosts: 0, monthlyMarketingSpend: 0, paidTrafficPct: 0, costPerPaidVisit: 0,
  setupCost: 0, startingCash: 0, paidToolsPerBusiness: 1, stackExpansionDelayMonths: 0,
  commissionType: 'recurring', oneTimeCommission: 25};
const population = {broadBusinesses: 1200, addressablePct: 50, annualBuyerPct: 50, annualCapturePct: 10};
function close(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), 'expected ' + expected + ', got ' + actual);
}

test('market percentages conserve distinct businesses and derive traffic without a legacy traffic ceiling', () => {
  const r = market.evaluate(population, base);
  assert.equal(r.market.addressableBusinesses, 600);
  assert.equal(r.market.annualBuyerBusinesses, 300);
  assert.equal(r.annualNewBusinesses, 30);
  assert.equal(r.monthlyNewBusinesses, 2.5);
  close(r.monthlyVisitsRequired, 250);
  close(r.cumulativeUniqueBusinesses, 60);
  close(r.stockUtilizationPct, 10);
  close(r.broadBaseAnnualSharePct, 2.5);
  close(r.buyerPoolAnnualSharePct, 10);
  assert.equal(r.assumptions.trafficGrowthPct, 0);
  close(r.assumptions.maxMonthlyVisits, 250);
});

test('final-year earned commission sums twelve actual model months rather than annualizing the exit month', () => {
  const r = market.evaluate(population, base);
  assert.deepEqual(r.annualPeriod, {startMonth: 13, endMonth: 24, months: 12});
  close(r.final12Months.earnedCommission, 16650);
  close(r.finalMonthEarnedCommission, 1800);
  close(r.annualizedExitRunRate, 21600);
  close(r.final12Months.newBuyerBusinesses, 30);
});

test('several tools increase subscription accounts without multiplying the market business denominator', () => {
  const programs = ['a', 'b', 'c'].map(id => ({id, sharePct: 100 / 3}));
  const r = market.evaluate(population, {...base, programs, paidToolsPerBusiness: 3});
  close(r.final12Months.newBuyerBusinesses, 30);
  close(r.final12Months.newApprovedSubscriptions, 90);
  close(r.final12Months.grossPaidSubscriptions, 90);
  close(r.cumulativeUniqueBusinesses, 60);
  close(r.final12Months.earnedCommission, 49950);
  assert.ok(r.assumptions.programs.every(p => p.adoptionRatePerBusiness === 1));
});

test('annual market capture cannot recycle the same business beyond the addressable stock', () => {
  assert.throws(() => market.evaluate({broadBusinesses: 1200, annualCapturePct: 50}, {...base, months: 36}), /more unique businesses/);
  const limit = market.evaluate({broadBusinesses: 1200, annualCapturePct: 100 / 3}, {...base, months: 36});
  close(limit.cumulativeUniqueBusinesses, 1200);
  const ladder = market.shareLadder({broadBusinesses: 1200}, {...base, months: 36}, [1, 50, 100]);
  assert.equal(ladder[0].feasible, true);
  assert.equal(ladder[1].feasible, false);
  assert.equal(ladder[2].feasible, false);
});

test('zero denominators and zero conversion rates are handled without NaN or infinite visitor requirements', () => {
  const zero = market.evaluate({broadBusinesses: 0}, {...base, merchantClickPct: 0});
  assert.equal(zero.annualNewBusinesses, 0);
  assert.equal(zero.monthlyVisitsRequired, 0);
  assert.equal(zero.broadBaseAnnualSharePct, null);
  assert.equal(zero.buyerPoolAnnualSharePct, null);
  assert.equal(zero.final12Months.earnedCommission, 0);
  assert.throws(() => market.evaluate(population, {...base, clickToPaidPct: 0}), /positive vendor-click/);
  assert.equal(market.solveTargets(population, {...base, clickToPaidPct: 0}, [1000])[0].feasible, false);
});

test('growth acquisition, founder compensation and operating allowance are explicit additive costs', () => {
  const r = market.evaluate({...population, acquisitionCostPerNewBusiness: 1000,
    founderPayAnnual: 24000, otherOperatingAllowanceAnnual: 1200},
    {...base, fixedMonthlyCosts: 2, monthlyMarketingSpend: 10, paidTrafficPct: 50, costPerPaidVisit: 0.1});
  close(r.final12Months.marketAcquisitionAllowance, 30000);
  close(r.final12Months.marketingCost, 30270);
  close(r.final12Months.paidAcquisitionCost, 150);
  close(r.final12Months.coreOperatingCosts, 1224);
  close(r.final12Months.otherOperatingAllowance, 1200);
  close(r.final12Months.founderPay, 24000);
  close(r.final12Months.totalCosts, 55494);
  close(r.final12Months.afterFounderResult, 16650 - 55494);
  assert.equal(r.final12Months.employeePayroll, 0);
});

test('target search finds required share and respects a narrowed annual buyer pool', () => {
  const found = market.solveTargets(population, base, [16650])[0];
  assert.equal(found.feasible, true);
  close(found.requiredAnnualCapturePct, 10, 1e-5);
  assert.ok(found.final12Months.earnedCommission >= 16650);
  assert.ok(found.final12Months.earnedCommission < 16650.01);
  const restricted = market.solveTargets({...population, annualBuyerPct: 10}, base, [50000])[0];
  assert.equal(restricted.feasible, false);
  close(restricted.maximumAnnualCommission, 33300);
});

test('annual affiliate caps constrain high-end targets instead of scaling commissions without limit', () => {
  const capped = {...base, commissionType: 'one-time', oneTimeCommission: 25, annualCommissionCap: 100000};
  const targets = market.solveTargets({broadBusinesses: 36207130}, capped, [50000, 1000000]);
  assert.equal(targets[0].feasible, true);
  close(targets[0].final12Months.earnedCommission, 50000, 1e-6);
  assert.equal(targets[1].feasible, false);
  close(targets[1].maximumAnnualCommission, 100000);
  const offset = market.solveTargets({broadBusinesses: 36207130}, {...capped, months: 18}, [1000])[0];
  assert.equal(offset.feasible, false);
  assert.match(offset.reason, /ending in December/);
});

test('nine-figure annual revenue can be evaluated without an arbitrary small visitor ceiling', () => {
  const programs = ['a', 'b', 'c'].map(id => ({id, sharePct: 100 / 3}));
  const r = market.solveTargets({}, {...base, months: 36, merchantClickPct: 10, clickToPaidPct: 2.5,
    programs, paidToolsPerBusiness: 3, stackExpansionDelayMonths: 2, commissionMonths: 12}, [100000000])[0];
  assert.equal(r.feasible, true);
  assert.ok(r.monthlyVisitsRequired > 1000000);
  assert.ok(r.final12Months.earnedCommission >= 100000000);
  assert.ok(r.final12Months.earnedCommission < 100000002);
  assert.ok(r.cumulativeUniqueBusinesses <= 36207130);
});

test('inputs remain immutable and invalid market percentages, costs, and short horizons are rejected', () => {
  const a = {...population}, b = {...base}, before = JSON.stringify({a, b});
  market.evaluate(a, b);
  assert.equal(JSON.stringify({a, b}), before);
  for (const c of [null, [], {addressablePct: 101}, {annualBuyerPct: -1},
    {annualCapturePct: NaN}, {acquisitionCostPerNewBusiness: -1}, {founderPayAnnual: Infinity}]) {
    assert.throws(() => market.evaluate(c, base));
  }
  assert.throws(() => market.evaluate(population, {...base, months: 6}));
});

test('browser UMD works with the existing modules and matches Node arithmetic', () => {
  const context = {};
  for (const file of ['investor-costs.js', 'investor-model.js', 'investor-market.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site-assets/' + file), 'utf8'), context);
  }
  close(context.SIHInvestorMarket.evaluate(population, base).final12Months.earnedCommission,
    market.evaluate(population, base).final12Months.earnedCommission);
});
