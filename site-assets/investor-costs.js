/* Solo-founder operating-cost model. All amounts USD; no network or storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SIHInvestorCosts = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PLANS = Object.freeze({
    free: Object.freeze({label: 'Netlify Free', planMonthly: 0, includedCredits: 300,
      creditPackSize: 0, creditPackPrice: 0, canTopup: false}),
    personal: Object.freeze({label: 'Netlify Personal', planMonthly: 9, includedCredits: 1000,
      creditPackSize: 500, creditPackPrice: 5, canTopup: true}),
    pro: Object.freeze({label: 'Netlify Pro', planMonthly: 20, includedCredits: 3000,
      creditPackSize: 1500, creditPackPrice: 10, canTopup: true})
  });
  const HOSTING_DEFAULTS = Object.freeze({
    ...PLANS.personal, creditsPerGB: 20, creditsPer10kRequests: 2,
    creditsPerDeploy: 15, deploysMonthly: 8, computeGBHours: 0, creditsPerComputeGBHour: 10
  });
  const DEFAULTS = Object.freeze({
    costView: 'allocated', domainAnnual: 11.08,
    aiToolsMonthly: 60, aiToolsAllocationPct: 100, aiIncrementalMonthly: 0, aiApiMonthly: 25,
    emailMonthly: 0, analyticsMonthly: 0, automationMonthly: 0, otherFixedMonthly: 0,
    founderPayMonthly: 0, pageviewsPerVisit: 2, megabytesPerPage: 0.5,
    requestsPerPage: 8, nonVisitorUsagePct: 20,
    supportContactsPer1000Visits: 0, supportCostPerContact: 0.05,
    hosting: HOSTING_DEFAULTS
  });

  function finite(value, name, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(name + ' must be a finite number between ' + min + ' and ' + max + '.');
    }
    return value;
  }
  function normalise(config) {
    if (config === undefined) config = {};
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('Cost configuration must be an object.');
    const p = {...DEFAULTS, ...config};
    if (config.hosting !== undefined && (!config.hosting || typeof config.hosting !== 'object' || Array.isArray(config.hosting))) throw new TypeError('Hosting configuration must be an object.');
    p.hosting = {...HOSTING_DEFAULTS, ...(config.hosting || {})};
    if (!['allocated', 'incremental'].includes(p.costView)) throw new RangeError('costView must be allocated or incremental.');
    ['domainAnnual', 'aiToolsMonthly', 'aiIncrementalMonthly', 'aiApiMonthly', 'emailMonthly',
      'analyticsMonthly', 'automationMonthly', 'otherFixedMonthly', 'founderPayMonthly',
      'pageviewsPerVisit', 'megabytesPerPage', 'requestsPerPage', 'supportContactsPer1000Visits', 'supportCostPerContact'
    ].forEach(k => finite(p[k], k, 0, 1e12));
    finite(p.aiToolsAllocationPct, 'aiToolsAllocationPct', 0, 100);
    finite(p.nonVisitorUsagePct, 'nonVisitorUsagePct', 0, 10000);
    ['planMonthly', 'includedCredits', 'creditsPerGB', 'creditsPer10kRequests', 'creditsPerDeploy',
      'deploysMonthly', 'creditPackSize', 'creditPackPrice', 'computeGBHours', 'creditsPerComputeGBHour'
    ].forEach(k => finite(p.hosting[k], 'hosting.' + k, 0, 1e12));
    if (typeof p.hosting.canTopup !== 'boolean') throw new TypeError('hosting.canTopup must be a boolean.');
    if (p.hosting.canTopup && p.hosting.creditPackSize <= 0) throw new RangeError('A hosting plan that can top up must have a positive creditPackSize.');
    return p;
  }

  function evaluate(config, visits, creditCarryIn) {
    const p = normalise(config);
    finite(visits, 'visits', 0, 1e15);
    if (creditCarryIn === undefined) creditCarryIn = 0;
    finite(creditCarryIn, 'creditCarryIn', 0, 1e15);
    const h = p.hosting;
    const usageMultiplier = 1 + p.nonVisitorUsagePct / 100;
    const pageviews = visits * p.pageviewsPerVisit;
    const bandwidthGB = pageviews * p.megabytesPerPage / 1000 * usageMultiplier;
    const webRequests = pageviews * p.requestsPerPage * usageMultiplier;
    const bandwidthCredits = bandwidthGB * h.creditsPerGB;
    const requestCredits = webRequests / 10000 * h.creditsPer10kRequests;
    const deploymentCredits = h.deploysMonthly * h.creditsPerDeploy;
    const computeCredits = h.computeGBHours * h.creditsPerComputeGBHour;
    const usageCredits = bandwidthCredits + requestCredits + deploymentCredits + computeCredits;
    const allowanceExceededCredits = Math.max(0, usageCredits - h.includedCredits);
    const carriedCreditsUsed = Math.min(creditCarryIn, allowanceExceededCredits);
    const overageCredits = Math.max(0, allowanceExceededCredits - carriedCreditsUsed);
    // Small floating-point error must not buy an additional pack on an exact boundary.
    const topupPacks = h.canTopup ? Math.max(0, Math.ceil(overageCredits / h.creditPackSize - 1e-10)) : 0;
    const topupCost = topupPacks * h.creditPackPrice;
    const hostingCost = h.planMonthly + topupCost;
    const hostingCapacityExceeded = !h.canTopup && overageCredits > 1e-8;
    // Monthly included credits reset; purchased packs have no fixed expiration date.
    const creditCarryOut = Math.max(0, creditCarryIn - carriedCreditsUsed + topupPacks * h.creditPackSize - (h.canTopup ? overageCredits : 0));
    const domainMonthly = p.domainAnnual / 12;
    const allocatedAiTools = p.aiToolsMonthly * p.aiToolsAllocationPct / 100;
    const aiToolsCost = p.costView === 'incremental' ? p.aiIncrementalMonthly : allocatedAiTools;
    const commonFixed = domainMonthly + p.aiApiMonthly + p.emailMonthly + p.analyticsMonthly + p.automationMonthly + p.otherFixedMonthly;
    const fixedCoreCosts = commonFixed + aiToolsCost;
    const supportContacts = visits * p.supportContactsPer1000Visits / 1000;
    const aiSupportCost = supportContacts * p.supportCostPerContact;
    const coreOperatingCosts = fixedCoreCosts + hostingCost + aiSupportCost;
    const allocatedCoreOperatingCosts = commonFixed + allocatedAiTools + hostingCost + aiSupportCost;
    const incrementalCoreOperatingCosts = commonFixed + p.aiIncrementalMonthly + hostingCost + aiSupportCost;
    const founderPay = p.founderPayMonthly;
    const lineItems = [
      {id: 'hosting', label: h.label || 'Hosting', amount: hostingCost},
      {id: 'domain', label: 'Domain, monthly equivalent', amount: domainMonthly},
      {id: 'ai-tools', label: p.costView === 'incremental' ? 'Additional AI subscription spending' : 'Allocated AI subscriptions', amount: aiToolsCost},
      {id: 'ai-api', label: 'AI/API operating budget', amount: p.aiApiMonthly},
      {id: 'email', label: 'Email', amount: p.emailMonthly},
      {id: 'analytics', label: 'Analytics', amount: p.analyticsMonthly},
      {id: 'automation', label: 'Automation tools', amount: p.automationMonthly},
      {id: 'other', label: 'Other recurring costs', amount: p.otherFixedMonthly},
      {id: 'ai-support', label: 'Usage-based AI support', amount: aiSupportCost},
      {id: 'employees', label: 'Employee payroll', amount: 0}
    ];
    const result = {visits, pageviews, bandwidthGB, webRequests, bandwidthCredits, requestCredits,
      deploymentCredits, computeCredits, usageCredits, allowanceExceededCredits, overageCredits, topupPacks, topupCost,
      creditCarryIn, carriedCreditsUsed, creditCarryOut,
      hostingCost, hostingCapacityExceeded, domainMonthly, allocatedAiTools, aiToolsCost,
      fixedCoreCosts, supportContacts, aiSupportCost, employeePayroll: 0, founderPay,
      coreOperatingCosts, allocatedCoreOperatingCosts, incrementalCoreOperatingCosts,
      totalBeforeFounderPay: coreOperatingCosts, totalWithFounderPay: coreOperatingCosts + founderPay,
      unusedCredits: Math.max(0, h.includedCredits - usageCredits) + creditCarryOut,
      lineItems, assumptions: p};
    if (Object.values(result).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new RangeError('Cost inputs produce values too large to model safely.');
    return result;
  }

  return Object.freeze({evaluate, normalise, DEFAULTS, PLANS, HOSTING_DEFAULTS});
});
