/* Expected-value affiliate cohort model. No requests, storage, or dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./investor-costs.js'));
  else root.SIHInvestorModel = factory(root.SIHInvestorCosts);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (costEngine) {
  'use strict';

  const DEFAULTS = Object.freeze({
    months: 36, monthlyVisits: 1000, trafficGrowthPct: 3, maxMonthlyVisits: 10000,
    merchantClickPct: 8, clickToPaidPct: 2, approvalPct: 80, reversalPct: 5,
    paidToolsPerBusiness: 1, stackExpansionDelayMonths: 0,
    monthlyPrice: 100, commissionPct: 30, churnPct: 5, commissionMonths: 12,
    payoutDelayMonths: 2, payoutMinimum: 0, payoutMinimumCustomers: 0,
    commissionType: 'recurring', oneTimeCommission: 200, commissionCapPerCustomer: 0,
    annualCommissionCap: 0, startingCalendarMonth: 1,
    fixedMonthlyCosts: 95, monthlyMarketingSpend: 0,
    paidTrafficPct: 0, costPerPaidVisit: 0, setupCost: 0, startingCash: 2000
  });
  const PRESETS = Object.freeze({
    early_audience: {
      label: 'Foundation',
      description: 'An illustrative starting audience of 1,000 monthly visits. Audience size changes revenue assumptions; it does not add employees or increase fixed overhead.',
      inputs: {...DEFAULTS}
    },
    growing_publication: {
      label: 'Growing',
      description: 'An illustrative starting audience of 10,000 monthly visits, with the same solo-founder operating structure. This is an audience scenario, not a forecast.',
      inputs: {...DEFAULTS, monthlyVisits: 10000, trafficGrowthPct: 2, maxMonthlyVisits: 50000,
        merchantClickPct: 10, clickToPaidPct: 2.5, approvalPct: 85, churnPct: 4}
    },
    established_audience: {
      label: 'Established',
      description: 'An illustrative starting audience of 50,000 monthly visits. Hosting and optional AI usage scale with demand; employee payroll remains zero. No existing subscriber cohorts are assumed.',
      inputs: {...DEFAULTS, monthlyVisits: 50000, trafficGrowthPct: 1, maxMonthlyVisits: 250000,
        merchantClickPct: 12, clickToPaidPct: 3, approvalPct: 90, reversalPct: 4, churnPct: 3}
    },
    high_traffic: {
      label: 'High traffic',
      description: 'An illustrative starting audience of 250,000 monthly visits with a technical solo founder. The same explicit operating-cost inputs apply; no assumed hiring is added.',
      inputs: {...DEFAULTS, monthlyVisits: 250000, trafficGrowthPct: 1, maxMonthlyVisits: 1000000,
        merchantClickPct: 12, clickToPaidPct: 3, approvalPct: 90, reversalPct: 4, churnPct: 3}
    }
  });
  const SCENARIOS = Object.freeze({
    downside: {label: 'Downside', conversionMultiplier: 0.6, churnMultiplier: 1.5, trafficGrowthAdjustmentPct: -2},
    base: {label: 'Base', conversionMultiplier: 1, churnMultiplier: 1, trafficGrowthAdjustmentPct: 0},
    upside: {label: 'Upside', conversionMultiplier: 1.25, churnMultiplier: 0.75, trafficGrowthAdjustmentPct: 1}
  });
  const FORMULAS = Object.freeze({
    visits: 'Visits in month m = min(traffic cap, starting visits × (1 + monthly growth)^(m − 1)). A zero cap means uncapped.',
    conversions: 'Expected new buyer businesses = visits × merchant-click rate × first-purchase conversion rate. This funnel is assumed deduplicated across offers. Each business initially buys one tool; paidToolsPerBusiness sets its eventual average number of distinct paid affiliate tools. Program-specific approval applies to each resulting subscription referral.',
    stack: 'First-tool weights sum to 100%. Additional tools are allocated proportionally with a maximum of one account for each program per business; weight above that cap is redistributed. Expansion referrals arrive after the selected delay, and each starts its own commission and retention clock. The average stack size is a scenario assumption, not observed customer behavior.',
    cohorts: 'A new approved cohort earns in its first month. Each following month its surviving customers are multiplied by (1 − monthly churn). Fractional counts represent expected values, not literal partial customers.',
    expiry: 'A commission term of N months earns in the acquisition month and the next N − 1 months. Customers can remain subscribed after their commission entitlement expires. Zero means no modeled expiry while the agreement remains eligible.',
    recurring: 'Gross recurring commission = active commissionable customers × assumed monthly subscription price × commission rate.',
    oneTime: 'Gross one-time commission = new approved customers × one-time commission. No renewal commission is earned from those referrals.',
    reversals: 'Expected earned commission = gross commission × (1 − reversal rate). The haircut applies to every modeled payment, rather than removing customers or creating a second churn deduction.',
    cash: 'Each month’s earned commission enters its program’s payable balance after the assumed whole-month delay. Payment requires the program’s balance minimum and cumulative approved-referral minimum; referrals count after that delay. The referral minimum is lifetime/cumulative, not active customers or a fresh count for each payout.',
    costs: 'Monthly operating costs = explicit fixed tools/domain budget + traffic-based hosting + optional AI support + optional marketing + visits × paid-traffic share × cost per paid visit. Employee payroll is zero. Founder compensation is shown separately. Setup cost is charged once in month 1. Avoid counting the same acquisition expense in both marketing inputs.',
    results: 'Before-founder operating result = earned commission − operating costs − setup. After-founder operating result = before-founder result − configured founder compensation. Cash flow = commission cash received − all modeled costs, including founder compensation. Cash balance = starting cash + cumulative cash flow. Starting cash is funding, not income.',
    breakEven: 'Break-even fields show the first nonnegative month with economic activity, not a promise that later months remain profitable. Cash-recovery month excludes starting capital.'
  });

  function number(value, name, min, max, integer) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new RangeError(name + ' must be a finite ' + (integer ? 'integer ' : 'number ') + 'between ' + min + ' and ' + max + '.');
    }
    return value;
  }

  function allocateStack(programs, paidToolsPerBusiness) {
    if (!Array.isArray(programs) || !programs.length) throw new RangeError('Select at least one program before allocating a stack.');
    programs.forEach(program => number(program.sharePct, 'program sharePct', 0, 100));
    if (Math.abs(programs.reduce((sum, program) => sum + program.sharePct, 0) - 100) > 1e-6) throw new RangeError('Program shares must sum to 100%.');
    const positive = programs.map((program, index) => ({index, weight: program.sharePct / 100})).filter(item => item.weight > 0);
    number(paidToolsPerBusiness, 'paidToolsPerBusiness', 1, 100);
    if (paidToolsPerBusiness > positive.length + 1e-9) throw new RangeError('Average paid tools per business cannot exceed the ' + positive.length + ' selected programs with positive referral weights.');
    const rates = Array(programs.length).fill(0);
    if (paidToolsPerBusiness === 1) positive.forEach(item => {rates[item.index] = item.weight;});
    let remaining = paidToolsPerBusiness, available = positive.slice();
    while (available.length && paidToolsPerBusiness !== 1) {
      const weightSum = available.reduce((sum, item) => sum + item.weight, 0);
      const capped = available.filter(item => remaining * item.weight / weightSum > 1);
      if (!capped.length) {
        available.forEach(item => {rates[item.index] = remaining * item.weight / weightSum;});
        break;
      }
      const cappedIndexes = new Set(capped.map(item => item.index));
      capped.forEach(item => {rates[item.index] = 1;});
      remaining -= capped.length;
      available = available.filter(item => !cappedIndexes.has(item.index));
    }
    return programs.map((program, index) => ({
      id: program.id, firstToolSharePct: program.sharePct, weightedSelectionSharePct: program.sharePct,
      adoptionRatePerBusiness: rates[index],
      expansionRatePerBusiness: Math.max(0, rates[index] - program.sharePct / 100),
      stackSharePct: rates[index] / paidToolsPerBusiness * 100
    }));
  }

  function normalise(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Inputs must be an object.');
    const p = {...DEFAULTS, ...input};
    if (input.costConfig !== undefined) {
      if (!costEngine) throw new Error('The operating-cost engine must be loaded before the revenue model.');
      p.costConfig = costEngine.normalise(input.costConfig);
    }
    number(p.months, 'months', 1, 120, true);
    number(p.startingCalendarMonth, 'startingCalendarMonth', 1, 12, true);
    number(p.stackExpansionDelayMonths, 'stackExpansionDelayMonths', 0, 1200, true);
    ['monthlyVisits', 'maxMonthlyVisits', 'fixedMonthlyCosts', 'monthlyMarketingSpend', 'costPerPaidVisit', 'setupCost', 'startingCash'].forEach(k => number(p[k], k, 0, 1e12));
    ['merchantClickPct', 'clickToPaidPct', 'paidTrafficPct'].forEach(k => number(p[k], k, 0, 100));
    number(p.trafficGrowthPct, 'trafficGrowthPct', -100, 100);
    const rawPrograms = input.programs === undefined ? [{id: 'custom', label: 'Custom program', sharePct: 100}] : input.programs;
    if (!Array.isArray(rawPrograms) || !rawPrograms.length || rawPrograms.length > 100) throw new RangeError('programs must contain 1–100 entries.');
    const seen = new Set();
    p.programs = rawPrograms.map((raw, i) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Each program must be an object.');
      const program = {id: raw.id || 'program-' + (i + 1), label: raw.label || raw.name || 'Program ' + (i + 1), sharePct: raw.sharePct};
      if (typeof program.id !== 'string' || !program.id.trim() || seen.has(program.id)) throw new RangeError('Program IDs must be nonempty and unique.');
      if (typeof program.label !== 'string') throw new TypeError('Program labels must be strings.');
      seen.add(program.id);
      number(program.sharePct, 'program sharePct', 0, 100);
      ['approvalPct', 'reversalPct', 'monthlyPrice', 'commissionPct', 'churnPct', 'commissionMonths', 'payoutDelayMonths', 'payoutMinimum', 'payoutMinimumCustomers', 'commissionType', 'oneTimeCommission', 'commissionCapPerCustomer', 'annualCommissionCap'].forEach(k => {
        program[k] = raw[k] === undefined ? p[k] : raw[k];
      });
      ['approvalPct', 'reversalPct', 'commissionPct', 'churnPct'].forEach(k => number(program[k], program.id + '.' + k, 0, 100));
      ['monthlyPrice', 'oneTimeCommission', 'payoutMinimum', 'commissionCapPerCustomer', 'annualCommissionCap'].forEach(k => number(program[k], program.id + '.' + k, 0, 1e12));
      ['commissionMonths', 'payoutDelayMonths'].forEach(k => number(program[k], program.id + '.' + k, 0, 1200, true));
      number(program.payoutMinimumCustomers, program.id + '.payoutMinimumCustomers', 0, 1e9, true);
      if (program.commissionType === 'one_time') program.commissionType = 'one-time';
      if (!['recurring', 'one-time'].includes(program.commissionType)) throw new RangeError('commissionType must be recurring or one-time.');
      return program;
    });
    if (Math.abs(p.programs.reduce((sum, program) => sum + program.sharePct, 0) - 100) > 1e-6) throw new RangeError('Program shares must sum to 100%.');
    const allocation = allocateStack(p.programs, p.paidToolsPerBusiness);
    p.programs = p.programs.map((program, index) => ({...program, ...allocation[index]}));
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
    const states = p.programs.map(program => ({program, cohorts: [], due: [], dueCustomers: [], payable: 0,
      approved: 0, maturedApproved: 0, cashReceived: 0, earned: 0, newCommission: 0,
      renewalCommission: 0, grossCommission: 0, reversedCommission: 0,
      capLimitedCommission: 0, annualEarned: 0, annualCapYear: 0,
      firstToolReferrals: 0, stackExpansionReferrals: 0, grossPaidSubscriptions: 0}));
    const totals = {visits: 0, merchantClicks: 0, grossPaidCustomers: 0, newApprovedCustomers: 0,
      newBuyerBusinesses: 0, firstToolReferrals: 0, stackExpansionReferrals: 0,
      grossPaidSubscriptions: 0, newApprovedSubscriptions: 0,
      grossCommission: 0, reversedCommission: 0, earnedCommission: 0, newCommission: 0, renewalCommission: 0,
      cashReceived: 0, operatingCosts: 0, setupCost: 0, totalCosts: 0, operatingResult: 0, cashFlow: 0,
      churnedCustomers: 0, expiredCustomers: 0, hostingCost: 0, fixedCoreCosts: 0,
      aiSupportCost: 0, employeePayroll: 0, coreOperatingCosts: 0, founderPay: 0,
      marketingCost: 0, paidAcquisitionCost: 0, beforeFounderResult: 0, afterFounderResult: 0,
      cashFlowBeforeFounderPay: 0, allocatedCoreOperatingCosts: 0, incrementalCoreOperatingCosts: 0,
      capLimitedCommission: 0};
    const breakEven = {operatingMonth: null, cumulativeOperatingMonth: null, cashFlowMonth: null, cashRecoveryMonth: null};
    const beforeFounderBreakEven = {operatingMonth: null, cumulativeOperatingMonth: null, cashFlowMonth: null, cashRecoveryMonth: null};
    let projectedVisits = p.monthlyVisits, cashBalance = p.startingCash, minimumCashBalance = p.startingCash;
    let minimumCumulativeCashFlow = 0, firstNegativeCashMonth = null;
    let hostingCreditCarry = 0;
    for (let month = 1; month <= p.months; month++) {
      if (month > 1) projectedVisits *= 1 + p.trafficGrowthPct / 100;
      const visits = p.maxMonthlyVisits > 0 ? Math.min(projectedVisits, p.maxMonthlyVisits) : projectedVisits;
      const newBuyerBusinesses = visits * p.merchantClickPct / 100 * p.clickToPaidPct / 100;
      const expansionBuyerBusinesses = p.stackExpansionDelayMonths === 0 ? newBuyerBusinesses
        : rows[month - p.stackExpansionDelayMonths - 1]?.newBuyerBusinesses || 0;
      const stackExpansionReferrals = expansionBuyerBusinesses * (p.paidToolsPerBusiness - 1);
      const row = {month, visits, merchantClicks: visits * p.merchantClickPct / 100,
        newBuyerBusinesses, firstToolReferrals: newBuyerBusinesses, stackExpansionReferrals,
        grossPaidSubscriptions: newBuyerBusinesses + stackExpansionReferrals,
        grossPaidCustomers: newBuyerBusinesses + stackExpansionReferrals,
        newApprovedCustomers: 0, activeCommissionableCustomers: 0, activeReferredCustomers: 0,
        churnedCustomers: 0, expiredCustomers: 0, grossCommission: 0, reversedCommission: 0,
        earnedCommission: 0, newCommission: 0, renewalCommission: 0, cashReceived: 0, capLimitedCommission: 0, programs: []};
      for (const state of states) {
        const program = state.program;
        const firstToolReferrals = newBuyerBusinesses * program.firstToolSharePct / 100;
        const expansionReferrals = expansionBuyerBusinesses * program.expansionRatePerBusiness;
        const grossPaidSubscriptions = firstToolReferrals + expansionReferrals;
        const approved = grossPaidSubscriptions * program.approvalPct / 100;
        state.approved += approved;
        state.firstToolReferrals += firstToolReferrals;
        state.stackExpansionReferrals += expansionReferrals;
        state.grossPaidSubscriptions += grossPaidSubscriptions;
        if (approved > 0) {
          const cohort = {programId: program.id, originMonth: month, commissionType: program.commissionType,
            initialCustomers: approved, remainingCustomers: approved, commissionExpired: false,
            activeCommissionableCustomers: 0, cumulativeEarnedCommission: 0, monthlyEarned: Array(p.months).fill(0)};
          state.cohorts.push(cohort); cohorts.push(cohort);
        }
        const detail = {id: program.id, label: program.label, sharePct: program.sharePct,
          firstToolSharePct: program.firstToolSharePct, weightedSelectionSharePct: program.weightedSelectionSharePct,
          adoptionRatePerBusiness: program.adoptionRatePerBusiness, expansionRatePerBusiness: program.expansionRatePerBusiness,
          stackSharePct: program.stackSharePct,
          realizedReferralSharePct: row.grossPaidSubscriptions > 0 ? grossPaidSubscriptions / row.grossPaidSubscriptions * 100 : 0,
          firstToolReferrals, stackExpansionReferrals: expansionReferrals, grossPaidSubscriptions,
          newApprovedSubscriptions: approved,
          newApprovedCustomers: approved, activeCommissionableCustomers: 0, activeReferredCustomers: 0,
          churnedCustomers: 0, expiredCustomers: 0, grossCommission: 0, reversedCommission: 0,
          earnedCommission: 0, newCommission: 0, renewalCommission: 0, cashReceived: 0, capLimitedCommission: 0};
        for (const cohort of state.cohorts) {
          const age = month - cohort.originMonth;
          if (age > 0) {
            const lost = cohort.remainingCustomers * program.churnPct / 100;
            cohort.remainingCustomers -= lost; detail.churnedCustomers += lost;
          }
          const recurring = program.commissionType === 'recurring';
          const monthlyPerCustomer = program.monthlyPrice * program.commissionPct / 100;
          const capRemaining = program.commissionCapPerCustomer > 0
            ? Math.max(0, program.commissionCapPerCustomer - age * monthlyPerCustomer) : Infinity;
          const expired = recurring && ((program.commissionMonths > 0 && age >= program.commissionMonths) || capRemaining <= 0);
          if (expired && !cohort.commissionExpired) detail.expiredCustomers += cohort.remainingCustomers;
          cohort.commissionExpired = expired;
          detail.activeReferredCustomers += cohort.remainingCustomers;
          cohort.activeCommissionableCustomers = recurring && !expired ? cohort.remainingCustomers : 0;
          detail.activeCommissionableCustomers += cohort.activeCommissionableCustomers;
          const gross = recurring
            ? cohort.activeCommissionableCustomers * Math.min(monthlyPerCustomer, capRemaining)
            : age === 0 ? approved * (program.commissionCapPerCustomer > 0
              ? Math.min(program.oneTimeCommission, program.commissionCapPerCustomer) : program.oneTimeCommission) : 0;
          const earned = gross * (1 - program.reversalPct / 100);
          cohort.monthlyEarned[month - 1] = earned;
          cohort.cumulativeEarnedCommission += earned;
          detail.grossCommission += gross; detail.earnedCommission += earned;
          if (age === 0) detail.newCommission += earned;
          else detail.renewalCommission += earned;
        }
        detail.reversedCommission = detail.grossCommission - detail.earnedCommission;
        const annualCapYear = Math.floor((p.startingCalendarMonth - 1 + month - 1) / 12);
        if (annualCapYear !== state.annualCapYear) {state.annualEarned = 0; state.annualCapYear = annualCapYear;}
        if (program.annualCommissionCap > 0 && detail.earnedCommission > 0) {
          const allowed = Math.min(detail.earnedCommission, Math.max(0, program.annualCommissionCap - state.annualEarned));
          const factor = allowed / detail.earnedCommission;
          detail.capLimitedCommission = detail.earnedCommission - allowed;
          detail.earnedCommission = allowed;
          detail.newCommission *= factor;
          detail.renewalCommission *= factor;
          for (const cohort of state.cohorts) {
            const earnedBeforeCap = cohort.monthlyEarned[month - 1];
            cohort.monthlyEarned[month - 1] *= factor;
            cohort.cumulativeEarnedCommission -= earnedBeforeCap - cohort.monthlyEarned[month - 1];
          }
        }
        state.annualEarned += detail.earnedCommission;
        detail.annualCapYear = annualCapYear + 1;
        detail.annualEarnedCommission = state.annualEarned;
        state.earned += detail.earnedCommission;
        state.newCommission += detail.newCommission;
        state.renewalCommission += detail.renewalCommission;
        state.grossCommission += detail.grossCommission;
        state.reversedCommission += detail.reversedCommission;
        state.capLimitedCommission += detail.capLimitedCommission;
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
        detail.activeCommissionableSubscriptions = detail.activeCommissionableCustomers;
        detail.activeReferredSubscriptions = detail.activeReferredCustomers;
        ['newApprovedCustomers', 'activeCommissionableCustomers', 'activeReferredCustomers', 'churnedCustomers', 'expiredCustomers', 'grossCommission', 'reversedCommission', 'earnedCommission', 'newCommission', 'renewalCommission', 'cashReceived', 'capLimitedCommission'].forEach(k => {row[k] += detail[k];});
        row.programs.push(detail);
      }
      row.newApprovedSubscriptions = row.newApprovedCustomers;
      row.activeCommissionableSubscriptions = row.activeCommissionableCustomers;
      row.activeReferredSubscriptions = row.activeReferredCustomers;
      row.paidAcquisitionCost = visits * p.paidTrafficPct / 100 * p.costPerPaidVisit;
      const costs = p.costConfig ? costEngine.evaluate(p.costConfig, visits, hostingCreditCarry) : {
        hostingCost: 0, fixedCoreCosts: p.fixedMonthlyCosts, aiSupportCost: 0,
        employeePayroll: 0, founderPay: 0, coreOperatingCosts: p.fixedMonthlyCosts,
        allocatedCoreOperatingCosts: p.fixedMonthlyCosts, incrementalCoreOperatingCosts: p.fixedMonthlyCosts,
        hostingCapacityExceeded: false, creditCarryOut: 0
      };
      hostingCreditCarry = costs.creditCarryOut;
      row.costDetails = costs;
      ['hostingCost', 'fixedCoreCosts', 'aiSupportCost', 'employeePayroll', 'founderPay',
        'coreOperatingCosts', 'allocatedCoreOperatingCosts', 'incrementalCoreOperatingCosts'
      ].forEach(k => {row[k] = costs[k];});
      row.hostingCapacityExceeded = costs.hostingCapacityExceeded;
      row.marketingCost = p.monthlyMarketingSpend + row.paidAcquisitionCost;
      row.operatingCosts = row.coreOperatingCosts + row.marketingCost;
      row.setupCost = month === 1 ? p.setupCost : 0;
      row.totalCosts = row.operatingCosts + row.setupCost + row.founderPay;
      row.beforeFounderResult = row.earnedCommission - row.operatingCosts - row.setupCost;
      row.operatingResult = row.earnedCommission - row.totalCosts;
      row.afterFounderResult = row.operatingResult;
      row.cashFlowBeforeFounderPay = row.cashReceived - row.operatingCosts - row.setupCost;
      row.cashFlow = row.cashReceived - row.totalCosts;
      cashBalance += row.cashFlow; row.cashBalance = cashBalance;
      Object.keys(totals).forEach(k => {totals[k] += row[k];});
      row.cumulativeEarned = totals.earnedCommission;
      row.cumulativeCashReceived = totals.cashReceived;
      row.cumulativeOperatingResult = totals.operatingResult;
      row.cumulativeBeforeFounderResult = totals.beforeFounderResult;
      row.cumulativeCashFlow = totals.cashFlow;
      row.cumulativeCosts = totals.totalCosts;
      row.unpaidCommission = totals.earnedCommission - totals.cashReceived;
      if (breakEven.operatingMonth === null && row.operatingResult >= -1e-9 && (row.totalCosts > 0 || row.earnedCommission > 0)) breakEven.operatingMonth = month;
      if (breakEven.cumulativeOperatingMonth === null && totals.operatingResult >= -1e-9 && (totals.totalCosts > 0 || totals.earnedCommission > 0)) breakEven.cumulativeOperatingMonth = month;
      if (breakEven.cashFlowMonth === null && row.cashFlow >= -1e-9 && (row.totalCosts > 0 || row.cashReceived > 0)) breakEven.cashFlowMonth = month;
      if (breakEven.cashRecoveryMonth === null && totals.cashFlow >= -1e-9 && (totals.totalCosts > 0 || totals.cashReceived > 0)) breakEven.cashRecoveryMonth = month;
      if (beforeFounderBreakEven.operatingMonth === null && row.beforeFounderResult >= -1e-9 && (row.operatingCosts + row.setupCost > 0 || row.earnedCommission > 0)) beforeFounderBreakEven.operatingMonth = month;
      if (beforeFounderBreakEven.cumulativeOperatingMonth === null && totals.beforeFounderResult >= -1e-9 && (totals.operatingCosts + totals.setupCost > 0 || totals.earnedCommission > 0)) beforeFounderBreakEven.cumulativeOperatingMonth = month;
      if (beforeFounderBreakEven.cashFlowMonth === null && row.cashFlowBeforeFounderPay >= -1e-9 && (row.operatingCosts + row.setupCost > 0 || row.cashReceived > 0)) beforeFounderBreakEven.cashFlowMonth = month;
      if (beforeFounderBreakEven.cashRecoveryMonth === null && totals.cashFlowBeforeFounderPay >= -1e-9 && (totals.operatingCosts + totals.setupCost > 0 || totals.cashReceived > 0)) beforeFounderBreakEven.cashRecoveryMonth = month;
      minimumCashBalance = Math.min(minimumCashBalance, cashBalance);
      minimumCumulativeCashFlow = Math.min(minimumCumulativeCashFlow, totals.cashFlow);
      if (firstNegativeCashMonth === null && cashBalance < -1e-9) firstNegativeCashMonth = month;
      if (Object.values(row).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new RangeError('Inputs produce values too large to model safely.');
      rows.push(row);
    }
    const last = rows[rows.length - 1];
    Object.assign(totals, {endingCashBalance: cashBalance, activeCommissionableCustomers: last.activeCommissionableCustomers,
      activeCommissionableSubscriptions: last.activeCommissionableCustomers,
      activeReferredSubscriptions: last.activeReferredCustomers,
      activeReferredCustomers: last.activeReferredCustomers, unpaidCommission: totals.earnedCommission - totals.cashReceived,
      payoutHeldCommission: states.reduce((sum, state) => sum + state.payable, 0),
      laggedCommission: states.reduce((sum, state) => sum + state.due.reduce((a, b) => a + b, 0), 0),
      fundingRequired: Math.max(0, -minimumCumulativeCashFlow), additionalFundingRequired: Math.max(0, -minimumCashBalance),
      pendingStackExpansionReferrals: Math.max(0, totals.newBuyerBusinesses * (p.paidToolsPerBusiness - 1) - totals.stackExpansionReferrals)});
    const cohortMatrix = Array.from({length: Math.min(12, p.months)}, (_, index) => ({originMonth: index + 1,
      values: rows.map((row, m) => cohorts.filter(cohort => cohort.originMonth === index + 1).reduce((sum, cohort) => sum + cohort.monthlyEarned[m], 0))}));
    const programTotals = states.map((state, i) => ({
      id: state.program.id, label: state.program.label, sharePct: state.program.sharePct,
      firstToolSharePct: state.program.firstToolSharePct, weightedSelectionSharePct: state.program.weightedSelectionSharePct,
      adoptionRatePerBusiness: state.program.adoptionRatePerBusiness, expansionRatePerBusiness: state.program.expansionRatePerBusiness,
      stackSharePct: state.program.stackSharePct,
      firstToolReferrals: state.firstToolReferrals, stackExpansionReferrals: state.stackExpansionReferrals,
      grossPaidSubscriptions: state.grossPaidSubscriptions, newApprovedSubscriptions: state.approved,
      newApprovedCustomers: state.approved, earnedCommission: state.earned,
      newCommission: state.newCommission, renewalCommission: state.renewalCommission,
      grossCommission: state.grossCommission, reversedCommission: state.reversedCommission,
      capLimitedCommission: state.capLimitedCommission,
      cashReceived: state.cashReceived, unpaidCommission: state.earned - state.cashReceived,
      payoutHeldCommission: state.payable,
      laggedCommission: state.due.reduce((sum, due) => sum + due, 0),
      activeCommissionableCustomers: last.programs[i].activeCommissionableCustomers,
      activeReferredCustomers: last.programs[i].activeReferredCustomers,
      activeCommissionableSubscriptions: last.programs[i].activeCommissionableCustomers,
      activeReferredSubscriptions: last.programs[i].activeReferredCustomers
    }));
    return {months: rows, totals, breakEven, beforeFounderBreakEven, programTotals, cohorts, cohortMatrix, assumptions: p,
      hostingCapacityExceeded: rows.some(row => row.hostingCapacityExceeded),
      runway: {firstNegativeCashMonth, monthsCovered: firstNegativeCashMonth === null ? p.months : firstNegativeCashMonth - 1,
        extendsBeyondHorizon: firstNegativeCashMonth === null, minimumCashBalance},
      notes: [
        'All outputs are conditional expected values, not measured Seller Insider Hub results or a forecast with assigned probabilities.',
        'A business can buy several distinct paid tools. The funnel counts expected new buyer businesses once; tool referrals count each modeled product subscription separately. Active referred or commissionable customer counts are subscription accounts, not deduplicated businesses.',
        'Average paid tools per business describes paid, attributable offers in the selected affiliate basket. It does not count free tools, noncommissioned products, duplicate accounts for the same program, or untracked purchases. Expansion size and timing are editable assumptions, not measured adoption.',
        'Every business makes one initial tool purchase in expectation. Extra product purchases occur after the configured delay; each earns only from its own acquisition month. Expansions scheduled beyond the horizon are excluded from earned commission and cash.',
        'Affiliate commissions are income from another company’s customers; they are not Seller Insider Hub-owned SaaS MRR.',
        'The model assumes monthly customer billing at a constant price. Annual upfront billing, upgrades, downgrades, changing program terms, taxes, FX, payout fees, and retroactive clawbacks are not modeled.',
        'A month-level payout delay approximates actual approval, settlement, withdrawal and banking schedules. Threshold tests use expected fractional customers; real account payouts depend on whole actual referrals and provider approval.',
        'Approval rate should include expected attribution failures and program eligibility, including any required survival through a locking period. The model applies that expectation at acquisition; it does not adjudicate individual customer refunds or lock-period cancellations.',
        'Starting customer cohorts are zero in every preset. No employees or automatic hiring are assumed. Founder compensation is optional and is shown separately from operating overhead; a zero amount is not a claim that founder time has no economic value.',
        'The cost model charges fixed tooling once and adjusts hosting and optional AI support with traffic. Hosting estimates assume the selected plan’s credit allowance is available to this site; team-wide usage can change actual bills. Domain spending is expressed as a monthly equivalent, not an assertion that it is billed monthly.',
        'Allocated and incremental cost views differ only in the entered AI subscription cost. Both include the configured hosting, domain, operating API budget, other tools, and usage-based support. No subscription ownership or actual expense is inferred from a planning input.',
        'Any per-customer commission cap is applied to gross eligible commission before reversals, using the fixed monthly price assumption. It stops future eligible payments for surviving customers once that cap is reached.',
        'An annual program commission cap applies to earned commissions before the payout delay. Calendar-year boundaries use the selected startingCalendarMonth (January by default); cap-limited commissions are shown separately from reversals.',
        'Included monthly hosting credits reset each month on the modeled Personal and base Pro plans. Unused purchased top-up credits carry into later months; no existing purchased balance is assumed at the start.',
        'Expiry ends commission eligibility, not the customer’s subscription. Churn also continues to reduce surviving customer counts after expiry.',
        'No scenario assumes Seller Insider Hub has been approved for a vendor affiliate program.'
      ]};
  }

  return Object.freeze({simulate, scenarioInputs, allocateStack, PRESETS, SCENARIOS, DEFAULTS, FORMULAS});
});
