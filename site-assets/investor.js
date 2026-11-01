(function () {
  'use strict';
  const M=window.SIHInvestorModel, C=window.SIHInvestorCosts, K=window.SIHInvestorMarket;
  const data=JSON.parse(document.getElementById('investor-data').textContent), research=data.research, costResearch=data.costs;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
  const marginLabel=value=>value<100&&value>99.99?'>99.99%':num(value,2)+'%';
  const precise=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const num=(value,digits)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:digits==null?1:digits}).format(value);
  const compact=(value,currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency:currency||'USD',notation:'compact',maximumFractionDigits:1}).format(value);
  const programById=Object.fromEntries(research.programs.map(p=>[p.id,p]));
  const modelPrograms=research.programs.filter(p=>p.modelEligible&&p.model);
  const numericKeys=['months','monthlyVisits','trafficGrowthPct','maxMonthlyVisits','merchantClickPct','clickToPaidPct','approvalPct','reversalPct','monthlyPrice','commissionPct','churnPct','commissionMonths','payoutDelayMonths','payoutMinimum','payoutMinimumCustomers','monthlyMarketingSpend','setupCost','startingCash','oneTimeCommission','paidTrafficPct','costPerPaidVisit','paidToolsPerBusiness','stackExpansionDelayMonths'];
  const costKeys=['domainAnnual','aiToolsMonthly','aiToolsAllocationPct','aiIncrementalMonthly','aiApiMonthly','emailMonthly','analyticsMonthly','automationMonthly','otherFixedMonthly','founderPayMonthly','pageviewsPerVisit','megabytesPerPage','requestsPerPage','nonVisitorUsagePct','supportContactsPer1000Visits','supportCostPerContact'];
  const audienceKeys=['monthlyVisits','trafficGrowthPct','maxMonthlyVisits','merchantClickPct','clickToPaidPct','approvalPct','reversalPct','churnPct'];
  let preset='growing_publication',result=null,inputState=null,timer=null;
  let marketOutcome=null,marketRows=[],marketTargets=[],marketYieldRows=[],marketTimer=null,financialInputsValid=false;
  const portfolio=Object.fromEntries(modelPrograms.map(p=>[p.id,{included:!!p.defaultMixEligible,weight:1,price:p.model.monthlyPrice||0}]));
  const categoryLabel=s=>String(s||'Software').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const termLabel=p=>p.commissionSummary||p.commissionLabel||p.summary;
  const condition=p=>p.defaultExclusionReason||p.requiredOperatingCostNote||p.conditionAssumed||p.eligibilityNote||p.caveats?.[0]||'Application and continued eligibility required.';
  const textCondition=p=>{const v=condition(p);return Array.isArray(v)?v.join(' '):typeof v==='object'?JSON.stringify(v):v;};
  const statusLabel={verified_cash:'Published cash offer',terms_unpublished:'Agreement required',credit_only:'Credit / non-cash benefit',application_paused:'Closed or inactive',no_public_program_verified:'No public cash offer verified'};

  function configureEvidence(){
    modelPrograms.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;$('program').appendChild(o);});
    $('benchmark-cards').innerHTML=research.benchmarks.map(b=>{
      const v=b.netIncome==null?b.otherMetrics.adjustedEbitda:b.netIncome;
      return '<article class="benchmark-card"><p class="period">'+esc(b.period)+' · '+esc(b.currency)+'</p><h3>'+esc(b.company)+'</h3><div class="benchmark-values"><div><strong>'+compact(b.revenue,b.currency)+'</strong><span>Reported revenue</span></div><div><strong>'+compact(v,b.currency)+'</strong><span>'+(b.netIncome==null?'Adjusted EBITDA · not net income':'GAAP net income')+'</span></div></div><p>'+esc(b.company==='Future plc'?'A diversified specialist-media group with advertising, subscriptions, ecommerce, and comparison businesses. Adjusted EBITDA is not net income. These results use a different currency and reporting period and do not establish Seller Insider Hub’s prospective margin.':b.caveat)+'</p><a class="benchmark-source" href="'+esc(b.sourceUrls[0])+'" target="_blank" rel="noopener noreferrer">Company-reported results · '+esc(b.publishedAt)+' ↗</a></article>';
    }).join('');
    const links=new Map();research.programs.forEach(p=>p.sourceUrls.forEach((u,i)=>links.set(u,p.name+(i?' · terms / details':' · official evidence'))));
    research.benchmarks.forEach(b=>b.sourceUrls.forEach(u=>links.set(u,b.company+' · reported results')));
    $('program-sources').innerHTML=Array.from(links).map(([u,t])=>'<li><a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(t)+' ↗</a></li>').join('');
    $('cost-sources').innerHTML=costResearch.sources.map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+' ↗</a> — '+esc(s.supports)+'</li>').join('');
    const keys=['visits','conversions','cohorts','expiry','recurring','oneTime','reversals','cash','costs','results','breakEven'];
    $('formula-list').innerHTML=keys.filter(k=>M.FORMULAS[k]).map(k=>'<li>'+esc(M.FORMULAS[k])+'</li>').join('');
    drawInventory();drawPortfolioEditor();
  }
  function drawInventory(){
    const q=$('program-search').value.trim().toLowerCase(),filter=$('program-filter').value;
    const list=research.programs.filter(p=>{
      if(q&&!([p.name,p.category,p.summary,termLabel(p)].join(' ').toLowerCase().includes(q)))return false;
      if(filter==='model'&&!p.modelEligible)return false;
      if(filter==='recurring'&&(!p.modelEligible||p.model.commissionType!=='recurring'))return false;
      if(filter==='cash'&&p.status!=='verified_cash')return false;
      if(filter==='restricted'&&p.modelEligible&&p.defaultMixEligible)return false;
      return true;
    });
    $('inventory-count').textContent=list.length+' of '+research.programs.length+' tools · '+modelPrograms.length+' model-ready offers';
    $('program-cards').innerHTML=list.length?list.map(p=>{
      const assumptions=p.planningAssumptions||p.modelAssumptions;
      const a=Array.isArray(assumptions)?assumptions.join(' '):typeof assumptions==='object'?Object.values(assumptions).map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' '):assumptions||'';
      return '<article class="program-card"><div class="program-meta"><span class="program-kind">'+esc(categoryLabel(p.category))+'</span><span class="status-pill '+(p.modelEligible?'status-cash':'')+'">'+esc(statusLabel[p.status]||p.status)+'</span></div><h3>'+esc(p.name)+'</h3><p class="commission-summary">'+esc(termLabel(p))+'</p><p>'+esc(p.summary)+'</p><details><summary>Eligibility, payout &amp; assumptions</summary><div><p>'+esc(p.terms?.eligibility||textCondition(p))+'</p><p>'+esc(p.terms?.payoutSummary||'No settlement schedule assumed.')+'</p>'+(p.caveats||[]).map(v=>'<p>'+esc(v)+'</p>').join('')+(a?'<p><strong>Model assumptions:</strong> '+esc(a)+'</p>':'')+'</div></details><div class="program-links"><a href="'+esc(p.applicationUrl)+'" target="_blank" rel="noopener noreferrer">Program / eligibility ↗</a><a href="'+esc(p.catalogUrl)+'">Read our guide ↗</a></div>'+(p.modelEligible?'<button type="button" class="try-program" data-use-program="'+esc(p.id)+'">Model this offer ↑</button>':'')+'</article>';
    }).join(''):'<p class="empty-state">No tools match this filter. Try another name or choose All tools.</p>';
  }
  function drawPortfolioEditor(){
    $('portfolio-rows').innerHTML=modelPrograms.map(p=>{
      const st=portfolio[p.id],rec=p.model.commissionType==='recurring';
      return '<tr data-program-row="'+esc(p.id)+'"><th scope="row"><label class="program-check"><input type="checkbox" data-include="'+esc(p.id)+'" '+(st.included?'checked':'')+'><span>'+esc(p.name)+'<small>'+esc(categoryLabel(p.category))+'</small></span></label></th><td><input type="number" aria-label="'+esc(p.name)+' referral weight" data-weight="'+esc(p.id)+'" min="0" max="10000" step="0.5" value="'+st.weight+'"></td><td>'+(rec?'<input type="number" aria-label="'+esc(p.name)+' customer monthly spend" data-price="'+esc(p.id)+'" min="0" max="100000" step="1" value="'+st.price+'">':'<span class="not-applicable">One-time bounty</span>')+'</td><td class="term-cell">'+esc(termLabel(p))+'</td><td class="condition-cell">'+esc(textCondition(p))+' <a href="'+esc(p.sourceUrls[0])+'" target="_blank" rel="noopener noreferrer">Source ↗</a></td></tr>';
    }).join('');
  }
  function setPortfolio(mode){
    const workflow={hubspot:20,pipedrive:10,make:10,mailerlite:10,kit:10,semrush:15,tidio:10,'getresponse':10,'shopify':5};
    modelPrograms.forEach(p=>{
      const st=portfolio[p.id];st.weight=mode==='workflow'?(workflow[p.id]||1):1;
      st.included=mode==='complete'?true:mode==='recurring'?!!p.defaultMixEligible&&p.model.commissionType==='recurring':mode==='workflow'?!!workflow[p.id]:!!p.defaultMixEligible;
    });
    $('program').value='mix';drawPortfolioEditor();showStructure();update();
  }
  function numberInput(id){const el=$(id);if(!el||el.value.trim()==='')throw new Error('Complete the numeric inputs before using results.');const n=Number(el.value);if(!Number.isFinite(n))throw new Error('Enter a valid number.');return n;}
  function readCosts(){
    const cfg={};costKeys.forEach(k=>cfg[k]=numberInput('cost-'+k));cfg.costView=$('cost-costView').value;
    cfg.hosting={...costResearch.hostingMeter,...C.PLANS[$('cost-hostingPlan').value],deploysMonthly:numberInput('cost-deploysMonthly'),computeGBHours:numberInput('cost-computeGBHours')};return C.normalise(cfg);
  }
  function readInputs(){
    const input={},mix=$('program').value==='mix',one=$('commissionType').value==='one-time';
    const inactive=new Set(mix?['monthlyPrice','commissionPct','oneTimeCommission','commissionMonths','payoutDelayMonths','payoutMinimum','payoutMinimumCustomers']:one?['monthlyPrice','commissionPct','commissionMonths','churnPct']:['oneTimeCommission']);
    if(!mix){inactive.add('paidToolsPerBusiness');inactive.add('stackExpansionDelayMonths');}
    numericKeys.forEach(k=>{if(!inactive.has(k))input[k]=numberInput(k);});if(!mix){input.paidToolsPerBusiness=1;input.stackExpansionDelayMonths=0;}
    input.commissionType=$('commissionType').value;input.fixedMonthlyCosts=0;input.costConfig=readCosts();input.startingCalendarMonth=1;
    if(mix){
      modelPrograms.filter(p=>portfolio[p.id].included).forEach(p=>{const w=portfolio[p.id].weight;if(!Number.isFinite(w)||w<0)throw new Error('Enter a nonnegative referral weight for '+p.name+'.');});
      const active=modelPrograms.filter(p=>portfolio[p.id].included&&portfolio[p.id].weight>0),total=active.reduce((s,p)=>s+portfolio[p.id].weight,0);
      if(!active.length||!Number.isFinite(total)||total<=0)throw new Error('Select at least one program with a positive referral weight.');
      input.programs=active.map(p=>({id:p.id,name:p.name,...p.model,sharePct:portfolio[p.id].weight/total*100,monthlyPrice:portfolio[p.id].price,churnPct:input.churnPct,approvalPct:input.approvalPct,reversalPct:input.reversalPct}));
      $('portfolio-summary').textContent=active.length+' selected programs · '+active.filter(p=>p.model.commissionType==='recurring').length+' recurring offers · distinct tools per business are capped by the selected vendors.';
      $('portfolio-count').textContent=active.length+' selected · one purchase maximum per vendor / business';
    }else{
      const p=programById[$('program').value];if(p){input.commissionCapPerCustomer=p.model.commissionCapPerCustomer||0;input.annualCommissionCap=p.model.annualCommissionCap||0;input.programs=[{...input,id:p.id,name:p.name,sharePct:100}];delete input.programs[0].costConfig;}
      $('portfolio-count').textContent='Single-offer view selected. Choose Full-site portfolio to combine the checked programs.';
    }
    return input;
  }
  function setInputs(values){numericKeys.forEach(k=>{if($(k)&&values[k]!==undefined)$(k).value=values[k];});if(values.commissionType)$('commissionType').value=values.commissionType;}
  function showStructure(){
    const mix=$('program').value==='mix',one=$('commissionType').value==='one-time';
    $('mix-controls').hidden=!mix;$('single-program').hidden=mix;$('recurring-inputs').hidden=one;$('term-input').hidden=one;$('one-time-input').hidden=!one;$('threshold-inputs').hidden=mix;$('payoutDelayMonths').disabled=mix;$('churnPct').disabled=!mix&&one;
  }
  function applyProgram(){
    const p=programById[$('program').value];if(p)setInputs(p.model);
    $('program-note').textContent=p?p.summary+' Plan spend and some settlement inputs are assumptions. Changes to these fields are custom scenarios. '+textCondition(p):$('program').value==='mix'?'A new business can purchase several complementary tools. Three paid tools is the default scenario assumption, with later purchases after two months. Acceptance and ongoing eligibility must be maintained; some settlement inputs are assumptions.':'Editable custom assumptions. A modeled rate is not evidence of approval.';
    showStructure();update();
  }
  function applyPreset(key){
    preset=key;const p=M.PRESETS[key];if(!p)return;audienceKeys.forEach(k=>{if(p.inputs[k]!==undefined)$(k).value=p.inputs[k];});
    $('preset-description').textContent=p.description+' Your program selection, software budget, founder pay, and optional marketing spend stay unchanged.';
    document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===key)));
    $('selected-month').value=$('months').value;update();
  }
  function applyCostPreset(key){
    const cfg={...costResearch.defaults};if(key==='existing'){cfg.costView='incremental';cfg.aiIncrementalMonthly=0;cfg.aiApiMonthly=0;}if(key==='support'){cfg.aiToolsMonthly=200;cfg.aiApiMonthly=100;cfg.supportContactsPer1000Visits=5;cfg.supportCostPerContact=.05;}
    costKeys.forEach(k=>{if(k!=='founderPayMonthly')$('cost-'+k).value=cfg[k];});$('cost-costView').value=cfg.costView;
    document.querySelectorAll('[data-cost-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.costPreset===key)));update();
  }
  function update(){
    try{
      const input=readInputs(),next=M.simulate(input);inputState=input;result=next;financialInputsValid=true;
      $('model-error').hidden=true;document.querySelector('.results-panel').classList.remove('output-stale');
      document.querySelectorAll('.cost-workbench,.scale-opportunity,.comparison-panel,.goal-section').forEach(e=>e.classList.remove('output-stale'));
      ['export-csv','export-json','print-model'].forEach(id=>$(id).disabled=false);
      $('selected-month').max=input.months;if(Number($('selected-month').value)>input.months)$('selected-month').value=input.months;
      $('result-period').textContent=input.months+' MONTHS';document.querySelectorAll('.horizon-label').forEach(e=>e.textContent='At month '+input.months);
      drawSelected();drawCohorts();drawSensitivity();drawLedger();drawScale();drawEligibility();drawMarket();drawGoal();
    }catch(error){
      $('model-error').textContent=error.message+' Outputs are paused until the inputs are valid.';$('model-error').hidden=false;
      document.querySelector('.results-panel').classList.add('output-stale');document.querySelectorAll('.cost-workbench,.scale-opportunity,.comparison-panel,.goal-section').forEach(e=>e.classList.add('output-stale'));
      financialInputsValid=false;invalidateMarket('The financial inputs need correction before market-share results can be calculated.');drawGoal();
      ['export-csv','export-json','print-model'].forEach(id=>$(id).disabled=true);
    }
  }
  function renderValue(id,value,formatter){$(id).textContent=(formatter||money)(value);$(id).classList.toggle('negative',value<0);}
  function drawSelected(){
    if(!result)return;const month=Math.max(1,Math.min(result.months.length,Number($('selected-month').value))),row=result.months[month-1];
    $('selected-month-value').textContent=month;renderValue('kpi-commission',row.earnedCommission);renderValue('kpi-profit',row.beforeFounderResult);renderValue('kpi-cash',row.cumulativeCashReceived);renderValue('kpi-active',row.activeCommissionableCustomers,v=>num(v,1));
    $('kpi-commission-note').textContent='Earned in month '+month+' · after deductions and caps';
    $('break-even').textContent=result.breakEven.operatingMonth?'Month '+result.breakEven.operatingMonth:'Not reached';$('funding-needed').textContent=money(result.totals.fundingRequired);renderValue('ending-cash',row.cashBalance);
    $('funding-note').textContent='Peak modeled cash gap before starting cash: '+money(result.totals.fundingRequired)+'. Additional cash beyond the '+money(inputState.startingCash)+' starting balance: '+money(result.totals.additionalFundingRequired)+'. No tax, contingency, or investor return is included.';
    $('month-detail').textContent='Month '+month+': '+money(row.newCommission)+' from new referrals + '+money(row.renewalCommission)+' from renewals. '+money(row.cashReceived)+' paid; '+money(row.totalCosts)+' total costs including '+money(row.founderPay)+' founder pay. '+num(row.churnedCustomers,1)+' expected subscriptions churned; '+num(row.expiredCustomers,1)+' reached their commission limit.';
    $('funnel-month').textContent='Month '+month;$('funnel').innerHTML=[[num(row.visits,0),'Reader visits'],[num(row.newBuyerBusinesses,1),'New purchasing businesses'],[num(row.stackExpansionReferrals,1),'Later-tool opportunities'],[num(row.newApprovedCustomers,1),'Approved tool referrals'],[money(row.newCommission),'First-payment commission']].map(([v,l])=>'<div><strong>'+v+'</strong><small>'+l+'</small></div>').join('');
    const margin=row.earnedCommission>0?marginLabel(row.beforeFounderResult/row.earnedCommission*100):'—';
    $('lean-result').innerHTML='<div><span>Core overhead</span><strong>'+money(row.coreOperatingCosts)+'</strong></div><div><span>Surplus after founder pay</span><strong class="'+(row.afterFounderResult<0?'negative':'')+'">'+money(row.afterFounderResult)+'</strong></div><div><span>Before-pay operating margin</span><strong>'+margin+'</strong></div><p>Employee payroll: $0. Founder compensation: '+money(row.founderPay)+'. Margin is based on earned commissions, before tax; cash follows the payout schedule.</p>';
    $('program-results-note').textContent='Month '+month+' · first purchases + later stack additions · settlement inputs partly assumed';
    $('program-results').innerHTML=row.programs.slice().sort((a,b)=>b.earnedCommission-a.earnedCommission).map(p=>'<tr><th scope="row">'+esc(p.label)+'</th><td>'+num(p.realizedReferralSharePct==null?p.sharePct:p.realizedReferralSharePct,1)+'%</td><td>'+money(p.newCommission)+'</td><td>'+money(p.renewalCommission)+'</td><td>'+money(p.earnedCommission)+'</td><td>'+money(p.cashReceived)+'</td></tr>').join('');
    $('stack-explainer').textContent='For every 100 new purchasing businesses, this scenario models 100 first-tool purchases plus '+num((inputState.paidToolsPerBusiness-1)*100,0)+' later-tool purchases after '+inputState.stackExpansionDelayMonths+' months, before attribution approvals and reversals.';
    drawCosts(row);drawComparison(row);drawChart(month);
  }
  function drawCosts(row){
    const c=row.costDetails;renderValue('cost-core',c.coreOperatingCosts,precise);renderValue('cost-marketing',row.marketingCost,precise);renderValue('cost-founder',row.founderPay,precise);renderValue('cost-total',row.operatingCosts+row.founderPay,precise);
    $('cost-month-note').textContent='Month '+row.month+' · excludes setup and tax';
    $('cost-breakdown').innerHTML=c.lineItems.filter(l=>l.amount>0||l.id==='employees').map(l=>'<div><span>'+esc(l.label)+'</span><strong>'+precise(l.amount)+'</strong></div>').join('');
    $('hosting-note').textContent='Month '+row.month+': '+num(c.bandwidthGB,1)+' GB, '+num(c.webRequests,0)+' requests, '+num(c.usageCredits,1)+' credits; '+money(c.topupCost)+' additional credit packs. Purchased credits carry forward. Auto recharge is currently disabled in the real hosting account; serving traffic beyond its allowance would require additional credits or a plan change. This calculator makes neither change.';
    $('hosting-capacity-warning').hidden=!result.hostingCapacityExceeded;$('hosting-capacity-warning').textContent='The Free plan cannot serve the entire modeled traffic within its hard credit limit. Its zero hosting charge is not a feasible cost for this scenario. Select Personal or Pro to model sufficient capacity.';
    const cfg=inputState.costConfig;
    $('hosting-scale').innerHTML=[1000,10000,100000,1000000].map(visits=>{const personal=C.evaluate({...cfg,hosting:{...cfg.hosting,...C.PLANS.personal}},visits),pro=C.evaluate({...cfg,hosting:{...cfg.hosting,...C.PLANS.pro}},visits);return '<tr><th scope="row">'+num(visits,0)+'</th><td>'+num(pro.bandwidthGB,0)+' GB</td><td>'+precise(personal.hostingCost)+'</td><td>'+precise(pro.hostingCost)+'</td><td>'+precise(pro.coreOperatingCosts)+'</td><td>$0</td></tr>';}).join('');
  }
  function drawComparison(row){
    const nw=costResearch.nerdwallet;const vals=[['Revenue',compact(nw.revenue),money(row.earnedCommission)],['Delivery / core operations',compact(nw.costOfRevenue)+' cost of revenue',precise(row.coreOperatingCosts)+' core cost'],['Research & development',compact(nw.researchDevelopment),'Founder + entered AI budget'],['Sales & marketing',compact(nw.salesMarketing),money(row.marketingCost)+' entered spend'],['General & administrative',compact(nw.generalAdministrative),'Entered in other costs / founder pay'],['Total operating cost',compact(nw.totalCostsExpenses),precise(row.totalCosts)+' including founder pay / setup'],['Operating result',compact(nw.operatingIncome)+' GAAP',money(row.afterFounderResult)+' modeled pre-tax']];
    $('cost-comparison').innerHTML='<div class="table-scroll" tabindex="0"><table><thead><tr><th>Cost structure</th><th>NerdWallet · Q2 2026 reported</th><th>Seller Insider Hub · model month '+row.month+'</th></tr></thead><tbody>'+vals.map(([a,b,c])=>'<tr><th scope="row">'+a+'</th><td>'+b+'</td><td>'+c+'</td></tr>').join('')+'</tbody></table></div><div class="comparison-takeaway"><strong>The advantage is the low break-even requirement.</strong><p>At this month’s traffic, the model needs '+money(row.operatingCosts)+' in earned commission to cover recurring operating costs, or '+money(row.operatingCosts+row.founderPay)+' including the chosen founder pay. There is no automatic payroll layer as the audience grows. Acquiring and retaining that audience still determines the revenue outcome.</p></div>';
  }
  function drawChart(selectedMonth) {
    const rows = result.months, mode = $('chart-view').value, width = 760, height = 290, left = 65, right = 15, top = 20, bottom = 35;
    const plotW = width-left-right, plotH = height-top-bottom, count = rows.length;
    const x = i => left + (count === 1 ? plotW/2 : i*plotW/(count-1));
    let series, min = 0, max = 1;
    if (mode === 'commissions') {
      series = [{key:'earnedCommission',label:'Total commission',color:'#234d3b'},{key:'newCommission',label:'New referrals',color:'#b3d16a'},{key:'totalCosts',label:'Modeled costs',color:'#ac6c53'}];
      $('chart-title').textContent = 'How commissions accumulate'; $('chart-description').textContent = 'New referrals plus renewing cohorts, against modeled costs.';
    } else if (mode === 'cash') {
      series = [{key:'cumulativeEarned',label:'Cumulative earned',color:'#234d3b'},{key:'cumulativeCashReceived',label:'Cumulative paid',color:'#7188ab'},{key:'cumulativeCosts',label:'Cumulative costs',color:'#ac6c53'}];
      $('chart-title').textContent = 'Earnings and cash are different'; $('chart-description').textContent = 'Payment delays and minimum balances separate earned commission from cash.';
    } else {
      series = [{key:'cashBalance',label:'Cash balance',color:'#234d3b'}];
      $('chart-title').textContent = 'Can the business fund itself?'; $('chart-description').textContent = 'Starting cash plus payments received, less all modeled costs.';
    }
    series.forEach(s => rows.forEach(r => {max=Math.max(max,r[s.key]);min=Math.min(min,r[s.key]);}));
    max *= 1.12; if (min < 0) min *= 1.1;
    const y = value => top + (max-value)/(max-min)*plotH;
    const line = (key) => rows.map((r,i) => (i ? 'L' : 'M') + x(i).toFixed(2) + ',' + y(r[key]).toFixed(2)).join(' ');
    let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><title>' + esc($('chart-title').textContent) + '</title>';
    for (let tick=0;tick<=4;tick++) {
      const value = min + (max-min)*tick/4, yy = y(value);
      svg += '<line class="grid-line" x1="' + left + '" x2="' + (width-right) + '" y1="' + yy + '" y2="' + yy + '"/><text x="' + (left-9) + '" y="' + (yy+4) + '" text-anchor="end">' + esc(compact(value)) + '</text>';
    }
    const marks = [...new Set([0,Math.round((count-1)/4),Math.round((count-1)/2),Math.round(3*(count-1)/4),count-1])];
    marks.forEach(i => {svg += '<text x="' + x(i) + '" y="' + (height-9) + '" text-anchor="middle">M' + (i+1) + '</text>';});
    if (mode === 'commissions') {
      const lower = rows.map((r,i) => 'L' + x(rows.length-1-i).toFixed(2) + ',' + y(rows[rows.length-1-i].newCommission).toFixed(2)).join(' ');
      svg += '<path d="' + line('earnedCommission') + ' ' + lower + ' Z" fill="#234d3b" fill-opacity=".18"/>';
      svg += '<path d="' + line('newCommission') + ' L' + x(count-1) + ',' + y(0) + ' L' + x(0) + ',' + y(0) + ' Z" fill="#b3d16a" fill-opacity=".46"/>';
    }
    if (mode === 'balance') svg += '<line class="zero-line" x1="' + left + '" x2="' + (width-right) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    series.forEach(s => {svg += '<path d="' + line(s.key) + '" fill="none" stroke="' + s.color + '" stroke-width="2.4"' + (s.key.toLowerCase().includes('cost') ? ' stroke-dasharray="5 5"' : '') + '/>';});
    const index=selectedMonth-1, activeX=x(index);
    svg += '<line class="selected-line" x1="' + activeX + '" x2="' + activeX + '" y1="' + top + '" y2="' + (height-bottom) + '"/>';
    series.forEach(s => {svg += '<circle cx="' + activeX + '" cy="' + y(rows[index][s.key]) + '" r="4" fill="' + s.color + '" stroke="white" stroke-width="2"><title>' + esc(s.label + ': ' + money(rows[index][s.key])) + '</title></circle>';});
    svg += '</svg>';
    $('chart').innerHTML = svg;
    $('chart').setAttribute('aria-label',$('chart-title').textContent + '. Month ' + selectedMonth + ': ' + series.map(s => s.label + ' ' + money(rows[index][s.key])).join('; ') + '. The complete data is in the month-by-month ledger.');
    const legend = mode === 'commissions' ? [['green','Total commission · area includes renewals'],['lime','New referrals'],['rust','Modeled costs']] : mode === 'cash' ? [['green','Cumulative earned'],['blue','Cumulative paid'],['rust','Cumulative costs']] : [['green','Cash balance']];
    $('chart-legend').innerHTML = legend.map(([color,label]) => '<span class="legend-item"><i class="swatch ' + color + '" aria-hidden="true"></i>' + label + '</span>').join('');
  }

  function drawCohorts() {
    const shown = Math.min(24,inputState.months);
    const max = Math.max(1,...result.cohortMatrix.flatMap(r => r.values.slice(0,shown)));
    let html = '<table class="cohort-table"><caption>Commission earned by acquisition month. Cells show US dollars rounded to the nearest whole dollar.</caption><thead><tr><th scope="col">Acquired</th>';
    for(let i=1;i<=shown;i++)html += '<th scope="col">' + i + '</th>';
    html += '</tr></thead><tbody>';
    result.cohortMatrix.forEach(row => {
      html += '<tr><th scope="row">Month ' + row.originMonth + '</th>';
      row.values.slice(0,shown).forEach((v,i) => {
        const level = v<=0 ? 0 : Math.max(1,Math.ceil(v/max*6)), label='Referrals from month ' + row.originMonth + ', earned in month ' + (i+1) + ': ' + money(v);
        html += '<td class="heat-' + level + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + esc(money(v)) + '</td>';
      });
      html += '</tr>';
    });
    $('cohort-table').innerHTML = html + '</tbody></table>';
  }


  function invalidateMarket(message){
    marketOutcome=null;marketRows=[];marketTargets=[];marketYieldRows=[];
    $('market-error').textContent=message;$('market-error').hidden=false;$('export-market').disabled=true;
    document.querySelector('.share-output').classList.remove('output-stale');
    ['market-results','market-profit-bridge','market-pool','market-ladder','market-targets','market-yield-sensitivity'].forEach(id=>$(id).innerHTML='');
    $('market-cash').textContent='';$('market-period').textContent='';$('market-equation').textContent='Complete valid assumptions to calculate this market-share scenario.';
  }
  function readMarketInputs(){
    return {broadBusinesses:numberInput('market-business-base'),addressablePct:numberInput('market-addressable'),annualBuyerPct:numberInput('market-annual-buyers'),annualCapturePct:numberInput('market-capture'),acquisitionCostPerNewBusiness:numberInput('market-acquisition-cost'),founderPayAnnual:numberInput('market-founder-pay'),otherOperatingAllowanceAnnual:numberInput('market-other-cost')};
  }
  const shareLabel=value=>value==null?'—':num(value,6)+'%';
  function drawMarketEvidence(){
    const evidence=data.market.marketShare;
    $('market-source-note').innerHTML='<strong>Business-base source:</strong> <a href="'+esc(evidence.sourceUrl)+'" target="_blank" rel="noopener noreferrer">SBA, '+esc(evidence.referencePeriod)+' ↗</a>. '+esc(evidence.definition)+' Changing this input creates a custom denominator.';
    $('market-share-evidence').innerHTML=evidence.evidence.map(e=>'<article><p class="evidence-value">'+esc(e.value)+'</p><h3>'+esc(e.title)+'</h3><p>'+esc(e.body)+'</p><a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Primary source ↗</a></article>').join('');
  }
  function drawMarket(){
    if(!financialInputsValid){invalidateMarket('Correct the detailed financial inputs before calculating or exporting market-share results.');return;}
    if(!inputState)return;
    $('market-tools').value=inputState.paidToolsPerBusiness;$('market-horizon').value=inputState.months;
    try{
      const config=readMarketInputs(),out=K.evaluate(config,inputState),annual=out.final12Months;
      marketOutcome=out;marketRows=K.shareLadder(config,inputState);marketTargets=K.solveTargets(config,inputState);
      $('market-error').hidden=true;document.querySelector('.share-output').classList.remove('output-stale');$('export-market').disabled=false;
      $('market-output-label').textContent='ILLUSTRATIVE SCALE · '+shareLabel(out.broadBaseAnnualSharePct)+' OF THE BROAD BASE / YEAR';
      $('market-equation').textContent=shareLabel(config.annualCapturePct)+' × '+num(out.market.annualBuyerBusinesses,0)+' businesses in the selected pool = '+num(out.annualNewBusinesses,0)+' first purchasing businesses each year.';
      const boxes=[[money(annual.afterFounderResult),'Annual operating profit','After selected founder pay · before tax','profit'],[money(annual.earnedCommission),'Annual commission revenue','Earned in the final 12 modeled months','revenue'],[num(out.annualNewBusinesses,0),'New purchasing businesses / year','Each can generate several qualifying purchases','buyers'],[num(out.monthlyVisitsRequired,0),'Required monthly visits','Derived from your click and purchase assumptions','visits']];
      $('market-results').innerHTML=boxes.map(([v,l,n,kind])=>'<article class="share-metric share-metric-'+kind+'"><span>'+l+'</span><strong class="'+(kind==='profit'&&annual.afterFounderResult<0?'negative':'')+'">'+v+'</strong><small>'+n+'</small></article>').join('');
      $('market-period').textContent='Annual period: model months '+out.annualPeriod.startMonth+'–'+out.annualPeriod.endMonth+'. '+inputState.paidToolsPerBusiness+' paid tools per business; '+inputState.stackExpansionDelayMonths+'-month expansion delay; '+num(inputState.merchantClickPct)+'% vendor click × '+num(inputState.clickToPaidPct)+'% first-purchase conversion; '+num(inputState.approvalPct)+'% approval; '+(Number.isFinite(inputState.churnPct)?num(inputState.churnPct)+'% monthly churn on recurring offers':'one-time offer; no renewal churn')+'; '+num(inputState.reversalPct)+'% reversals.';
      const bridge=[['Earned affiliate commissions',annual.earnedCommission],['Customer acquisition allowance',-annual.marketAcquisitionAllowance],['Other entered marketing / paid traffic',-(annual.marketingCost-annual.marketAcquisitionAllowance)],['Infrastructure, AI & entered operating costs',-(annual.coreOperatingCosts-annual.otherOperatingAllowance)],['Additional operating allowance',-annual.otherOperatingAllowance],['Founder compensation',-annual.founderPay],['Setup costs within this annual period',-annual.setupCost],['Operating profit before tax',annual.afterFounderResult]];
      $('market-profit-bridge').innerHTML='<dl>'+bridge.map(([label,value],i)=>'<div class="'+(i===bridge.length-1?'bridge-total':'')+'"><dt>'+label+'</dt><dd>'+money(value)+'</dd></div>').join('')+'</dl><p>'+(annual.operatingMarginAfterFounderPct==null?'—':num(annual.operatingMarginAfterFounderPct,1)+'%')+' modeled operating margin after founder pay. Employee payroll remains $0.</p>';
      $('market-cash').textContent='Cash timing: '+money(annual.cashReceived)+' of commission payments in this annual period; '+money(annual.cashFlow)+' cash surplus after selected costs. Peak funding gap across the complete scenario: '+money(out.fundingRequired)+', before starting capital. Acquisition spending can precede payouts. No contingency or tax reserve is included.';
      $('market-pool').innerHTML='<div><span>Broad business base</span><strong>'+num(config.broadBusinesses,0)+'</strong></div><div><span>Selected audience</span><strong>'+num(out.market.addressableBusinesses,0)+'</strong></div><div><span>Selected annual buyer pool</span><strong>'+num(out.market.annualBuyerBusinesses,0)+'</strong></div><p>'+num(out.cumulativeUniqueBusinesses,0)+' distinct businesses acquired across '+inputState.months+' months = '+shareLabel(out.stockUtilizationPct)+' of the selected audience. These are acquisitions from the existing business population, not newly formed businesses.</p>';
      $('market-ladder-note').textContent='Same '+inputState.paidToolsPerBusiness+'-tool portfolio and '+inputState.months+'-month horizon. Acquisition allowance: '+precise(config.acquisitionCostPerNewBusiness)+' per first purchasing business; annual founder pay: '+money(config.founderPayAnnual)+'; extra operating allowance: '+money(config.otherOperatingAllowanceAnnual)+'. Shares below apply to the selected annual buyer pool; the last column relates them to the broad base.';
      $('market-ladder').innerHTML=marketRows.map(r=>r.feasible?'<tr class="'+(Math.abs(r.requestedAnnualCapturePct-config.annualCapturePct)<1e-10?'selected-share':'')+'"><th scope="row"><button type="button" data-capture-share="'+r.requestedAnnualCapturePct+'">'+shareLabel(r.requestedAnnualCapturePct)+'</button></th><td>'+num(r.annualNewBusinesses,0)+'</td><td>'+num(r.monthlyVisitsRequired,0)+'</td><td>'+money(r.final12Months.earnedCommission)+'</td><td class="'+(r.final12Months.afterFounderResult<0?'negative':'')+'">'+money(r.final12Months.afterFounderResult)+(r.hostingCapacityExceeded?' · hosting capacity exceeded':'')+'</td><td>'+shareLabel(r.broadBaseAnnualSharePct)+'</td></tr>':'<tr><th>'+shareLabel(r.requestedAnnualCapturePct)+'</th><td colspan="5" class="share-unavailable">'+esc(r.reason)+'</td></tr>').join('');
      $('market-targets').innerHTML=marketTargets.map(r=>r.feasible?'<tr><th scope="row"><button type="button" data-capture-share="'+r.requiredAnnualCapturePct+'">'+money(r.targetAnnualCommission)+'</button></th><td>'+num(r.annualNewBusinesses,0)+'</td><td>'+shareLabel(r.broadBaseAnnualSharePct)+'</td><td>'+shareLabel(r.buyerPoolAnnualSharePct)+'</td><td>'+num(r.monthlyVisitsRequired,0)+'</td><td class="'+(r.final12Months.afterFounderResult<0?'negative':'')+'">'+money(r.final12Months.afterFounderResult)+(r.hostingCapacityExceeded?' · hosting capacity exceeded':'')+'</td></tr>':'<tr><th>'+money(r.targetAnnualCommission)+'</th><td colspan="5" class="share-unavailable">'+esc(r.reason)+'</td></tr>').join('');
      const variants=[{tools:1,priceScale:.5},{tools:1,priceScale:1}];if(inputState.paidToolsPerBusiness!==1)variants.push({tools:inputState.paidToolsPerBusiness,priceScale:.5},{tools:inputState.paidToolsPerBusiness,priceScale:1});
      marketYieldRows=variants.map(v=>{const alternative={...inputState,paidToolsPerBusiness:v.tools};if(alternative.programs)alternative.programs=alternative.programs.map(p=>({...p,monthlyPrice:p.commissionType==='recurring'?p.monthlyPrice*v.priceScale:p.monthlyPrice}));else if(alternative.commissionType==='recurring')alternative.monthlyPrice*=v.priceScale;return {label:v.tools+' tool'+(v.tools===1?'':'s')+' · '+(v.priceScale===1?'current recurring spend':'50% recurring spend'),...K.evaluate(config,alternative)};});
      $('market-yield-sensitivity').innerHTML=marketYieldRows.map(r=>'<tr><th scope="row">'+esc(r.label)+'</th><td>'+money(r.final12Months.earnedCommission)+'</td><td class="'+(r.final12Months.afterFounderResult<0?'negative':'')+'">'+money(r.final12Months.afterFounderResult)+'</td></tr>').join('');
      if(out.hostingCapacityExceeded){$('market-error').textContent='The selected Free hosting plan cannot support this traffic. Revenue math is shown, but the cost and profit scenario is not operationally feasible until sufficient hosting capacity is selected.';$('market-error').hidden=false;}
      document.querySelectorAll('[data-market-share]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.marketShare)===config.annualCapturePct)));
    }catch(error){invalidateMarket(error.message);}
  }
  function exportMarket(){
    if(!marketOutcome)return;
    const rows=[['Seller Insider Hub — hypothetical market-share and annual-profit analysis'],['Research checked',data.asOf],['Currency','USD'],['Business base source',data.market.marketShare.sourceUrl],['Business base reference period',data.market.marketShare.referencePeriod],['Market assumptions',JSON.stringify(readMarketInputs())],['Financial assumptions',JSON.stringify(inputState)],['Annual reporting window','Months '+marketOutcome.annualPeriod.startMonth+'–'+marketOutcome.annualPeriod.endMonth],['Hosting capacity',marketOutcome.hostingCapacityExceeded?'INFEASIBLE for selected hosting plan':'Modeled additional credits included'],['Meaning','Annual acquisition from the business base; distinct businesses are not recycled. Results are hypothetical, after selected founder pay and before tax.'],[],['SHARE LADDER'],['Annual capture %','New purchasing businesses/year','Visits/month','Annual earned commission','Annual operating profit','Annual cash received','Annual total costs','Broad-base annual share %','Hosting capacity feasible'],...marketRows.map(r=>r.feasible?[r.requestedAnnualCapturePct,r.annualNewBusinesses,r.monthlyVisitsRequired,r.final12Months.earnedCommission,r.final12Months.afterFounderResult,r.final12Months.cashReceived,r.final12Months.totalCosts,r.broadBaseAnnualSharePct,!r.hostingCapacityExceeded]:[r.requestedAnnualCapturePct,'INFEASIBLE',r.reason]),[],['REVENUE TARGETS'],['Annual revenue target','Annual new businesses','Broad-base share %','Selected-pool share %','Visits/month','Annual operating profit'],...marketTargets.map(r=>r.feasible?[r.targetAnnualCommission,r.annualNewBusinesses,r.broadBaseAnnualSharePct,r.buyerPoolAnnualSharePct,r.monthlyVisitsRequired,r.final12Months.afterFounderResult]:[r.targetAnnualCommission,'INFEASIBLE',r.reason]),[],['CUSTOMER ECONOMICS SENSITIVITY'],['Scenario','Annual earned commission','Annual operating profit'],...marketYieldRows.map(r=>[r.label,r.final12Months.earnedCommission,r.final12Months.afterFounderResult]),[],['MODEL NOTES'],...marketOutcome.notes.map(n=>[n])];
    const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';download('seller-insider-hub-market-share-'+inputState.months+'-months.csv','\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  }
  function setMarketBudget(mode){
    $('market-acquisition-cost').value=mode==='growth'?100:0;$('market-founder-pay').value=mode==='growth'?120000:(inputState?.costConfig.founderPayMonthly||0)*12;$('market-other-cost').value=mode==='growth'?24000:0;document.querySelectorAll('[data-market-budget]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marketBudget===mode)));drawMarket();drawGoal();
  }
  function drawGoal(){
    if(!financialInputsValid||!inputState||!marketOutcome){$('goal-results').textContent='Complete the market-share and financial inputs to use this target.';$('goal-note').textContent='';return;}
    const target=Number($('annual-goal').value);
    if(!Number.isFinite(target)||target<=0){$('goal-results').textContent='Enter a positive annual commission target.';$('goal-note').textContent='';return;}
    try{
      const found=marketTargets.find(r=>r.targetAnnualCommission===target)||K.solveTargets(readMarketInputs(),inputState,[target])[0];
      if(!found.feasible){$('goal-results').textContent=found.reason;$('goal-note').textContent='The limit comes from the selected buyer pool, unique-business stock, program terms, and horizon; it is not a fixed traffic ceiling.';return;}
      const annual=found.final12Months;
      const boxes=[[num(found.monthlyVisitsRequired,0),'Required visits each month'],[num(found.annualNewBusinesses,0),'New purchasing businesses per year'],[shareLabel(found.broadBaseAnnualSharePct),'Annual share of the broad business base'],[money(annual.earnedCommission),'Earned commission in the final 12 months'],[money(annual.totalCosts),'Selected costs in that 12-month window'],[money(annual.afterFounderResult),'Operating profit after founder pay · pre-tax']];
      $('goal-results').innerHTML=boxes.map(([v,l])=>'<article><strong>'+v+'</strong><span>'+l+'</span></article>').join('');
      $('goal-note').textContent='Model months '+found.annualPeriod.startMonth+'–'+found.annualPeriod.endMonth+' · '+inputState.paidToolsPerBusiness+' tools per business · '+inputState.stackExpansionDelayMonths+'-month expansion delay. Uses the buyer-pool and growth-budget settings in Market share. The detailed monthly scenario retains its separately entered operating budget.'+(found.hostingCapacityExceeded?' Selected hosting capacity is insufficient; change the hosting plan before relying on the cost result.':'');
    }catch(error){$('goal-results').textContent=error.message;$('goal-note').textContent='';}
  }
  function drawEligibility(){
    const selected=(inputState.programs||[]).map(p=>programById[p.id]).filter(Boolean);
    const warnings=[];
    if(inputState.paidTrafficPct>0){const restricted=selected.filter(p=>p.trafficRestrictions||['buffer','pabbly','flodesk','n8n'].includes(p.id)).map(p=>p.name);if(restricted.length)warnings.push('Paid-channel eligibility requires review for '+restricted.join(', ')+'. Their agreements restrict paid advertising or particular traffic sources. This projection assumes only qualifying referrals; the selected paid-traffic mix may not qualify.');}
    const conditional=selected.filter(p=>['activecampaign','omnisend'].includes(p.id));if(conditional.length)warnings.push(conditional.map(p=>p.name).join(' and ')+' require ongoing referral activity. The model assumes these requirements remain satisfied and does not enforce the rolling eligibility tests.');
    if(selected.some(p=>p.id==='flodesk'))warnings.push('Flodesk requires an eligible account. Add any necessary subscription cost to Other operating costs.');
    if(selected.some(p=>p.id==='n8n'))warnings.push('n8n uses a modeled $110 payout threshold based on an assumed $1.10 per euro; it is not a current exchange-rate quote.');
    $('program-eligibility-warning').hidden=!warnings.length;$('program-eligibility-warning').textContent=warnings.join(' ');
  }
  function drawScale(){
    $('opportunity-scale').innerHTML=[10000,50000,100000,1000000].map(visits=>{
      const r=M.simulate({...inputState,monthlyVisits:visits,trafficGrowthPct:0,maxMonthlyVisits:visits}),row=r.months[r.months.length-1];
      const margin=row.earnedCommission>0?marginLabel(row.beforeFounderResult/row.earnedCommission*100):'—';
      return '<tr><th scope="row">'+num(visits,0)+'</th><td>'+money(row.earnedCommission)+'</td><td>'+money(row.coreOperatingCosts)+'</td><td class="'+(row.beforeFounderResult<0?'negative':'')+'">'+money(row.beforeFounderResult)+'</td><td class="'+(row.afterFounderResult<0?'negative':'')+'">'+money(row.afterFounderResult)+'</td><td>'+margin+(r.hostingCapacityExceeded?' · capacity exceeded':'')+'</td></tr>';
    }).join('');
  }
  function drawSensitivity(){
    $('sensitivity-body').innerHTML=['downside','base','upside'].map(key=>{const r=M.simulate(M.scenarioInputs(inputState,key)),last=r.months[r.months.length-1];return '<tr class="'+(key==='base'?'base-row':'')+'"><th scope="row">'+(key==='base'?'Your inputs':M.SCENARIOS[key].label)+'</th><td>'+money(last.earnedCommission)+'</td><td class="'+(last.afterFounderResult<0?'negative':'')+'">'+money(last.afterFounderResult)+'</td><td>'+money(r.totals.cashReceived)+'</td><td>'+money(r.totals.fundingRequired)+'</td></tr>';}).join('');
  }
  function drawLedger(){
    $('ledger-body').innerHTML=result.months.map(r=>'<tr><th scope="row">'+r.month+'</th><td>'+num(r.visits,0)+'</td><td>'+num(r.newApprovedCustomers,2)+'</td><td>'+num(r.activeCommissionableCustomers,2)+'</td><td>'+money(r.earnedCommission)+'</td><td>'+money(r.cashReceived)+'</td><td>'+money(r.totalCosts)+'</td><td class="'+(r.afterFounderResult<0?'negative':'')+'">'+money(r.afterFounderResult)+'</td><td class="'+(r.cashBalance<0?'negative':'')+'">'+money(r.cashBalance)+'</td></tr>').join('');
  }
  function download(name,body,type){const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('room-status').textContent='Downloaded '+name;}
  function exportCsv(){
    if(!result)return;
    const columns=['month','visits','merchantClicks','newBuyerBusinesses','firstToolReferrals','stackExpansionReferrals','grossPaidSubscriptions','grossPaidCustomers','newApprovedCustomers','activeCommissionableCustomers','activeReferredCustomers','newCommission','renewalCommission','earnedCommission','cashReceived','hostingCost','fixedCoreCosts','aiSupportCost','employeePayroll','marketingCost','founderPay','totalCosts','beforeFounderResult','afterFounderResult','cashFlow','cashBalance','cumulativeEarned','cumulativeCashReceived'];
    const rows=[['Seller Insider Hub — hypothetical solo-founder operating scenario'],['Currency','USD'],['Hosting capacity',result.hostingCapacityExceeded?'INFEASIBLE: selected hosting plan cannot serve all modeled traffic':'Sufficient modeled credit capacity; additional purchases may be required'],['Research checked',data.asOf],['Selected program',$('program').value],['Assumptions',JSON.stringify(inputState)],['Note','Commission rates are researched; plan spend and some payout inputs are assumptions. Approval and continuing eligibility are not verified.'],[],columns,...result.months.map(r=>columns.map(k=>Number(r[k]).toFixed(k==='month'?0:4))),[],['PROGRAM TOTALS'],['Program','Share %','Earned','Cash received','Unpaid','Cap-limited commission'],...result.programTotals.map(p=>[p.label,p.sharePct,p.earnedCommission,p.cashReceived,p.unpaidCommission,p.capLimitedCommission]),[],['PROGRAM CONDITIONS'],...((inputState.programs||[]).map(p=>{const research=programById[p.id];return[p.name||p.id,research?textCondition(research):'Custom assumptions',research?.sourceUrls?.[0]||''];}))];
    const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';download('seller-insider-hub-lean-scenario-'+inputState.months+'-months.csv','\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  }
  function scheduleUpdate(){financialInputsValid=false;$('export-market').disabled=true;clearTimeout(timer);['export-csv','export-json','print-model'].forEach(id=>$(id).disabled=true);timer=setTimeout(update,120);}
  configureEvidence();drawMarketEvidence();
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
  document.querySelectorAll('[data-stack-size]').forEach(b=>b.addEventListener('click',()=>{$('paidToolsPerBusiness').value=b.dataset.stackSize;document.querySelectorAll('[data-stack-size]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.stackSize===b.dataset.stackSize)));update();}));
  document.querySelectorAll('[data-cost-preset]').forEach(b=>b.addEventListener('click',()=>applyCostPreset(b.dataset.costPreset)));
  $('reset-model').addEventListener('click',()=>applyPreset(preset));
  $('program').addEventListener('change',applyProgram);
  $('portfolio-preset').addEventListener('change',()=>{if($('portfolio-preset').value!=='custom')setPortfolio($('portfolio-preset').value);});
  $('select-all-programs').addEventListener('click',()=>{$('portfolio-preset').value='all';setPortfolio('all');});
  $('clear-programs').addEventListener('click',()=>{modelPrograms.forEach(p=>portfolio[p.id].included=false);$('portfolio-preset').value='custom';$('program').value='mix';drawPortfolioEditor();showStructure();update();});
  $('portfolio-rows').addEventListener('input',e=>{
    const d=e.target.dataset,id=d.include||d.weight||d.price;if(!id)return;
    if(d.include)portfolio[id].included=e.target.checked;
    if(d.weight)portfolio[id].weight=e.target.value.trim()===''?NaN:Number(e.target.value);
    if(d.price)portfolio[id].price=e.target.value.trim()===''?NaN:Number(e.target.value);
    $('program').value='mix';$('portfolio-preset').value='custom';showStructure();scheduleUpdate();
  });
  $('commissionType').addEventListener('change',()=>{showStructure();update();});
  $('months').addEventListener('change',()=>{$('selected-month').max=$('months').value;$('selected-month').value=$('months').value;update();});
  ['assumptions','cost-assumptions'].forEach(id=>{$(id).addEventListener('submit',e=>e.preventDefault());$(id).addEventListener('input',e=>{if(['program','portfolio-preset'].includes(e.target.id))return;if(id==='assumptions'){document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));$('preset-description').textContent='Custom scenario. Audience inputs do not change the founder’s cost structure. All results follow the assumptions shown.';}else document.querySelectorAll('[data-cost-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));scheduleUpdate();});});
  $('selected-month').addEventListener('input',drawSelected);$('chart-view').addEventListener('change',drawSelected);
  $('program-search').addEventListener('input',drawInventory);$('program-filter').addEventListener('change',drawInventory);
  $('program-cards').addEventListener('click',e=>{const b=e.target.closest('[data-use-program]');if(!b)return;$('program').value=b.dataset.useProgram;applyProgram();$('model').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  $('export-csv').addEventListener('click',exportCsv);
  $('export-json').addEventListener('click',()=>download('seller-insider-hub-assumptions.json',JSON.stringify({title:'Seller Insider Hub — solo-founder operating scenario',asOf:data.asOf,currency:'USD',program:$('program').value,annualCommissionGoal:Number($('annual-goal').value),marketShare:marketOutcome?{inputs:readMarketInputs(),outcome:marketOutcome,shareLadder:marketRows,revenueTargets:marketTargets}:null,modelFeasible:!result.hostingCapacityExceeded,inputs:inputState,programEvidence:(inputState.programs||[]).map(p=>programById[p.id]).filter(Boolean),costEvidence:costResearch,notes:result.notes},null,2),'application/json'));
  $('goal-form').addEventListener('submit',e=>e.preventDefault());$('annual-goal').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(drawGoal,180);});document.querySelectorAll('[data-goal]').forEach(b=>b.addEventListener('click',()=>{$('annual-goal').value=b.dataset.goal;document.querySelectorAll('[data-goal]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawGoal();}));
  $('market-assumptions').addEventListener('submit',e=>e.preventDefault());
  $('market-assumptions').addEventListener('input',e=>{
    clearTimeout(marketTimer);$('export-market').disabled=true;
    document.querySelectorAll('[data-market-budget]').forEach(b=>b.setAttribute('aria-pressed','false'));
    marketTimer=setTimeout(()=>{
      if(e.target.id==='market-tools'){
        if($('program').value!=='mix'){$('program').value='mix';showStructure();}
        $('paidToolsPerBusiness').value=$('market-tools').value;
        document.querySelectorAll('[data-stack-size]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stackSize)===Number($('market-tools').value))));update();
      }else if(e.target.id==='market-horizon'){$('months').value=$('market-horizon').value;$('selected-month').value=$('market-horizon').value;update();}
      else{drawMarket();drawGoal();}
    },180);
  });
  document.querySelectorAll('[data-market-share]').forEach(b=>b.addEventListener('click',()=>{$('market-capture').value=b.dataset.marketShare;drawMarket();drawGoal();}));
  document.querySelectorAll('[data-market-budget]').forEach(b=>b.addEventListener('click',()=>setMarketBudget(b.dataset.marketBudget)));
  ['market-ladder','market-targets'].forEach(id=>$(id).addEventListener('click',e=>{const button=e.target.closest('[data-capture-share]');if(!button)return;$('market-capture').value=button.dataset.captureShare;drawMarket();drawGoal();$('market-share').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));
  $('export-market').addEventListener('click',exportMarket);
  $('reset-market').addEventListener('click',()=>{$('market-business-base').value=data.market.marketShare.broadBusinesses;$('market-addressable').value=100;$('market-annual-buyers').value=100;$('market-capture').value=.1;setMarketBudget('growth');});
  $('print-model').addEventListener('click',()=>window.print());
  applyProgram();applyPreset(preset);
})();
