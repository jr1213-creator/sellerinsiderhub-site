/* Expected-value affiliate cohort model. No requests, storage, or dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SIHInvestorModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = Object.freeze({
    months: 36, monthlyVisits: 1000, trafficGrowthPct: 3, maxMonthlyVisits: 10000,
    merchantClickPct: 8, clickToPaidPct: 2, approvalPct: 80, reversalPct: 5,
    monthlyPrice: 100, commissionPct: 30, churnPct: 5, commissionMonths: 12,
    payoutDelayMonths: 2, payoutMinimum: 0, payoutMinimumCustomers: 0,
    commissionType: 'recurring', oneTimeCommission: 200,
    fixedMonthlyCosts: 350, monthlyMarketingSpend: 150,
    paidTrafficPct: 0, costPerPaidVisit: 0, setupCost: 500, startingCash: 2000
  });
  const PRESETS = Object.freeze({
    early_audience: {
      label: 'Foundation',
      description: 'Illustrative early audience, with 1,000 initial monthly visits and $500 in monthly operating and marketing costs. These are assumptions, not measured site results.',
      inputs: {...DEFAULTS}
    },
    growing_publication: {
      label: 'Growing',
      description: 'Illustrative 10,000-visit starting audience and $2,500 monthly cost base. This is a different starting scenario, not a promised next stage.',
      inputs: {...DEFAULTS, monthlyVisits: 10000, trafficGrowthPct: 2, maxMonthlyVisits: 50000,
        merchantClickPct: 10, clickToPaidPct: 2.5, approvalPct: 85, churnPct: 4,
        fixedMonthlyCosts: 1500, monthlyMarketingSpend: 1000, setupCost: 2000, startingCash: 10000}
    },
    established_audience: {
      label: 'Established',
      description: 'Illustrative 50,000-visit starting audience with $12,000 monthly costs. No existing subscriber cohorts are assumed; earnings still build from new referrals.',
      inputs: {...DEFAULTS, monthlyVisits: 50000, trafficGrowthPct: 1, maxMonthlyVisits: 250000,
        merchantClickPct: 12, clickToPaidPct: 3, approvalPct: 90, reversalPct: 4, churnPct: 3,
        fixedMonthlyCosts: 7000, monthlyMarketingSpend: 5000, setupCost: 5000, startingCash: 25000}
    }
  });
  const SCENARIOS = Object.freeze({
    downside: {label: 'Downside', conversionMultiplier: 0.6, churnMultiplier: 1.5, trafficGrowthAdjustmentPct: -2},
    base: {label: 'Base', conversionMultiplier: 1, churnMultiplier: 1, trafficGrowthAdjustmentPct: 0},
    upside: {label: 'Upside', conversionMultiplier: 1.25, churnMultiplier: 0.75, trafficGrowthAdjustmentPct: 1}
  });
  const FORMULAS = Object.freeze({
    visits: 'Visits in month m = min(traffic cap, starting visits × (1 + monthly growth)^(m − 1)). A zero cap means uncapped.',
    conversions: 'Expected paid referrals = visits × merchant-click rate × click-to-paid rate. Program mix shares allocate these referrals; each program then applies its approval rate.',
    cohorts: 'A new approved cohort earns in its first month. Each following month its surviving customers are multiplied by (1 − monthly churn). Fractional counts represent expected values, not literal partial customers.',
    expiry: 'A commission term of N months earns in the acquisition month and the next N − 1 months. Customers can remain subscribed after their commission entitlement expires. Zero means no modeled expiry while the agreement remains eligible.',
    recurring: 'Gross recurring commission = active commissionable customers × assumed monthly subscription price × commission rate.',
    oneTime: 'Gross one-time commission = new approved customers × one-time commission. No renewal commission is earned from those referrals.',
    reversals: 'Expected earned commission = gross commission × (1 − reversal rate). The haircut applies to every modeled payment, rather than removing customers or creating a second churn deduction.',
    cash: 'Each month’s earned commission enters its program’s payable balance after the assumed whole-month delay. Payment requires the program’s balance minimum and cumulative approved-referral minimum; referrals count after that delay. The referral minimum is lifetime/cumulative, not active customers or a fresh count for each payout.',
    costs: 'Monthly costs = fixed operating costs + monthly marketing spend + visits × paid-traffic share × cost per paid visit. Setup cost is charged once in month 1. Avoid counting the same paid acquisition expense in both marketing inputs.',
    results: 'Operating result = earned commission − total costs. Cash flow = commission cash received − total costs. Cash balance = starting cash + cumulative cash flow. Starting cash is funding, not income.',
    breakEven: 'Break-even fields show the first nonnegative month with economic activity, not a promise that later months remain profitable. Cash-recovery month excludes starting capital.'
  });

  function number(value, name, min, max, integer) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new RangeError(name + ' must be a finite ' + (integer ? 'integer ' : 'number ') + 'between ' + min + ' and ' + max + '.');
    }
    return value;
  }
  function normalise(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Inputs must be an object.');
    const p = {...DEFAULTS, ...input};
    number(p.months, 'months', 1, 120, true);
    ['monthlyVisits', 'maxMonthlyVisits', 'fixedMonthlyCosts', 'monthlyMarketingSpend', 'costPerPaidVisit', 'setupCost', 'startingCash'].forEach(k => number(p[k], k, 0, 1e12));
    ['merchantClickPct', 'clickToPaidPct', 'paidTrafficPct'].forEach(k => number(p[k], k, 0, 100));
    number(p.trafficGrowthPct, 'trafficGrowthPct', -100, 100);
    const rawPrograms = input.programs === undefined ? [{id: 'custom', label: 'Custom program', sharePct: 100}] : input.programs;
    if (!Array.isArray(rawPrograms) || !rawPrograms.length || rawPrograms.length > 20) throw new RangeError('programs must contain 1–20 entries.');
    const seen = new Set();
    p.programs = rawPrograms.map((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Each program must be an object.');
      const program = {id: raw.id || 'program-' + (i + 1), label: raw.label || raw.name || 'Program ' + (i + 1), sharePct: raw.sharePct};
      if (typeof program.id !== 'string' || !program.id.trim() || seen.has(program.id)) throw new RangeError('Program IDs must be nonempty and unique.');
      if (typeof program.label !== 'string') throw new TypeError('Program labels must be strings.');
      seen.add(program.id);
      number(program.sharePct, 'program sharePct', 0, 100);
      ['approvalPct', 'reversalPct', 'monthlyPrice', 'commissionPct', 'churnPct', 'commissionMonths', 'payoutDelayMonths', 'payoutMinimum', 'payoutMinimumCustomers', 'commissionType', 'oneTimeCommission'].forEach(k => {
        program[k] = raw[k] === undefined ? p[k] : raw[k];
      });
      ['approvalPct', 'reversalPct', 'commissionPct', 'churnPct'].forEach(k => number(program[k], program.id + '.' + k, 0, 100));
      ['monthlyPrice', 'oneTimeCommission', 'payoutMinimum'].forEach(k => number(program[k], program.id + '.' + k, 0, 1e12));
      ['commissionMonths', 'payoutDelayMonths'].forEach(k => number(program[k], program.id + '.' + k, 0, 1200, true));
      number(program.payoutMinimumCustomers, program.id + '.payoutMinimumCustomers', 0, 1e9, true);
      if (!['recurring', 'one-time'].includes(program.commissionType)) throw new RangeError('commissionType must be recurring or one-time.');
      return program;
    });
    if (Math.abs(p.programs.reduce((sum, program) => sum + program.sharePct, 0) - 100) > 1e-6) throw new RangeError('Program shares must sum to 100%.');
    return p;
  }

  function scenarioInputs(inputOrPreset, scenarioName) {
    const selected = typeof inputOrPreset === 'string' ? PRESETS[inputOrPreset]?.inputs : inputOrPreset;
    if (!selected || typeof selected !== 'object') throw new RangeError('Choose a valid preset or supply inputs.');
    const scenario = SCENARIOS[scenarioName || 'base'];
    if (!scenario) throw new RangeError('Unknown scenario.');
    const p = {...DEFAULTS, ...selected};
    p.trafficGrowthPct = Math.max(-100, Math.min(100, p.trafficGrowthPct + scenario.trafficGrowthAdjustmentPct));
    p.clickToPaidPct = Math.min(100, p.clickToPaidPct * scenario.conversionMultiplier);
    p.churnPct = Math.min(100, p.churnPct * scenario.churnMultiplier);
    if (selected.programs) p.programs = selected.programs.map(program => ({...program,
      churnPct: Math.min(100, (program.churnPct === undefined ? selected.churnPct ?? DEFAULTS.churnPct : program.churnPct) * scenario.churnMultiplier)
    }));
    return p;
  }

  function simulate(input) {
    const p = normalise(input === undefined ? {} : input);
    const rows = [], cohorts = [];
    const states = p.programs.map(program => ({program, cohorts: [], due: [], dueCustomers: [], payable: 0, approved: 0, maturedApproved: 0, cashReceived: 0, earned: 0}));
    const totals = {visits: 0, merchantClicks: 0, grossPaidCustomers: 0, newApprovedCustomers: 0,
      grossCommission: 0, reversedCommission: 0, earnedCommission: 0, newCommission: 0, renewalCommission: 0,
      cashReceived: 0, operatingCosts: 0, setupCost: 0, totalCosts: 0, operatingResult: 0, cashFlow: 0,
      churnedCustomers: 0, expiredCustomers: 0};
    const breakEven = {operatingMonth: null, cumulativeOperatingMonth: null, cashFlowMonth: null, cashRecoveryMonth: null};
    let projectedVisits = p.monthlyVisits, cashBalance = p.startingCash, minimumCashBalance = p.startingCash;
    let minimumCumulativeCashFlow = 0, firstNegativeCashMonth = null;
    for (let month = 1; month <= p.months; month++) {
      if (month > 1) projectedVisits *= 1 + p.trafficGrowthPct / 100;
      const visits = p.maxMonthlyVisits > 0 ? Math.min(projectedVisits, p.maxMonthlyVisits) : projectedVisits;
      const row = {month, visits, merchantClicks: visits * p.merchantClickPct / 100,
        grossPaidCustomers: visits * p.merchantClickPct / 100 * p.clickToPaidPct / 100,
        newApprovedCustomers: 0, activeCommissionableCustomers: 0, activeReferredCustomers: 0,
        churnedCustomers: 0, expiredCustomers: 0, grossCommission: 0, reversedCommission: 0,
        earnedCommission: 0, newCommission: 0, renewalCommission: 0, cashReceived: 0, programs: []};
      for (const state of states) {
        const program = state.program;
        const approved = row.grossPaidCustomers * program.sharePct / 100 * program.approvalPct / 100;
        state.approved += approved;
        if (approved > 0) {
          const cohort = {programId: program.id, originMonth: month, commissionType: program.commissionType,
            initialCustomers: approved, remainingCustomers: approved, commissionExpired: false,
            activeCommissionableCustomers: 0, cumulativeEarnedCommission: 0, monthlyEarned: Array(p.months).fill(0)};
          state.cohorts.push(cohort); cohorts.push(cohort);
        }
        const detail = {id: program.id, label: program.label, sharePct: program.sharePct,
          newApprovedCustomers: approved, activeCommissionableCustomers: 0, activeReferredCustomers: 0,
          churnedCustomers: 0, expiredCustomers: 0, grossCommission: 0, reversedCommission: 0,
          earnedCommission: 0, newCommission: 0, renewalCommission: 0, cashReceived: 0};
        for (const cohort of state.cohorts) {
          const age = month - cohort.originMonth;
          if (age > 0) {
            const lost = cohort.remainingCustomers * program.churnPct / 100;
            cohort.remainingCustomers -= lost; detail.churnedCustomers += lost;
          }
          const recurring = program.commissionType === 'recurring';
          const expired = recurring && program.commissionMonths > 0 && age >= program.commissionMonths;
          if (expired && !cohort.commissionExpired) detail.expiredCustomers += cohort.remainingCustomers;
          cohort.commissionExpired = expired;
          detail.activeReferredCustomers += cohort.remainingCustomers;
          cohort.activeCommissionableCustomers = recurring && !expired ? cohort.remainingCustomers : 0;
          detail.activeCommissionableCustomers += cohort.activeCommissionableCustomers;
          const gross = recurring
            ? cohort.activeCommissionableCustomers * program.monthlyPrice * program.commissionPct / 100
            : age === 0 ? approved * program.oneTimeCommission : 0;
          const earned = gross * (1 - program.reversalPct / 100);
          cohort.monthlyEarned[month - 1] = earned;
          cohort.cumulativeEarnedCommission += earned;
          detail.grossCommission += gross; detail.earnedCommission += earned;
          if (age === 0) detail.newCommission += earned;
          else detail.renewalCommission += earned;
        }
        detail.reversedCommission = detail.grossCommission - detail.earnedCommission;
        state.earned += detail.earnedCommission;
        const dueMonth = month + program.payoutDelayMonths;
        state.due[dueMonth] = (state.due[dueMonth] || 0) + detail.earnedCommission;
        state.dueCustomers[dueMonth] = (state.dueCustomers[dueMonth] || 0) + approved;
        state.payable += state.due[month] || 0;
        state.maturedApproved += state.dueCustomers[month] || 0;
        state.due[month] = 0;
        state.dueCustomers[month] = 0;
        if (state.payable > 0 && state.payable + 1e-9 >= program.payoutMinimum && state.maturedApproved + 1e-9 >= program.payoutMinimumCustomers) {
          detail.cashReceived = state.payable; state.cashReceived += state.payable; state.payable = 0;
        }
        detail.payoutHeldCommission = state.payable;
        ['newApprovedCustomers', 'activeCommissionableCustomers', 'activeReferredCustomers', 'churnedCustomers', 'expiredCustomers', 'grossCommission', 'reversedCommission', 'earnedCommission', 'newCommission', 'renewalCommission', 'cashReceived'].forEach(k => {row[k] += detail[k];});
        row.programs.push(detail);
      }
      row.paidAcquisitionCost = visits * p.paidTrafficPct / 100 * p.costPerPaidVisit;
      row.operatingCosts = p.fixedMonthlyCosts + p.monthlyMarketingSpend + row.paidAcquisitionCost;
      row.setupCost = month === 1 ? p.setupCost : 0;
      row.totalCosts = row.operatingCosts + row.setupCost;
      row.operatingResult = row.earnedCommission - row.totalCosts;
      row.cashFlow = row.cashReceived - row.totalCosts;
      cashBalance += row.cashFlow; row.cashBalance = cashBalance;
      Object.keys(totals).forEach(k => {totals[k] += row[k];});
      row.cumulativeEarned = totals.earnedCommission;
      row.cumulativeCashReceived = totals.cashReceived;
      row.cumulativeOperatingResult = totals.operatingResult;
      row.cumulativeCashFlow = totals.cashFlow;
      row.cumulativeCosts = totals.totalCosts;
      row.unpaidCommission = totals.earnedCommission - totals.cashReceived;
      if (breakEven.operatingMonth === null && row.operatingResult >= -1e-9 && (row.totalCosts > 0 || row.earnedCommission > 0)) breakEven.operatingMonth = month;
      if (breakEven.cumulativeOperatingMonth === null && totals.operatingResult >= -1e-9 && (totals.totalCosts > 0 || totals.earnedCommission > 0)) breakEven.cumulativeOperatingMonth = month;
      if (breakEven.cashFlowMonth === null && row.cashFlow >= -1e-9 && (row.totalCosts > 0 || row.cashReceived > 0)) breakEven.cashFlowMonth = month;
      if (breakEven.cashRecoveryMonth === null && totals.cashFlow >= -1e-9 && (totals.totalCosts > 0 || totals.cashReceived > 0)) breakEven.cashRecoveryMonth = month;
      minimumCashBalance = Math.min(minimumCashBalance, cashBalance);
      minimumCumulativeCashFlow = Math.min(minimumCumulativeCashFlow, totals.cashFlow);
      if (firstNegativeCashMonth === null && cashBalance < -1e-9) firstNegativeCashMonth = month;
      if (Object.values(row).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new RangeError('Inputs produce values too large to model safely.');
      rows.push(row);
    }
    const last = rows[rows.length - 1];
    Object.assign(totals, {endingCashBalance: cashBalance, activeCommissionableCustomers: last.activeCommissionableCustomers,
      activeReferredCustomers: last.activeReferredCustomers, unpaidCommission: totals.earnedCommission - totals.cashReceived,
      payoutHeldCommission: states.reduce((sum, state) => sum + state.payable, 0),
      laggedCommission: states.reduce((sum, state) => sum + state.due.reduce((a, b) => a + b, 0), 0),
      fundingRequired: Math.max(0, -minimumCumulativeCashFlow), additionalFundingRequired: Math.max(0, -minimumCashBalance)});
    const cohortMatrix = Array.from({length: Math.min(12, p.months)}, (_, index) => ({originMonth: index + 1,
      values: rows.map((row, m) => cohorts.filter(cohort => cohort.originMonth === index + 1).reduce((sum, cohort) => sum + cohort.monthlyEarned[m], 0))}));
    return {months: rows, totals, breakEven, cohorts, cohortMatrix, assumptions: p,
      runway: {firstNegativeCashMonth, monthsCovered: firstNegativeCashMonth === null ? p.months : firstNegativeCashMonth - 1,
        extendsBeyondHorizon: firstNegativeCashMonth === null, minimumCashBalance},
      notes: [
        'All outputs are conditional expected values, not measured Seller Insider Hub results or a forecast with assigned probabilities.',
        'Affiliate commissions are income from another company’s customers; they are not Seller Insider Hub-owned SaaS MRR.',
        'The model assumes monthly customer billing at a constant price. Annual upfront billing, upgrades, downgrades, changing program terms, taxes, FX, payout fees, and retroactive clawbacks are not modeled.',
        'A month-level payout delay approximates actual approval, settlement, withdrawal and banking schedules. Threshold tests use expected fractional customers; real account payouts depend on whole actual referrals and provider approval.',
        'Approval rate should include expected attribution failures and program eligibility, including any required survival through a locking period. The model applies that expectation at acquisition; it does not adjudicate individual customer refunds or lock-period cancellations.',
        'Starting customer cohorts are zero in every preset. Founder compensation and recurring editorial, support, administration, and tooling must be included in the costs supplied.',
        'Expiry ends commission eligibility, not the customer’s subscription. Churn also continues to reduce surviving customer counts after expiry.',
        'No scenario assumes Seller Insider Hub has been approved for a vendor affiliate program.'
      ]};
  }

  return Object.freeze({simulate, scenarioInputs, PRESETS, SCENARIOS, DEFAULTS, FORMULAS});
});
