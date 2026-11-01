(function () {
  'use strict';
  const M = window.SIHInvestorModel;
  const data = JSON.parse(document.getElementById('investor-data').textContent);
  const research = data.research;
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
  const num = (value, digits) => new Intl.NumberFormat('en-US',{maximumFractionDigits:digits == null ? 1 : digits}).format(value);
  const compact = (value, currency) => new Intl.NumberFormat('en-US',{style:'currency',currency:currency || 'USD',notation:'compact',maximumFractionDigits:1}).format(value);
  const programById = Object.fromEntries(research.programs.map(p => [p.id,p]));
  const numericKeys = ['months','monthlyVisits','trafficGrowthPct','maxMonthlyVisits','merchantClickPct','clickToPaidPct','approvalPct','reversalPct','monthlyPrice','commissionPct','churnPct','commissionMonths','payoutDelayMonths','payoutMinimum','payoutMinimumCustomers','fixedMonthlyCosts','monthlyMarketingSpend','setupCost','startingCash','oneTimeCommission','paidTrafficPct','costPerPaidVisit'];
  let preset = 'early_audience', result = null, inputState = null, timer = null;

  function configureEvidence() {
    research.programs.forEach(p => {
      const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; $('program').appendChild(option);
    });
    const mix = document.createElement('option'); mix.value = 'mix'; mix.textContent = 'Three-program mix'; $('program').appendChild(mix);
    $('program-cards').innerHTML = research.programs.map(p => '<article class="program-card"><span class="program-kind">' + (p.model.commissionType === 'one-time' ? 'ONE-TIME SALE PAYMENT' : 'RECURRING · ' + (p.model.commissionMonths ? p.model.commissionMonths + ' MONTHS' : 'WHILE ELIGIBLE')) + '</span><h3>' + esc(p.name) + '</h3><p>' + esc(p.summary) + '</p><ul><li>' + esc(p.terms.payoutSummary) + '</li><li>' + esc(p.caveats[0]) + '</li></ul><a href="' + esc(p.sourceUrls[0]) + '" target="_blank" rel="noopener noreferrer">Read the official program ↗</a><button type="button" class="try-program" data-use-program="' + esc(p.id) + '">Explore these terms in the model ↑</button></article>').join('');
    $('benchmark-cards').innerHTML = research.benchmarks.map(b => {
      const second = b.netIncome == null ? b.otherMetrics.adjustedEbitda : b.netIncome;
      const label = b.netIncome == null ? 'Adjusted EBITDA · not net income' : 'GAAP net income';
      const caveat = b.company === 'Future plc' ? 'Diversified specialist media: advertising, subscriptions, ecommerce, and comparison. Different revenue streams, currency, and reporting period. Adjusted EBITDA excludes certain costs and is not net income.' : b.caveat;
      return '<article class="benchmark-card"><p class="period">' + esc(b.period) + ' · ' + esc(b.currency) + '</p><h3>' + esc(b.company) + '</h3><div class="benchmark-values"><div><strong>' + compact(b.revenue,b.currency) + '</strong><span>Reported revenue</span></div><div><strong>' + compact(second,b.currency) + '</strong><span>' + esc(label) + '</span></div></div><p>' + esc(caveat) + '</p><a class="benchmark-source" href="' + esc(b.sourceUrls[0]) + '" target="_blank" rel="noopener noreferrer">Company-reported results · ' + esc(b.publishedAt) + ' ↗</a></article>';
    }).join('');
    const links = new Map();
    research.programs.forEach(p => p.sourceUrls.forEach((url,i) => links.set(url,p.name + (i === 0 ? ' · official program' : ' · terms and payment details'))));
    research.benchmarks.forEach(b => b.sourceUrls.forEach((url,i) => links.set(url,b.company + (i === 0 ? ' · reported results' : ' · financial disclosure'))));
    $('program-sources').innerHTML = Array.from(links).map(([url,label]) => '<li><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' ↗</a></li>').join('');
    const keys = ['visits','conversions','cohorts','expiry','recurring','oneTime','reversals','cash','costs','results','breakEven'];
    $('formula-list').innerHTML = keys.filter(k => M.FORMULAS[k]).map(k => '<li>' + esc(M.FORMULAS[k]) + '</li>').join('');
  }

  function setInputs(values) {
    numericKeys.forEach(k => { if ($(k) && values[k] !== undefined) $(k).value = values[k]; });
    if (values.commissionType) $('commissionType').value = values.commissionType;
    showStructure();
  }

  function showStructure() {
    const mix = $('program').value === 'mix', one = $('commissionType').value === 'one-time';
    $('mix-controls').hidden = !mix; $('single-program').hidden = mix;
    $('recurring-inputs').hidden = one; $('term-input').hidden = one;
    $('one-time-input').hidden = !one; $('threshold-inputs').hidden = mix;
    $('payoutDelayMonths').disabled = mix;
    $('churnPct').disabled = !mix && one;
  }

  function applyProgram() {
    const selected = $('program').value;
    if (selected === 'custom') {
      $('program-note').textContent = 'Editable assumptions. A rate or term here is not evidence of affiliate approval.';
    } else if (selected === 'mix') {
      $('program-note').textContent = 'HubSpot and MailerLite recurring commissions plus Semrush SEO one-time payments. Program rates, caps, and payout gates use the researched examples; shared churn, approval, and reversal rates remain your assumptions.';
    } else {
      const p = programById[selected];
      setInputs(p.model);
      $('program-note').textContent = p.summary + ' You can edit these terms to test alternatives. The plan value and payout delay are planning assumptions; verify your actual agreement.';
    }
    showStructure(); update();
  }

  function applyPreset(key) {
    preset = key;
    const horizon = Number($('months').value);
    setInputs({...M.PRESETS[key].inputs,months:horizon});
    $('program').value = 'custom';
    $('program-note').textContent = 'Custom recurring commission with a 12-month limit. All audience, conversion, price, retention, and cost values are illustrative.';
    $('preset-description').textContent = M.PRESETS[key].description;
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.preset === key)));
    $('selected-month').value = horizon; showStructure(); update();
  }

  function readInputs() {
    const input = {};
    const mix = $('program').value === 'mix', one = $('commissionType').value === 'one-time';
    const inactive = new Set(mix
      ? ['monthlyPrice','commissionPct','oneTimeCommission','commissionMonths','payoutDelayMonths','payoutMinimum','payoutMinimumCustomers']
      : one ? ['monthlyPrice','commissionPct','commissionMonths','churnPct'] : ['oneTimeCommission']);
    numericKeys.forEach(k => {
      // Omit unused fields: the model supplies its defaults, while a mix uses
      // each program's own terms. Hidden blanks must not pause a valid scenario.
      if (inactive.has(k)) return;
      if ($(k).value.trim() === '') throw new Error('Complete all numeric inputs before using the results.');
      input[k] = Number($(k).value);
    });
    input.commissionType = $('commissionType').value;
    if (mix) {
      const shares = [['hubspot','mixHubspot','mixHubspotPrice'],['mailerlite','mixMailerlite','mixMailerlitePrice'],['semrush-seo','mixSemrush',null]];
      input.programs = shares.map(([id,share,price]) => {
        if ($(share).value.trim() === '' || (price && $(price).value.trim() === '')) throw new Error('Complete the program shares and monthly plan values.');
        return {id,name:programById[id].name,...programById[id].model,sharePct:Number($(share).value),monthlyPrice:price ? Number($(price).value) : 0,churnPct:input.churnPct,approvalPct:input.approvalPct,reversalPct:input.reversalPct};
      });
    }
    return input;
  }

  function update() {
    try {
      const input = readInputs(), next = M.simulate(input);
      inputState = input; result = next;
      $('model-error').hidden = true; document.querySelector('.results-panel').classList.remove('output-stale');
      ['export-csv','export-json','print-model'].forEach(id => $(id).disabled = false);
      $('selected-month').max = input.months;
      if (Number($('selected-month').value) > input.months) $('selected-month').value = input.months;
      $('result-period').textContent = input.months + ' MONTHS';
      document.querySelectorAll('.horizon-label').forEach(el => el.textContent = 'At month ' + input.months);
      drawSelected(); drawCohorts(); drawSensitivity(); drawLedger();
    } catch (error) {
      $('model-error').textContent = error.message + ' Results remain paused until the inputs are valid.';
      $('model-error').hidden = false; document.querySelector('.results-panel').classList.add('output-stale');
      ['export-csv','export-json','print-model'].forEach(id => $(id).disabled = true);
    }
  }

  function renderValue(id,value,formatter) {
    $(id).textContent = (formatter || money)(value); $(id).classList.toggle('negative',value < 0);
  }

  function drawSelected() {
    if (!result) return;
    const month = Math.max(1,Math.min(result.months.length,Number($('selected-month').value))), row = result.months[month-1];
    $('selected-month-value').textContent = month;
    renderValue('kpi-commission',row.earnedCommission); renderValue('kpi-profit',row.operatingResult); renderValue('kpi-cash',row.cumulativeCashReceived); renderValue('kpi-active',row.activeCommissionableCustomers,v => num(v,1));
    $('kpi-commission-note').textContent = 'Earned in month ' + month + ' · after deductions';
    $('break-even').textContent = result.breakEven.operatingMonth ? 'Month ' + result.breakEven.operatingMonth : 'Not reached';
    $('funding-needed').textContent = money(result.totals.fundingRequired);
    renderValue('ending-cash',row.cashBalance);
    $('funding-note').textContent = 'Across ' + inputState.months + ' months, the peak modeled cash gap is ' + money(result.totals.fundingRequired) + ' before starting cash. Additional cash needed beyond your ' + money(inputState.startingCash) + ' starting balance: ' + money(result.totals.additionalFundingRequired) + '. No contingency, tax, or investor return is included.';
    $('month-detail').textContent = 'Month ' + month + ': ' + money(row.newCommission) + ' from new referrals + ' + money(row.renewalCommission) + ' from renewals. ' + money(row.cashReceived) + ' paid; ' + money(row.totalCosts) + ' in modeled costs. ' + num(row.churnedCustomers,1) + ' expected customers churned; ' + num(row.expiredCustomers,1) + ' reached their commission limit.';
    $('funnel-month').textContent = 'Month ' + month;
    $('funnel').innerHTML = [[num(row.visits,0),'Reader visits'],[num(row.merchantClicks,1),'Vendor clicks'],[num(row.newApprovedCustomers,1),'Approved paid referrals'],[money(row.newCommission),'New referral commission']].map(([v,l]) => '<div><strong>' + v + '</strong><small>' + l + '</small></div>').join('');
    drawChart(month);
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

  function drawSensitivity() {
    $('sensitivity-body').innerHTML = ['downside','base','upside'].map(key => {
      const r=M.simulate(M.scenarioInputs(inputState,key)), last=r.months[r.months.length-1];
      return '<tr class="' + (key==='base'?'base-row':'') + '"><th scope="row">' + (key==='base'?'Your inputs':M.SCENARIOS[key].label) + '</th><td>' + money(last.earnedCommission) + '</td><td class="' + (last.operatingResult<0?'negative':'') + '">' + money(last.operatingResult) + '</td><td>' + money(r.totals.cashReceived) + '</td><td>' + money(r.totals.fundingRequired) + '</td></tr>';
    }).join('');
  }

  function drawLedger() {
    $('ledger-body').innerHTML = result.months.map(r => '<tr><th scope="row">' + r.month + '</th><td>' + num(r.visits,0) + '</td><td>' + num(r.newApprovedCustomers,2) + '</td><td>' + num(r.activeCommissionableCustomers,2) + '</td><td>' + money(r.earnedCommission) + '</td><td>' + money(r.cashReceived) + '</td><td>' + money(r.totalCosts) + '</td><td class="' + (r.operatingResult<0?'negative':'') + '">' + money(r.operatingResult) + '</td><td class="' + (r.cashBalance<0?'negative':'') + '">' + money(r.cashBalance) + '</td></tr>').join('');
  }

  function download(name,body,type) {
    const blob = new Blob([body],{type}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url),1000);
    $('room-status').textContent = 'Downloaded ' + name;
  }

  function exportCsv() {
    if(!result)return;
    const columns=['month','visits','merchantClicks','grossPaidCustomers','newApprovedCustomers','activeCommissionableCustomers','activeReferredCustomers','churnedCustomers','expiredCustomers','newCommission','renewalCommission','earnedCommission','cashReceived','totalCosts','operatingResult','cashFlow','cashBalance','cumulativeEarned','cumulativeCashReceived','cumulativeOperatingResult'];
    const rows=[['Seller Insider Hub - illustrative scenario, not actual company results'],['Currency','USD'],['Research checked',data.asOf],['Selected program',$('program').value],['Assumptions',JSON.stringify(inputState)],[],columns,...result.months.map(r => columns.map(k => Number(r[k]).toFixed(k==='month'?0:4)))];
    const quote=v => '"' + String(v).replace(/"/g,'""') + '"';
    download('seller-insider-hub-scenario-' + inputState.months + '-months.csv','\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  }

  configureEvidence();
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click',() => applyPreset(b.dataset.preset)));
  $('reset-model').addEventListener('click',() => applyPreset(preset));
  $('program').addEventListener('change',applyProgram);
  $('commissionType').addEventListener('change',() => {showStructure();update();});
  $('months').addEventListener('change',() => {$('selected-month').max=$('months').value;$('selected-month').value=$('months').value;update();});
  $('assumptions').addEventListener('submit',event => event.preventDefault());
  $('assumptions').addEventListener('input',event => {
    if(event.target.id==='program')return;
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed','false'));
    $('preset-description').textContent = 'Custom scenario. Every result follows the assumptions shown below; no probability of achieving these results is assigned.';
    clearTimeout(timer);timer=setTimeout(update,120);
  });
  $('selected-month').addEventListener('input',drawSelected);
  $('chart-view').addEventListener('change',drawSelected);
  document.querySelectorAll('[data-use-program]').forEach(b => b.addEventListener('click',() => {$('program').value=b.dataset.useProgram;applyProgram();$('model').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));
  $('export-csv').addEventListener('click',exportCsv);
  $('export-json').addEventListener('click',() => download('seller-insider-hub-assumptions.json',JSON.stringify({title:'Seller Insider Hub illustrative operating scenario',asOf:data.asOf,currency:'USD',program:$('program').value,inputs:inputState,notes:result.notes},null,2),'application/json'));
  $('print-model').addEventListener('click',() => window.print());
  applyPreset(preset);
})();
