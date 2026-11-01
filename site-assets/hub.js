/* Seller Insider Hub: progressive enhancement, no framework or paid API. */
(() => {
  'use strict';
  const math = {
    automation({hours, rate, monthly, setup, months}) {
      if (![hours, rate, monthly, setup, months].every(Number.isFinite) || [hours, rate, monthly, setup].some(x => x < 0) || months <= 0) throw new Error('Use nonnegative costs and hours, and at least one month.');
      const hoursMonth = hours * 52 / 12, value = hoursMonth * rate, cost = monthly + setup / months;
      return {hoursMonth, value, cost, net: value - cost, annualNet: (value - monthly) * 12 - setup, breakEvenHours: rate > 0 ? cost / rate : null};
    },
    storefront({aov, margin, processing, perorder, fixed, setup, months}) {
      if (![aov, margin, processing, perorder, fixed, setup, months].every(Number.isFinite) || aov <= 0 || months <= 0 || [margin, processing, perorder, fixed, setup].some(x => x < 0) || margin > 100 || processing > 100) throw new Error('Use a positive order value and period, percentages from 0 to 100, and nonnegative costs.');
      const contribution = aov * (margin - processing) / 100 - perorder, cost = fixed + setup / months;
      const ratio = contribution > 0 ? cost / contribution : null;
      return {contribution, cost, orders: ratio === null ? null : Math.max(0, Math.ceil(ratio - Number.EPSILON * Math.max(1, Math.abs(ratio)) * 4))};
    },
    subscriptions(items, budget) {
      if (!Number.isFinite(budget) || budget < 0) throw new Error('Enter a valid nonnegative monthly budget.');
      if (!items.length || items.some(i => !Number.isFinite(i.cost) || i.cost < 0 || !Number.isFinite(i.quantity) || i.quantity < 1 || !['monthly', 'annual'].includes(i.cycle))) throw new Error('Enter an actual price and at least one seat for every subscription. Remove unused rows.');
      const monthly = items.reduce((sum, i) => sum + i.cost * i.quantity / (i.cycle === 'annual' ? 12 : 1), 0);
      return {monthly, annual: monthly * 12, remaining: budget - monthly, annualUpfront: items.filter(i => i.cycle === 'annual').reduce((sum, i) => sum + i.cost * i.quantity, 0)};
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (typeof document === 'undefined') return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const normalize = v => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const money = v => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:2}).format(v);
  const num = v => new Intl.NumberFormat('en-US', {maximumFractionDigits:1}).format(v);
  const get = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
  const set = (key, value) => {try {localStorage.setItem(key, JSON.stringify(value)); return true;} catch {toast('Your browser could not save this. Export a backup before leaving.'); return false;}};
  const WS = 'sih.workspace.v1', CMP = 'sih.compare.v1', CONSENT = 'sih.analytics.v1';
  const ANALYTICS_ID = 'G-164NDV6713';
  const analyticsProductionHost = ['sellerinsiderhub.com', 'www.sellerinsiderhub.com'].includes(location.hostname);
  const consentChoice = value => value === 'yes' || value === 'no' ? value : null;
  let analyticsConsent = consentChoice(get(CONSENT, null));
  // Keep only non-personal campaign slugs in memory, before filters/search can
  // replace the entry URL. Nothing is sent or persisted until analytics consent.
  // Use labels such as linkedin, organic_social, and november-ai-guides; never
  // put a person's name, email, phone number, or other private data in UTM tags.
  const entryAnalytics = (() => {
    const params = new URLSearchParams(location.search || '');
    const context = {page_location: location.origin + location.pathname, page_referrer: ''};
    const campaigns = {utm_source:'campaign_source', utm_medium:'campaign_medium', utm_campaign:'campaign_name', utm_id:'campaign_id', utm_term:'campaign_term', utm_content:'campaign_content'};
    for (const [key, field] of Object.entries(campaigns)) {
      const value = params.get(key) || '';
      // A deliberately conservative slug format excludes email addresses,
      // phone numbers, URLs, whitespace/free text, and double-encoded values.
      if (/^[A-Za-z][A-Za-z0-9._~-]{0,99}$/.test(value)) context[field] = value;
    }
    const clicks = new URLSearchParams();
    for (const key of ['gclid', 'dclid', 'gbraid', 'wbraid']) {
      const value = params.get(key) || '';
      if (/^[A-Za-z0-9_-]{1,200}$/.test(value)) clicks.set(key, value);
    }
    if (clicks.size) context.page_location += '?' + clicks.toString();
    try {
      const referrer = new URL(document.referrer);
      if (/^https?:$/.test(referrer.protocol)) context.page_referrer = referrer.origin + (referrer.origin === location.origin ? referrer.pathname : '/');
    } catch { /* An empty or invalid referrer does not identify a traffic source. */ }
    return context;
  })();
  window['ga-disable-' + ANALYTICS_ID] = analyticsConsent !== 'yes' || !analyticsProductionHost;
  const emptyWorkspace = () => ({version:1, tools:[], guides:[], stacks:[]});
  function readWorkspace() {
    const raw = localStorage.getItem(WS);
    let value; try {value = JSON.parse(raw);} catch {return emptyWorkspace();}
    return value && Array.isArray(value.tools) && Array.isArray(value.guides) && Array.isArray(value.stacks) ? value : emptyWorkspace();
  }
  let workspace, workspaceStorageRead = false;
  try {workspace = readWorkspace(); workspaceStorageRead = true;} catch {workspace = emptyWorkspace();}
  let persistedWorkspace = JSON.stringify(workspace);
  let compare = get(CMP, []); if (!Array.isArray(compare)) compare = [];
  let catalog, searchIndex, currentStack, calculationExport, toastTimer, analyticsLoaded = false;
  const catalogPromise = fetch('/data/catalog.json').then(r => {if (!r.ok) throw new Error('Tool library unavailable'); return r.json();}).then(d => {catalog = d; return d;});
  catalogPromise.catch(() => toast('Interactive tools could not load. The published guides are still available.'));
  const loadIndex = () => searchIndex ? Promise.resolve(searchIndex) : fetch('/data/search-index.json').then(r => {if (!r.ok) throw new Error('Search unavailable'); return r.json();}).then(d => searchIndex = d);
  const tool = id => catalog?.tools.find(t => t.id === id);
  const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  const category = id => catalog?.categories.find(c => c.id === id)?.label || id;
  const official = t => t.affiliateStatus === 'approved' && /^https:\/\//.test(t.affiliateUrl || '') ? t.affiliateUrl : t.website;
  const rel = t => t.affiliateStatus === 'approved' && t.affiliateUrl ? 'sponsored nofollow noopener' : 'noopener';
  const monogram = t => `<span class="tool-monogram" style="background:${/^#[0-9a-f]{3,8}$/i.test(t.color) ? t.color : '#eaf0e4'}">${esc(t.icon || t.name.slice(0,2))}</span>`;
  function toast(message) {const el = $('#toast'); if (!el) return; el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 4300);}
  function download(name, body, type = 'text/plain') {const url = URL.createObjectURL(new Blob([body], {type})); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);}
  async function copy(text) {try {await navigator.clipboard.writeText(text); toast('Copied to clipboard.');} catch {download('seller-insider-hub-copy.txt', text); toast('Your browser blocked the clipboard. The text has been downloaded.');}}
  function enableAnalytics() {
    if (analyticsConsent !== 'yes' || !analyticsProductionHost) return;
    window['ga-disable-' + ANALYTICS_ID] = false;
    if (analyticsLoaded) return;
    analyticsLoaded = true; window.dataLayer = window.dataLayer || [];
    window.gtag = function(){window.dataLayer.push(arguments);};
    window.gtag('js', new Date()); window.gtag('config', ANALYTICS_ID, {send_page_view:true, allow_google_signals:false, allow_ad_personalization_signals:false, ...entryAnalytics});
    const script = document.createElement('script'); script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS_ID; document.head.appendChild(script);
  }
  function disableAnalytics() {
    window['ga-disable-' + ANALYTICS_ID] = true;
    document.cookie.split(';').forEach(pair => {
      const name = pair.trim().split('=')[0];
      if (name.startsWith('_ga')) for (const domain of ['', location.hostname, '.sellerinsiderhub.com']) document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ' domain=' + domain + ';' : ''} SameSite=Lax`;
    });
  }
  function track(name, parameters = {}) {if (analyticsProductionHost && analyticsConsent === 'yes' && !window['ga-disable-' + ANALYTICS_ID] && window.gtag) window.gtag('event', name, parameters);}
  if (analyticsConsent === 'yes') enableAnalytics();
  if (!analyticsConsent && $('#cookie-panel')) $('#cookie-panel').hidden = false;
  window.addEventListener?.('storage', event => {
    if (event.key !== CONSENT && event.key !== null) return;
    let choice = null;
    try {choice = consentChoice(JSON.parse(event.newValue));} catch { /* Invalid or removed consent is not permission. */ }
    analyticsConsent = choice;
    if (choice === 'yes') enableAnalytics(); else disableAnalytics();
    if ($('#cookie-panel')) $('#cookie-panel').hidden = !!choice;
  });
  function toolCard(t) {
    return `<article class="card tool-card" data-tool-card="${esc(t.id)}"><div class="tool-card-head">${monogram(t)}<div><h3><a href="/tool/${esc(t.id)}/">${esc(t.name)}</a></h3><span class="tool-category">${esc(category(t.category))}</span></div><button class="icon-button" data-save-tool="${esc(t.id)}" aria-pressed="${workspace.tools.includes(t.id)}" aria-label="Save ${esc(t.name)}">${bookmark}</button></div><p class="tool-description">${esc(t.tagline)}</p><div class="tool-meta"><span class="chip green">${t.freePlan === true ? 'Free plan' : t.freePlan === false ? 'Paid plans' : 'Check current plans'}</span><span class="chip">${esc(t.setup)} setup</span></div><div class="tool-bottom"><button class="text-button" data-compare-tool="${esc(t.id)}" aria-pressed="${compare.includes(t.id)}">${compare.includes(t.id) ? '✓ Selected' : '⇄ Compare'}</button><a class="text-button" href="/tool/${esc(t.id)}/">Explore tool ↗</a></div></article>`;
  }
  function updateButtons() {
    $$('[data-save-tool]').forEach(b => {const saved = workspace.tools.includes(b.dataset.saveTool); b.setAttribute('aria-pressed', saved); if (!b.classList.contains('icon-button')) b.textContent = saved ? '✓ Saved' : 'Save this tool'; else b.setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${tool(b.dataset.saveTool)?.name || 'tool'}`);});
    $$('[data-save-guide]').forEach(b => {const saved = workspace.guides.some(g => g.url === b.dataset.saveGuide); b.setAttribute('aria-pressed', saved); b.textContent = b.closest('#workspace-guides') ? 'Remove' : saved ? '✓ Saved to reading list' : 'Save to reading list';});
    $$('[data-compare-tool]').forEach(b => {const added = compare.includes(b.dataset.compareTool); b.setAttribute('aria-pressed', added); b.textContent = added ? '✓ Added to comparison' : '⇄ Compare';});
    const tray = $('#compare-tray');
    if (tray) {tray.hidden = !compare.length || location.pathname === '/compare/'; $('#compare-summary').textContent = compare.map(id => tool(id)?.name || id).join(' + '); $('#compare-link').href = '/compare/?tools=' + encodeURIComponent(compare.join(','));}
  }
  function saveWorkspace(change) {
    if (!workspaceStorageRead) {
      try {
        workspace = readWorkspace();
        persistedWorkspace = JSON.stringify(workspace);
        workspaceStorageRead = true;
      } catch {
        toast('This change was not saved. Allow browser storage, then try again. Your previous saved items are unchanged.');
        return false;
      }
    }
    change();
    if (!set(WS, workspace)) {
      workspace = JSON.parse(persistedWorkspace);
      updateButtons(); renderWorkspace();
      toast('This change was not saved. Allow browser storage, then try again. Your previous saved items are unchanged.');
      return false;
    }
    persistedWorkspace = JSON.stringify(workspace);
    updateButtons(); renderWorkspace();
    return true;
  }
  function saveCompare() {set(CMP, compare); updateButtons();}
  document.addEventListener('click', async event => {
    const el = event.target.closest('button, a'); if (!el) return;
    if (el.matches('[data-open-search]')) {$('#search-dialog').showModal(); $('#global-search-input').focus(); doSearch('', $('#global-search-results'));}
    if (el.matches('[data-close-dialog]')) $('#search-dialog').close();
    if (el.matches('[data-print]')) window.print();
    if (el.matches('[data-cookie-settings]')) $('#cookie-panel').hidden = false;
    if (el.matches('[data-consent]')) {
      const choice = consentChoice(el.dataset.consent); if (!choice) return;
      analyticsConsent = choice;
      if (choice === 'yes') enableAnalytics(); else disableAnalytics();
      try {localStorage.setItem(CONSENT, JSON.stringify(choice));}
      catch {
        // Forget an earlier permission if revocation cannot be saved, when the
        // browser still permits removal (for example a full storage quota).
        if (choice === 'no') try {localStorage.removeItem(CONSENT);} catch { /* The choice still applies to this page. */ }
        toast('Your privacy choice applies to this page. Your browser could not save it for future visits.');
      }
      $('#cookie-panel').hidden = true;
    }
    if (el.matches('[data-save-tool]')) {await catalogPromise; const id = el.dataset.saveTool; if (!tool(id)) return; const saved = workspace.tools.includes(id); if (saveWorkspace(() => {workspace.tools = saved ? workspace.tools.filter(x => x !== id) : [...new Set([...workspace.tools, id])];})) toast(saved ? 'Removed from your saved tools.' : 'Saved in this browser.');}
    if (el.matches('[data-save-guide]')) {const url = el.dataset.saveGuide; const saved = workspace.guides.some(g => g.url === url); if (saveWorkspace(() => {if (saved) workspace.guides = workspace.guides.filter(g => g.url !== url); else if (!workspace.guides.some(g => g.url === url)) workspace.guides.push({url, title:el.dataset.title || document.title});})) toast(saved ? 'Removed from your reading list.' : 'Added to your reading list.');}
    if (el.matches('[data-compare-tool]')) {await catalogPromise; const id = el.dataset.compareTool; if (compare.includes(id)) compare = compare.filter(x => x !== id); else if (compare.length < 3) {compare.push(id); track('compare_select', {tool_id:id});} else {toast('Your comparison has three tools. Remove one to add another.'); return;} saveCompare();}
    if (el.id === 'clear-compare') {compare = []; saveCompare();}
    if (el.matches('[data-outbound]')) {
      const placements = ['tool_profile', 'tutorial_tools', 'comparison_tools', 'legacy_content'];
      track('outbound_tool_click', {
        tool_id: el.dataset.outbound,
        link_type: (el.rel || '').split(/\s+/).includes('sponsored') ? 'affiliate' : 'vendor',
        placement: placements.includes(el.dataset.outboundPlacement) ? el.dataset.outboundPlacement : 'other'
      });
    }
    if (el.matches('a[download]')) track('resource_download', {resource:el.getAttribute('download') || el.pathname.split('/').pop()});
    if (el.matches('[data-copy-target]')) {const target = document.getElementById(el.dataset.copyTarget); if (target) copy(target.textContent);}
    if (el.id === 'save-stack' && currentStack) {if (saveWorkspace(() => {workspace.stacks.unshift({...currentStack, id:Date.now().toString(36), created:new Date().toISOString()}); workspace.stacks = workspace.stacks.slice(0,50);})) toast('Your stack is saved in this browser.');}
    if (el.id === 'export-stack' && currentStack) download('my-business-tool-stack.txt', stackText(currentStack));
    if (el.matches('[data-remove-stack]')) saveWorkspace(() => {workspace.stacks = workspace.stacks.filter(s => s.id !== el.dataset.removeStack);});
    if (el.id === 'export-calculation' && calculationExport) download('seller-insider-hub-calculation.csv', calculationExport, 'text/csv');
    if (el.matches('[data-remove-cost]')) el.closest('.cost-row').remove();
  });
  $('#menu-toggle')?.addEventListener('click', event => {const open = event.currentTarget.getAttribute('aria-expanded') !== 'true'; event.currentTarget.setAttribute('aria-expanded', open); event.currentTarget.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); $('#mobile-nav').hidden = !open;});
  document.addEventListener('keydown', event => {if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {event.preventDefault(); $('#search-dialog').showModal(); $('#global-search-input').focus(); doSearch($('#global-search-input').value, $('#global-search-results'));}});
  $('#search-dialog')?.addEventListener('click', event => {if (event.target === event.currentTarget) {const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.currentTarget.close();}});
  let searchSequence = 0;
  async function doSearch(query, output) {
    if (!output) return;
    const sequence = ++searchSequence;
    try {
      const index = await loadIndex(); if (sequence !== searchSequence) return;
      const words = normalize(query).trim().split(/\s+/).filter(Boolean);
      const ranked = index.map(row => {const title = normalize(row.title), desc = normalize(row.description), type = normalize(row.type); return {row, score:words.reduce((sum,w) => sum + (title.includes(w) ? 5 : 0) + (desc.includes(w) ? 2 : 0) + (type.includes(w) ? 1 : 0), 0), matches:words.every(w => (title + ' ' + desc + ' ' + type).includes(w))};}).filter(x => !words.length || x.matches).sort((a,b) => words.length ? b.score - a.score : (['Playbook','Comparison'].includes(b.row.type) ? 1 : 0) - (['Playbook','Comparison'].includes(a.row.type) ? 1 : 0)).slice(0, output.id === 'search-page-results' ? 60 : 8);
      output.innerHTML = ranked.length ? (words.length ? `<p class="small muted">${ranked.length}${ranked.length === 60 ? '+' : ''} useful matches</p>` : '<p class="small muted">Explore the guides</p>') + ranked.map(({row}) => `<a class="search-result" href="${esc(row.url)}"><span class="eyebrow">${esc(row.type === 'Playbook' ? 'Tutorial' : row.type)}</span><h3>${esc(row.title)}</h3><p>${esc(row.description)}</p></a>`).join('') : '<div class="empty-state"><h3>No matching guides yet.</h3><p>Try a broader job such as email, content, bookings, or automation.</p><a class="button light small" href="/playbooks/">Browse tutorials</a></div>';
    } catch {output.innerHTML = '<p>Search is temporarily unavailable. <a class="link" href="/playbooks/">Browse the tutorials</a>.</p>';}
  }
  $('#global-search-input')?.addEventListener('input', event => doSearch(event.target.value, $('#global-search-results')));
  if ($('#search-page-input')) {const q = new URLSearchParams(location.search).get('q') || ''; $('#search-page-input').value = q; doSearch(q, $('#search-page-results')); $('#search-page-input').addEventListener('input', event => {doSearch(event.target.value, $('#search-page-results')); history.replaceState(null, '', '/search/' + (event.target.value ? '?q=' + encodeURIComponent(event.target.value) : ''));});}

  function library() {
    if (!$('#tool-results')) return;
    const elements = {q:$('#library-query'), category:$('#filter-category'), audience:$('#filter-audience'), setup:$('#filter-setup'), free:$('#filter-free'), sort:$('#sort-tools')};
    const params = new URLSearchParams(location.search), defaultCategory = elements.category.value;
    for (const [key, input] of Object.entries(elements)) if (params.has(key)) {if (key === 'free') input.checked = params.get(key) === '1'; else input.value = params.get(key);}
    function render() {
      const q = normalize(elements.q.value).trim(), words = q.split(/\s+/).filter(Boolean);
      const list = catalog.tools.filter(t => (!elements.category.value || t.category === elements.category.value) && (!elements.audience.value || t.audiences.includes(elements.audience.value)) && (!elements.setup.value || t.setup === elements.setup.value) && (!elements.free.checked || t.freePlan === true) && words.every(w => normalize([t.name,t.tagline,t.description,...t.bestFor,...t.features,category(t.category)].join(' ')).includes(w)));
      if (elements.sort.value === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
      if (elements.sort.value === 'easy') list.sort((a,b) => ['Easy','Moderate','Advanced'].indexOf(a.setup) - ['Easy','Moderate','Advanced'].indexOf(b.setup));
      $('#tool-results').innerHTML = list.length ? list.map(toolCard).join('') : '<div class="empty-state"><h3>No tools match these filters.</h3><p>Try another category or turn off the free-plan filter.</p></div>';
      $('#results-count').textContent = `${list.length} ${list.length === 1 ? 'tool' : 'tools'} to explore`;
      const next = new URLSearchParams(); for (const [key,input] of Object.entries(elements)) {const value = key === 'free' ? (input.checked ? '1' : '') : input.value; if (value && !(key === 'sort' && value === 'curated') && !(key === 'category' && value === defaultCategory)) next.set(key,value);}
      history.replaceState(null, '', location.pathname + (next.size ? '?' + next.toString() : '')); updateButtons();
    }
    for (const input of Object.values(elements)) input.addEventListener(input.type === 'search' ? 'input' : 'change', render);
    $('#reset-filters').addEventListener('click', () => {elements.q.value = ''; elements.category.value = defaultCategory; elements.audience.value = ''; elements.setup.value = ''; elements.free.checked = false; elements.sort.value = 'curated'; render();}); render();
  }
  function comparison() {
    if (!$('#compare-output')) return;
    const initial = new URLSearchParams(location.search).get('tools');
    if (initial !== null) compare = [...new Set(initial.split(','))].filter(id => tool(id)).slice(0,3);
    const selects = [0,1,2].map(i => $('#compare-select-' + i));
    selects.forEach((s,i) => s.value = compare[i] || '');
    function render() {
      const ids = selects.map(s => s.value).filter(Boolean);
      compare = [...new Set(ids)]; saveCompare();
      history.replaceState(null, '', '/compare/' + (compare.length ? '?tools=' + encodeURIComponent(compare.join(',')) : ''));
      const ts = compare.map(tool).filter(Boolean), list = values => '<ul>' + values.map(v => '<li>' + esc(v) + '</li>').join('') + '</ul>';
      const rows = [['Primary job',t=>esc(t.tagline)],['Best for',t=>list(t.bestFor)],['Look elsewhere when',t=>list(t.notFor)],['Useful capabilities',t=>list(t.features)],['Limitations to check',t=>list(t.limitations)],['Setup',t=>esc(t.setup)],['Free plan',t=>esc(t.freePlanNote || (t.freePlan === true ? 'Available; check current limits' : t.freePlan === false ? 'Paid plans or usage fees' : 'Check current availability'))],['Pricing',t=>esc(t.pricingSummary) + `<br><a class="link" href="${esc(t.pricingUrl)}" target="_blank" rel="noopener">Current plans ↗</a>`],['Research',t=>`Official documentation, checked ${esc(t.checkedAt)}. <a class="link" href="/tool/${esc(t.id)}/">Read the full guide</a>`]];
      $('#compare-output').innerHTML = ts.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Your decision</th>${ts.map(t=>`<th scope="col">${monogram(t)}<h3>${esc(t.name)}</h3></th>`).join('')}</tr></thead><tbody>${rows.map(([label,value])=>`<tr><th scope="row">${label}</th>${ts.map(t=>`<td>${value(t)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="small" style="margin-top:18px">Compare tools for the same job. A larger feature list is only useful if you need those capabilities.</p>` : '<div class="empty-state"><h3>Start with two tools.</h3><p>Choose from the menus above or add tools from the library.</p></div>';
    }
    selects.forEach(s=>s.addEventListener('change',()=>{if(s.value && selects.some(other=>other!==s && other.value===s.value)) {s.value=''; toast('That tool is already in your comparison.');} render();}));
    $('#share-comparison').addEventListener('click',()=>copy(location.origin + location.pathname + location.search)); render();
  }
  function stackText(s) {return `MY BUSINESS TOOL STACK\nCreated with Seller Insider Hub\n\n${s.name}\n\n${s.recommendations.map(r=>`${r.role}\n${r.tool ? tool(r.tool)?.name : 'Start manually'}\n${r.reason}\n${r.tool ? 'https://sellerinsiderhub.com/tool/' + r.tool + '/' : ''}`).join('\n\n')}\n\nReview live plan limits and use one sample task before subscribing.\n`;}
  function stackBuilder() {
    $('#stack-form')?.addEventListener('submit', event => {
      event.preventDefault(); const data = new FormData(event.currentTarget), audience = data.get('audience'), budget = data.get('budget'), comfort = data.get('comfort'), needs = data.getAll('needs');
      if (!needs.length) {toast('Choose at least one job for your toolkit.'); return;}
      const effort = {Easy:0,Moderate:1,Advanced:2};
      const recommendations = needs.map(role => {
        const candidates = catalog.tools.filter(t=>t.category===role && effort[t.setup] <= effort[comfort] && (budget!=='free' || (t.freePlan===true && t.freeWorkflowEligible===true)));
        const ranked = candidates.map(t=>({t, score:(t.audiences.includes(audience)?8:0)+(t.freePlan? (budget==='selective'?3:1):0)+Math.max(0,3-Math.abs(effort[t.setup]-effort[comfort]))})).sort((a,b)=>b.score-a.score);
        const selected = ranked[0]?.t;
        return {role:category(role), tool:selected?.id || null, reason:selected ? `${selected.audiences.includes(audience)?'Its documented use cases fit your business type. ':''}${selected.setup} setup${selected.freeWorkflowEligible ? ' and a free entry plan for this type of work' : ''}. ${selected.bestFor[0]}` : 'No verified option matches this combination of spending and setup preferences. Start with your existing tools, or adjust the preferences to compare other options.', alternatives:ranked.slice(1,3).map(r=>r.t.id)};
      });
      currentStack = {name:$('#stack-audience').selectedOptions[0].text + ' · ' + $('#stack-budget').selectedOptions[0].text, recommendations, tools:recommendations.map(r=>r.tool).filter(Boolean), audience, budget, comfort};
      $('#stack-output').innerHTML = `<span class="eyebrow">A starting point for your work</span><h2>Your business toolkit</h2><p>${esc(currentStack.name)}</p><div class="stack-results">${recommendations.map(r=>{const t=tool(r.tool); return `<article class="card" style="margin-top:18px"><span class="eyebrow">${esc(r.role)}</span>${t?`<div class="tool-card-head">${monogram(t)}<h3><a href="/tool/${esc(t.id)}/">${esc(t.name)} ↗</a></h3></div>`:'<h3>Start with a manual workflow</h3>'}<p style="margin-top:14px">${esc(r.reason)}</p>${t?`<p class="small" style="margin-top:12px"><strong>Check before adopting:</strong> ${esc(t.limitations[0])}</p>${t.freePlanNote?`<p class="small"><strong>Free-plan scope:</strong> ${esc(t.freePlanNote)}</p>`:''}<p class="small"><strong>Plan economics:</strong> ${esc(t.pricingSummary)}</p><p class="small"><a class="link" href="${esc(t.pricingUrl)}" target="_blank" rel="noopener">Verify current plan limits ↗</a></p>`:''}${r.alternatives.length?`<p class="small" style="margin-top:12px">Also compare: ${r.alternatives.map(id=>`<a class="link" href="/tool/${esc(id)}/">${esc(tool(id).name)}</a>`).join(' · ')}</p>`:''}</article>`;}).join('')}</div><p class="output-note">Selection uses category, business fit, free-plan preference, and setup effort. Check current pricing, limits, and integrations with each provider.</p><div class="actions"><button class="button" id="save-stack">Save my stack</button><button class="button light" id="export-stack">Export plan</button><button class="button light" data-print>Print</button></div>`;
      track('stack_created', {roles:needs.length});
    });
  }
  function calculators() {
    const form = $('form[data-calculator]'); if (!form) return;
    let rowIndex = 0;
    function addCost() {const id=++rowIndex; const row=document.createElement('div'); row.className='cost-row card'; row.style='margin-bottom:14px;padding:16px'; row.innerHTML=`<div class="field"><label for="cost-name-${id}">Subscription name</label><input id="cost-name-${id}" class="cost-name" placeholder="Your software name" maxlength="100"></div><div class="field-row"><div class="field"><label for="cost-price-${id}">Price per seat ($)</label><input id="cost-price-${id}" class="cost-price" type="number" min="0" step="0.01" required placeholder="Enter quote"></div><div class="field"><label for="cost-qty-${id}">Seats / quantity</label><input id="cost-qty-${id}" class="cost-quantity" type="number" min="1" step="1" value="1" required></div></div><div class="field"><label for="cost-cycle-${id}">That price is billed</label><select id="cost-cycle-${id}" class="cost-cycle"><option value="monthly">Each month</option><option value="annual">Each year</option></select></div><button type="button" class="text-button" data-remove-cost>Remove subscription</button>`; $('#cost-items').appendChild(row);}
    $('#add-cost')?.addEventListener('click',addCost); if($('#cost-items'))addCost();
    const metric=(label,value,note='')=>`<div class="metric"><span>${label}</span><strong>${value}</strong>${note?`<p class="small">${note}</p>`:''}</div>`;
    form.addEventListener('submit',event=>{
      event.preventDefault(); const kind=form.dataset.calculator, inputs=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,v===''?NaN:Number(v)]));
      try {
        let content, rows;
        if(kind==='roi') {const r=math.automation(inputs); content=`<span class="eyebrow">Time value, not cash income</span><h2>${money(r.net)} per month</h2><p>Estimated value of time saved after monthly costs and the allocated setup cost.</p><div class="grid two" style="margin-top:24px">${metric('Hours saved per month',num(r.hoursMonth))}${metric('Value of that time',money(r.value))}${metric('Monthly cost equivalent',money(r.cost))}${metric('Hours needed to cover costs',r.breakEvenHours===null?'No positive hourly value':num(r.breakEvenHours))}</div><p class="output-note">Formula: weekly hours × 52 ÷ 12 × hourly value − monthly software − setup ÷ allocation months. Time released becomes cash savings only if it reduces actual spending, or revenue only if it supports additional paid work. First-year estimated net time value, with setup paid once: ${money(r.annualNet)}.</p>`; rows=[['Metric','Value'],...Object.entries(inputs),...Object.entries(r)];}
        if(kind==='storefront') {const r=math.storefront(inputs); content=`<span class="eyebrow">Incremental orders needed</span><h2>${r.orders===null?'No break-even at this margin':num(r.orders)+' orders / month'}</h2><p>${r.orders===null?'Each order contributes zero or less after the entered variable costs. Improve contribution before adding fixed costs.':'Additional orders at these economics would cover the entered monthly costs and allocated setup.'}</p><div class="grid two" style="margin-top:24px">${metric('Contribution per order',money(r.contribution))}${metric('Monthly cost to cover',money(r.cost))}</div><p class="output-note">Contribution = order value × (gross margin − processing percentage) − other per-order costs. Break-even = monthly costs plus allocated setup, divided by contribution and rounded up. Enter gross margin after product costs. Include shipping subsidies, fulfillment, expected refunds, and acquisition costs in your inputs where applicable. This calculation does not predict traffic or purchases.</p>`; rows=[['Metric','Value'],...Object.entries(inputs),...Object.entries(r)];}
        if(kind==='stack-cost') {const items=$$('.cost-row').map(row=>({name:$('.cost-name',row).value.trim()||'Subscription',cost:$('.cost-price',row).value===''?NaN:Number($('.cost-price',row).value),quantity:Number($('.cost-quantity',row).value),cycle:$('.cost-cycle',row).value})); const r=math.subscriptions(items,inputs.budget); content=`<span class="eyebrow">Your software budget</span><h2>${money(r.monthly)} / month</h2><p>Monthly equivalent across ${items.length} subscriptions. Annual plans may charge in full at renewal.</p><div class="grid two" style="margin-top:24px">${metric('Annual equivalent',money(r.annual))}${metric(r.remaining>=0?'Monthly budget remaining':'Over monthly budget',money(Math.abs(r.remaining)))}${metric('Annual-billed commitments',money(r.annualUpfront),'Amount billed across annual plans; renewal dates may differ.')}</div><p class="output-note">Monthly equivalent = monthly charges + annual charges ÷ 12, multiplied by seats. Excludes unentered taxes, overages, currency conversion, and future price changes. A blank price is never counted as free.</p>`; rows=[['Subscription','Price','Quantity','Cycle'],...items.map(i=>[i.name,i.cost,i.quantity,i.cycle]),[],['Monthly equivalent',r.monthly],['Annual equivalent',r.annual],['Budget remaining',r.remaining]];}
        calculationExport=rows.map(row=>row.map(v=>{let value=String(v??'');if(typeof v==='string'&&/^[\t\r\n ]*[=+@-]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
        $('#calculator-output').innerHTML=content+'<div class="actions"><button class="button light" id="export-calculation">Export calculation</button><button class="button light" data-print>Print</button></div>'; track('calculator_used',{calculator:kind});
      } catch(error) {$('#calculator-output').innerHTML=`<h2>Check your inputs</h2><p>${esc(error.message)}</p>`;}
    });
  }
  function renderWorkspace() {
    if (!$('#workspace-tools') || !catalog) return;
    const empty=(text,href,label)=>`<div class="empty-state"><p>${text}</p><a class="button light small" href="${href}">${label}</a></div>`;
    const saved=workspace.tools.map(tool).filter(Boolean);
    $('#workspace-tools').innerHTML=saved.length?saved.map(toolCard).join(''):empty('Save a tool from any profile or library card.','/tool-library/','Explore tools');
    $('#workspace-guides').innerHTML=workspace.guides.length?workspace.guides.map(g=>`<article class="card"><h3><a href="${esc(g.url)}">${esc(g.title)}</a></h3><div class="actions"><a class="button light small" href="${esc(g.url)}">Continue reading →</a><button class="text-button" data-save-guide="${esc(g.url)}" data-title="${esc(g.title)}" aria-pressed="true">Remove</button></div></article>`).join(''):empty('Keep useful tutorials and comparisons in your reading list.','/playbooks/','Explore tutorials');
    $('#workspace-stacks').innerHTML=workspace.stacks.length?workspace.stacks.map(s=>`<article class="card"><span class="eyebrow">Saved ${esc((s.created||'').slice(0,10))}</span><h3>${esc(s.name)}</h3><ul>${(s.tools||[]).filter(id=>tool(id)).map(id=>`<li><a class="link" href="/tool/${esc(id)}/">${esc(tool(id).name)}</a></li>`).join('')}</ul><button class="text-button" data-remove-stack="${esc(s.id)}">Remove this stack</button></article>`).join(''):empty('Create a shortlist based on your business and the jobs you need done.','/stack-builder/','Build a stack');
    updateButtons();
  }
  $('#export-workspace')?.addEventListener('click',()=>download('seller-insider-hub-workspace.json',JSON.stringify(workspace,null,2),'application/json'));
  $('#clear-workspace')?.addEventListener('click',()=>{if(confirm('Clear the tools, reading list, and stacks saved in this browser? Export a backup first if you want to keep them.')){if(saveWorkspace(() => {workspace=emptyWorkspace();}))toast('Your saved workspace has been cleared.');}});
  $('#import-workspace')?.addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>1000000)throw new Error('Choose a workspace backup smaller than 1 MB.');
      const data=JSON.parse(await file.text());await catalogPromise;
      if(data.version!==1||!Array.isArray(data.tools)||!Array.isArray(data.guides)||!Array.isArray(data.stacks))throw new Error('This does not look like a Seller Insider Hub workspace backup.');
      const safePath=value=>typeof value==='string'&&/^\/(?!\/)[a-z0-9/_-]+\/$/i.test(value);
      const imported={version:1,tools:[...new Set(data.tools.filter(id=>typeof id==='string'&&tool(id)))].slice(0,500),guides:data.guides.filter(g=>g&&safePath(g.url)&&typeof g.title==='string').slice(0,500).map(g=>({url:g.url,title:g.title.slice(0,200)})),stacks:data.stacks.filter(s=>s&&typeof s.name==='string'&&Array.isArray(s.tools)).slice(0,50).map((s,i)=>({id:'import-'+Date.now()+'-'+i,name:s.name.slice(0,200),created:typeof s.created==='string'?s.created.slice(0,30):'',tools:s.tools.filter(id=>typeof id==='string'&&tool(id)).slice(0,30),recommendations:[]}))};
      if(saveWorkspace(() => {workspace={version:1,tools:[...new Set([...workspace.tools,...imported.tools])],guides:[...workspace.guides,...imported.guides].filter((g,i,a)=>a.findIndex(x=>x.url===g.url)===i),stacks:[...workspace.stacks,...imported.stacks].slice(0,50)};}))toast('Backup imported and merged with your saved items.');
    }catch(error){toast(error.message||'The backup could not be read.');}event.target.value='';
  });
  catalogPromise.then(()=>{
    compare=compare.filter(id=>tool(id)).slice(0,3);updateButtons();library();comparison();stackBuilder();renderWorkspace();
    $$('a[data-tool-id]').forEach(a=>{const t=tool(a.dataset.toolId);if(t){a.href=official(t);a.rel=rel(t);a.target='_blank';a.dataset.outbound=t.id;a.dataset.outboundPlacement ||= 'legacy_content';}});
  }).catch(()=>{});
  function enhanceNativeForms() {
    // Netlify's documented AJAX format; detection must still be enabled at deploy.
    // https://docs.netlify.com/manage/forms/setup/#submit-html-forms-with-ajax
    $$('form[name="sih-newsletter"], form[name="sih-contact"]').forEach(form => {
      const status = $('.form-status', form) || document.createElement('p');
      status.className = 'form-status'; status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
      status.tabIndex = -1;
      if (!status.parentNode) form.appendChild(status);
      const retry = document.createElement('button');
      retry.type = 'submit'; retry.className = 'button light small form-retry';
      retry.textContent = 'Retry'; retry.hidden = true; form.appendChild(retry);
      let pending = false, submitted = false;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (pending || submitted || !form.reportValidity()) return;
        const buttons = $$('button[type="submit"], input[type="submit"]', form);
        const disabled = buttons.map(button => button.disabled);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        pending = true; retry.hidden = true; form.setAttribute('aria-busy', 'true');
        status.className = 'form-status'; status.textContent = 'Sending…';
        buttons.forEach(button => {button.disabled = true;});
        try {
          const destination = new URL(form.getAttribute('action') || '/thank-you/', location.origin);
          if (destination.origin !== location.origin) throw new Error('Unexpected form destination');
          const data = new FormData(form);
          data.set('form-name', form.getAttribute('name'));
          const response = await fetch('/', {
            method: 'POST', credentials: 'same-origin', mode: 'same-origin', redirect: 'follow',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams(data).toString(), signal: controller.signal
          });
          if (!response.ok || response.status < 200 || response.status >= 300) throw new Error('Submission was not accepted');
          const responseURL = new URL(response.url || '/', location.origin);
          if (responseURL.origin !== location.origin) throw new Error('Unexpected response destination');
          // Netlify does not specify a receipt-body contract. A successful empty
          // response, changed receipt wording, or interrupted optional body must
          // not invite a duplicate POST. Still reject a recognizable error page.
          const html = await response.text().catch(() => '');
          if (html.trim() && (/text\/html/i.test(response.headers.get('Content-Type') || '') || /<(?:!doctype|html|head|body|h1|title)(?:\s|>)/i.test(html))) {
            const receipt = new DOMParser().parseFromString(html, 'text/html');
            const heading = receipt.querySelector('h1')?.textContent || '';
            const title = receipt.querySelector('title')?.textContent || '';
            if (/\b404\b|not found|different turn/i.test(title + ' ' + heading)) throw new Error('Submission returned an error page');
          }
          status.textContent = 'Thank you. Opening the confirmation page…';
          location.assign(destination.pathname + destination.search + destination.hash);
          submitted = true;
        } catch {
          status.className = 'form-status error';
          status.textContent = 'We could not confirm your submission; it may already have reached us. Your details are still here. Retry only if needed, or email partners@sellerinsiderhub.com.';
          retry.hidden = false; status.focus();
        } finally {
          clearTimeout(timeout); pending = false; form.setAttribute('aria-busy', 'false');
          buttons.forEach((button, index) => {button.disabled = submitted || disabled[index];});
        }
      });
    });
  }
  enhanceNativeForms();
  calculators();
  const progressBar=$('.reading-progress span');
  const readingArticle=$('article.article-body');
  if(progressBar&&readingArticle){
    let progressQueued=false;
    const updateReadingProgress=()=>{
      const rect=readingArticle.getBoundingClientRect();
      const span=Math.max(1,rect.height-innerHeight+120);
      const fraction=Math.max(0,Math.min(1,(120-rect.top)/span));
      progressBar.style.width=(fraction*100).toFixed(1)+'%';
      progressQueued=false;
    };
    const queueReadingProgress=()=>{if(!progressQueued){progressQueued=true;requestAnimationFrame(updateReadingProgress);}};
    addEventListener('scroll',queueReadingProgress,{passive:true});
    addEventListener('resize',queueReadingProgress);
    updateReadingProgress();
  }
})();
