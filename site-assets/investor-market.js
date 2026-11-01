/* Market-share bridge to the affiliate cohort model. No requests or storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./investor-model.js'));
  else root.SIHInvestorMarket = factory(root.SIHInvestorModel);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (model) {
  'use strict';

  const DEFAULTS = Object.freeze({broadBusinesses: 36207130, addressablePct: 100,
    annualBuyerPct: 100, annualCapturePct: 0.1, acquisitionCostPerNewBusiness: 0,
    otherOperatingAllowanceAnnual: 0});
  const SHARES = Object.freeze([0.001, 0.01, 0.1, 0.5, 1]);
  const TARGETS = Object.freeze([1000000, 10000000, 25000000, 100000000]);
  const ANNUAL_KEYS = Object.freeze(['earnedCommission', 'coreOperatingCosts', 'operatingCosts',
    'marketingCost', 'founderPay', 'setupCost', 'totalCosts', 'beforeFounderResult',
    'afterFounderResult', 'cashReceived', 'cashFlow', 'hostingCost', 'fixedCoreCosts',
    'aiSupportCost', 'employeePayroll', 'paidAcquisitionCost', 'newBuyerBusinesses',
    'newApprovedSubscriptions', 'grossPaidSubscriptions', 'capLimitedCommission']);

  function number(value, name, min, max, integer) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new RangeError(name + ' must be a finite ' + (integer ? 'integer ' : '') + 'number between ' + min + ' and ' + max + '.');
    }
    return value;
  }
  function prepare(marketInput, modelInput) {
    if (!model || typeof model.simulate !== 'function') throw new Error('Load the financial model before the market-share model.');
    if (marketInput === undefined) marketInput = {};
    if (modelInput === undefined) modelInput = {};
    if (!marketInput || typeof marketInput !== 'object' || Array.isArray(marketInput)) throw new TypeError('Market assumptions must be an object.');
    if (!modelInput || typeof modelInput !== 'object' || Array.isArray(modelInput)) throw new TypeError('Financial assumptions must be an object.');
    const market = {...DEFAULTS, ...marketInput};
    number(market.broadBusinesses, 'broadBusinesses', 0, 1e12);
    ['addressablePct', 'annualBuyerPct', 'annualCapturePct'].forEach(k => number(market[k], k, 0, 100));
    number(market.acquisitionCostPerNewBusiness, 'acquisitionCostPerNewBusiness', 0, 1e12);
    number(market.otherOperatingAllowanceAnnual, 'otherOperatingAllowanceAnnual', 0, 1e12);
    if (market.founderPayAnnual !== undefined && market.founderPayAnnual !== null) number(market.founderPayAnnual, 'founderPayAnnual', 0, 1e12);
    const months = modelInput.months === undefined ? model.DEFAULTS.months : modelInput.months;
    number(months, 'months for an annual market comparison', 12, 120, true);
    const merchantClickPct = modelInput.merchantClickPct === undefined ? model.DEFAULTS.merchantClickPct : modelInput.merchantClickPct;
    const clickToPaidPct = modelInput.clickToPaidPct === undefined ? model.DEFAULTS.clickToPaidPct : modelInput.clickToPaidPct;
    number(merchantClickPct, 'merchantClickPct', 0, 100);
    number(clickToPaidPct, 'clickToPaidPct', 0, 100);
    market.addressableBusinesses = market.broadBusinesses * market.addressablePct / 100;
    market.annualBuyerBusinesses = market.addressableBusinesses * market.annualBuyerPct / 100;
    market.maxAnnualNewBusinesses = Math.min(market.annualBuyerBusinesses, market.addressableBusinesses * 12 / months);
    market.maxFeasibleCapturePct = market.annualBuyerBusinesses > 0
      ? Math.min(100, market.maxAnnualNewBusinesses / market.annualBuyerBusinesses * 100) : 0;
    return {market, modelInput, months, merchantClickPct, clickToPaidPct,
      firstPurchaseRate: merchantClickPct / 100 * clickToPaidPct / 100};
  }
  function fixedCostConfiguration(input) {
    if (input.costConfig) return {...input.costConfig};
    // Preserve the legacy fixed-cost input if the caller has not supplied a cost builder.
    return {domainAnnual: 0, aiToolsMonthly: 0, aiToolsAllocationPct: 100,
      aiIncrementalMonthly: 0, aiApiMonthly: 0, emailMonthly: 0, analyticsMonthly: 0,
      automationMonthly: 0, otherFixedMonthly: input.fixedMonthlyCosts === undefined ? model.DEFAULTS.fixedMonthlyCosts : input.fixedMonthlyCosts,
      founderPayMonthly: 0, supportContactsPer1000Visits: 0,
      hosting: {label: 'Included in entered fixed costs', planMonthly: 0, includedCredits: 0,
        creditPackSize: 1, creditPackPrice: 0, canTopup: true, creditsPerGB: 0,
        creditsPer10kRequests: 0, creditsPerDeploy: 0, deploysMonthly: 0,
        computeGBHours: 0, creditsPerComputeGBHour: 0}};
  }
  function evaluate(marketInput, modelInput) {
    const prepared = prepare(marketInput, modelInput);
    const {market, months, firstPurchaseRate} = prepared;
    const annualNewBusinesses = market.annualBuyerBusinesses * market.annualCapturePct / 100;
    const monthlyNewBusinesses = annualNewBusinesses / 12;
    const cumulativeUniqueBusinesses = annualNewBusinesses * months / 12;
    const tolerance = Math.max(1e-8, market.addressableBusinesses * 1e-10);
    if (cumulativeUniqueBusinesses - market.addressableBusinesses > tolerance) {
      throw new RangeError('This capture rate would acquire more unique businesses than the addressable business stock over ' + months + ' months. Reduce annual capture to ' + market.maxFeasibleCapturePct.toFixed(6) + '% or below.');
    }
    if (monthlyNewBusinesses > 0 && firstPurchaseRate === 0) throw new RangeError('A positive business-acquisition scenario needs positive vendor-click and first-purchase conversion rates.');
    const monthlyVisitsRequired = firstPurchaseRate > 0 ? monthlyNewBusinesses / firstPurchaseRate : 0;
    const monthlyAcquisitionAllowance = monthlyNewBusinesses * market.acquisitionCostPerNewBusiness;
    const originalMarketing = prepared.modelInput.monthlyMarketingSpend === undefined ? model.DEFAULTS.monthlyMarketingSpend : prepared.modelInput.monthlyMarketingSpend;
    number(originalMarketing, 'monthlyMarketingSpend', 0, 1e12);
    const input = {...prepared.modelInput, months, monthlyVisits: monthlyVisitsRequired,
      maxMonthlyVisits: monthlyVisitsRequired, trafficGrowthPct: 0,
      merchantClickPct: prepared.merchantClickPct, clickToPaidPct: prepared.clickToPaidPct,
      monthlyMarketingSpend: originalMarketing + monthlyAcquisitionAllowance};
    if (market.otherOperatingAllowanceAnnual > 0 || (market.founderPayAnnual !== undefined && market.founderPayAnnual !== null)) {
      input.costConfig = fixedCostConfiguration(prepared.modelInput);
      input.costConfig.otherFixedMonthly = (input.costConfig.otherFixedMonthly === undefined ? 0 : input.costConfig.otherFixedMonthly) + market.otherOperatingAllowanceAnnual / 12;
      if (market.founderPayAnnual !== undefined && market.founderPayAnnual !== null) input.costConfig.founderPayMonthly = market.founderPayAnnual / 12;
    }
    const result = model.simulate(input);
    const annualRows = result.months.slice(-12);
    const final12Months = Object.fromEntries(ANNUAL_KEYS.map(k => [k, annualRows.reduce((sum, row) => sum + row[k], 0)]));
    final12Months.marketAcquisitionAllowance = monthlyAcquisitionAllowance * 12;
    final12Months.otherOperatingAllowance = market.otherOperatingAllowanceAnnual;
    final12Months.operatingMarginBeforeFounderPct = final12Months.earnedCommission > 0
      ? final12Months.beforeFounderResult / final12Months.earnedCommission * 100 : null;
    final12Months.operatingMarginAfterFounderPct = final12Months.earnedCommission > 0
      ? final12Months.afterFounderResult / final12Months.earnedCommission * 100 : null;
    const finalMonth = result.months[result.months.length - 1];
    const notes = [
      'The broad business count is a population reference, not an observed annual software-buyer pool or a count of businesses likely to use this website. Addressable and annual buyer percentages are editable assumptions.',
      'A 100% addressable share and 100% annual buyer share deliberately retain the broad base for comparison. They do not establish that every small business purchases eligible software each year.',
      'Annual capture is the share of the modeled annual buyer pool acquired as new businesses each year. The first-purchase funnel is assumed deduplicated. The same business is not acquired again in a later year of this model.',
      'The model begins with zero customer cohorts and holds derived visitor traffic constant. Final-year earned commission is the sum of the last twelve model months; it is different from the final month multiplied by twelve.',
      'Several paid tools can be purchased by one business. Subscription referrals and active commissionable accounts are not counts of unique businesses. The selected portfolio and stack assumptions govern those purchases.',
      'Per-business acquisition allowance is added to existing marketing and paid-traffic costs. Avoid counting the same acquisition activity in both inputs. Setting this allowance to zero does not prove that acquiring the modeled audience is free.',
      'The additional annual operating allowance is included in core costs; founder compensation is shown separately. These are optional planning budgets, not employee hiring or verified expenses. Taxes and investor returns are not modeled.',
      'Commission income depends on program acceptance, attribution, retention, caps and continued eligibility. No market-share assumption supplies evidence of actual traffic, referrals, program approval, or obtainable market share.'
    ];
    return {feasible: true, hostingCapacityExceeded: result.hostingCapacityExceeded,
      horizonMonths: months, annualPeriod: {startMonth: months - 11, endMonth: months, months: 12},
      market, annualNewBusinesses, monthlyNewBusinesses, monthlyVisitsRequired,
      broadBaseAnnualSharePct: market.broadBusinesses > 0 ? annualNewBusinesses / market.broadBusinesses * 100 : null,
      buyerPoolAnnualSharePct: market.annualBuyerBusinesses > 0 ? annualNewBusinesses / market.annualBuyerBusinesses * 100 : null,
      cumulativeUniqueBusinesses: result.totals.newBuyerBusinesses,
      stockUtilizationPct: market.addressableBusinesses > 0 ? result.totals.newBuyerBusinesses / market.addressableBusinesses * 100 : null,
      remainingAddressableBusinesses: Math.max(0, market.addressableBusinesses - result.totals.newBuyerBusinesses),
      final12Months, finalMonthEarnedCommission: finalMonth.earnedCommission,
      annualizedExitRunRate: finalMonth.earnedCommission * 12,
      fundingRequired: result.totals.fundingRequired, additionalFundingRequired: result.totals.additionalFundingRequired,
      endingCashBalance: result.totals.endingCashBalance,
      allowances: {acquisitionCostPerNewBusiness: market.acquisitionCostPerNewBusiness,
        monthlyAcquisitionAllowance, founderPayAnnualOverride: market.founderPayAnnual ?? null,
        otherOperatingAllowanceAnnual: market.otherOperatingAllowanceAnnual},
      assumptions: result.assumptions, notes, modelNotes: result.notes};
  }
  function failure(error, fields) {
    return {...fields, feasible: false, reason: error instanceof Error ? error.message : String(error)};
  }
  function shareLadder(marketInput, modelInput, shares) {
    const prepared = prepare(marketInput, modelInput);
    if (shares === undefined) shares = SHARES;
    if (!Array.isArray(shares) || !shares.length) throw new TypeError('Share ladder must contain at least one percentage.');
    return shares.map(annualCapturePct => {
      try {return {...evaluate({...prepared.market, annualCapturePct}, prepared.modelInput), requestedAnnualCapturePct: annualCapturePct};}
      catch (error) {return failure(error, {requestedAnnualCapturePct: annualCapturePct});}
    });
  }
  function solveTargets(marketInput, modelInput, targets) {
    const prepared = prepare(marketInput, modelInput);
    if (targets === undefined) targets = TARGETS;
    if (!Array.isArray(targets) || !targets.length) throw new TypeError('Targets must contain at least one annual commission amount.');
    targets.forEach(target => number(target, 'annual commission target', 0, 1e15));
    const cache = new Map();
    const at = capture => {
      const key = capture.toPrecision(16);
      if (!cache.has(key)) cache.set(key, evaluate({...prepared.market, annualCapturePct: capture}, prepared.modelInput));
      return cache.get(key);
    };
    const zero = at(0);
    let maximum, boundaryError;
    try {
      maximum = at(prepared.market.maxFeasibleCapturePct);
      const cappedPrograms = maximum.assumptions.programs.some(p => p.annualCommissionCap > 0);
      const calendarEnd = (maximum.assumptions.startingCalendarMonth - 1 + prepared.months) % 12;
      if (cappedPrograms && calendarEnd !== 0) {
        throw new RangeError('Annual target search with calendar-year commission caps requires a final twelve-month period ending in December. Use a January start with a whole-year horizon.');
      }
    } catch (error) {boundaryError = error;}
    return targets.map(targetAnnualCommission => {
      if (targetAnnualCommission === 0) return {...zero, targetAnnualCommission, requiredAnnualCapturePct: 0};
      if (boundaryError) return failure(boundaryError, {targetAnnualCommission});
      const maximumAnnualCommission = maximum.final12Months.earnedCommission;
      if (maximumAnnualCommission + 1e-7 < targetAnnualCommission) return {
        feasible: false, targetAnnualCommission, maximumAnnualCommission,
        maxFeasibleCapturePct: prepared.market.maxFeasibleCapturePct,
        reason: 'This annual commission target exceeds the outcome supported by the selected buyer pool, unique-business stock, horizon, portfolio and commission caps.'
      };
      let lo = 0, hi = prepared.market.maxFeasibleCapturePct, answer = maximum;
      const tolerance = Math.max(0.01, targetAnnualCommission * 1e-8);
      for (let iteration = 0; iteration < 42; iteration++) {
        const middle = (lo + hi) / 2, candidate = at(middle);
        if (candidate.final12Months.earnedCommission >= targetAnnualCommission) {hi = middle; answer = candidate;}
        else lo = middle;
        if (answer.final12Months.earnedCommission - targetAnnualCommission <= tolerance) break;
      }
      return {...answer, targetAnnualCommission, requiredAnnualCapturePct: hi, maximumAnnualCommission};
    });
  }

  return Object.freeze({evaluate, shareLadder, solveTargets, DEFAULTS, SHARES, TARGETS});
});
