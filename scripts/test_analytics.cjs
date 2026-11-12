'use strict';

// Exercise the production script at its browser boundary. Google scripts are
// captured, never executed: these tests send no real visits or analytics events.
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../site-assets/hub.js'), 'utf8');
const ORIGIN = 'https://sellerinsiderhub.com';
const CONSENT = 'sih.analytics.v1';
const ID = 'G-164NDV6713';

async function page({url = ORIGIN + '/', consent = null, referrer = '', library = false, comparison = false, catalog = {tools: [], categories: [], comparisons: []}, storageDenied = false, browser = {}, excluded = false, prerendering = false} = {}) {
  const storage = new Map(consent === null ? [] : [[CONSENT, JSON.stringify(consent)]]);
  if (excluded) storage.set('umami.disabled', '1');
  const controls = {storageDenied, writeDenied: false};
  const listeners = new Map(), windowListeners = new Map(), nodes = new Map(), scripts = [], writes = [], cookieWrites = [];
  const cookies = new Map([['_ga', 'old-cookie'], ['_ga_164NDV6713', 'old-session'], ['essential', 'keep']]);
  class Element {
    constructor(id = '', dataset = {}, tagName = 'BUTTON') {
      this.id = id; this.dataset = dataset; this.tagName = tagName;
      this.hidden = true; this.textContent = ''; this.value = ''; this.checked = false;
      this.type = ''; this.innerHTML = ''; this.listeners = new Map();
    }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    matches(selector) {
      const data = selector.match(/^\[data-([a-z-]+)\]$/);
      if (data) return Object.hasOwn(this.dataset, data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
      return false;
    }
    closest() { return this; }
  }
  nodes.set('cookie-panel', new Element('cookie-panel'));
  nodes.set('toast', new Element('toast'));
  if (library) {
    for (const id of ['tool-results', 'library-query', 'filter-category', 'filter-audience', 'filter-setup', 'filter-free', 'sort-tools', 'results-count', 'reset-filters']) nodes.set(id, new Element(id));
    nodes.get('sort-tools').value = 'curated';
    nodes.get('library-query').type = 'search';
  }
  if (comparison) {
    for (const id of ['compare-output', 'compare-select-0', 'compare-select-1', 'compare-select-2', 'share-comparison']) nodes.set(id, new Element(id));
  }
  const location = new URL(url);
  const document = {
    referrer, title: 'Seller Insider Hub', prerendering,
    querySelector: selector => selector.startsWith('#') ? nodes.get(selector.slice(1)) || null : null,
    querySelectorAll: () => [],
    createElement: tag => new Element('', {}, tag.toUpperCase()),
    head: {appendChild: element => scripts.push(element)},
    addEventListener: (type, callback) => listeners.set(type, callback),
    get cookie() { return [...cookies].map(([key, value]) => key + '=' + value).join('; '); },
    set cookie(value) {
      cookieWrites.push(value);
      if (/Max-Age=0/.test(value)) cookies.delete(value.split('=')[0]);
    },
  };
  const context = {
    document, location, navigator: browser, window: {addEventListener: (type, callback) => windowListeners.set(type, callback)}, URL, URLSearchParams, Intl, console,
    localStorage: {
      getItem(key) { if (controls.storageDenied) throw new Error('Storage denied'); return storage.get(key) ?? null; },
      setItem(key, value) {
        if (controls.storageDenied || controls.writeDenied) throw new Error('Storage denied');
        writes.push([key, value]); storage.set(key, value);
      },
      removeItem(key) { if (controls.storageDenied) throw new Error('Storage denied'); storage.delete(key); },
    },
    history: {replaceState(_state, _title, next) { location.href = new URL(next, location).href; }},
    fetch: async resource => {
      assert.equal(resource, '/data/catalog.json', 'Tests must not make analytics/network requests');
      return {ok: true, json: async () => catalog};
    },
    setTimeout() { return 1; }, clearTimeout() {},
  };
  vm.runInNewContext(source, context, {filename: 'site-assets/hub.js'});
  await new Promise(resolve => setImmediate(resolve));
  const commands = () => (context.window.dataLayer || []).map(command => [...command]);
  const configurations = () => commands().filter(command => command[0] === 'config');
  const events = () => commands().filter(command => command[0] === 'event');
  async function click(dataset = {}, {rel = '', href = null, tagName = href ? 'A' : 'BUTTON', defaultPrevented = false} = {}) {
    const element = new Element('', dataset, tagName);
    element.rel = rel;
    if (href !== null) {
      const url = new URL(href, location);
      element.origin = url.origin; element.pathname = url.pathname;
    }
    await listeners.get('click')({target: element, defaultPrevented});
  }
  const storageEvent = event => windowListeners.get('storage')(event);
  return {context, controls, storage, writes, nodes, cookieWrites, cookies, commands, configurations, events, click, storageEvent, listeners,
    get scripts() {return scripts.filter(s => s.src.startsWith('https://www.googletagmanager.com/'));},
    get visitorScripts() {return scripts.filter(s => s.src === 'https://cloud.umami.is/script.js');}
  };
}

test('cookie-free visits use one pageview per document with only safe entry attribution', async () => {
  const p = await page({url: ORIGIN + '/tool-library/?utm_source=chatgpt&utm_medium=referral&q=private&email=reader%40example.test&gclid=ad-id#private', referrer: 'https://chatgpt.com/c/private-conversation?q=private'});
  assert.equal(p.visitorScripts.length, 1);
  assert.equal(p.visitorScripts[0].dataset.autoTrack, 'false');
  const received = [];
  p.context.window.umami = {track() {received.push(p.context.window.sihVisitorPayload('event', {language:'en-US', screen:'1200x800', id:'unwanted-id', data:{email:'private'}}));}};
  p.context.history.replaceState(null, '', '/tool-library/?q=different-filter');
  p.visitorScripts[0].onload();
  p.visitorScripts[0].onload();
  await p.click({consent:'yes'});
  assert.equal(received.length, 1, 'Script callbacks and consent changes must not duplicate the visit');
  assert.equal(received[0].url, '/tool-library/?utm_source=chatgpt&utm_medium=referral');
  assert.equal(received[0].referrer, 'https://chatgpt.com/');
  assert.doesNotMatch(JSON.stringify(received), /private|gclid|unwanted|different-filter/);
  assert.equal(p.context.window.sihVisitorPayload('event', {name:'unapproved-event'}), false);
  assert.equal(p.context.window.sihVisitorPayload('identify', {}), false);
});

test('saved denial, owner exclusions, browser privacy signals, automation, and previews load no visitor tracker', async () => {
  for (const options of [{consent:'no'}, {excluded:true, consent:'yes'}, {browser:{globalPrivacyControl:true}, consent:'yes'}, {browser:{doNotTrack:'1'}, consent:'yes'}, {browser:{webdriver:true}, consent:'yes'}, {url:'https://preview.netlify.app/'}, {url:'http://localhost/'}]) {
    const p = await page(options);
    assert.equal(p.visitorScripts.length, 0, JSON.stringify(options));
    assert.equal(p.scripts.length, 0, JSON.stringify(options));
    assert.equal(p.context.window.sihVisitorPayload('event', {}), false);
  }
});

test('denying analytics while the visitor script is loading prevents its first send', async () => {
  const p = await page();
  let calls = 0;
  p.context.window.umami = {track() {calls++;}};
  await p.click({consent:'no'});
  p.visitorScripts[0].onload();
  assert.equal(calls, 0);
  assert.equal(p.context.window.sihVisitorPayload('event', {}), false);
  assert.equal(p.nodes.get('cookie-panel').hidden, true);
});

test('changing a remembered denial enables one visitor script and later revocation blocks its payload', async () => {
  const p = await page({consent:'no'});
  await p.click({consent:'yes'});
  assert.equal(p.visitorScripts.length, 1);
  assert.ok(p.context.window.sihVisitorPayload('event', {}));
  p.storageEvent({key:CONSENT,newValue:'"no"'});
  assert.equal(p.context.window.sihVisitorPayload('event', {}), false);
});

test('prerendered documents are counted only after activation', async () => {
  const p = await page({prerendering:true});
  assert.equal(p.visitorScripts.length, 0);
  p.context.document.prerendering = false;
  p.listeners.get('prerenderingchange')();
  assert.equal(p.visitorScripts.length, 1);
});

test('owner exclusion changes block both providers in already-open pages', async () => {
  const p = await page({consent:'yes'});
  p.storage.set('umami.disabled','1');
  p.storageEvent({key:'umami.disabled',newValue:'1'});
  await p.click({outbound:'sample-tool'});
  assert.equal(p.events().length, 0);
  assert.equal(p.context.window.sihVisitorPayload('event', {}), false);
  assert.equal(p.context.window['ga-disable-' + ID], true);
});

test('a blocked visitor counter cannot break navigation or privacy preferences', async () => {
  const p = await page();
  p.context.window.umami = {track() {throw new Error('Blocked');}};
  assert.doesNotThrow(() => p.visitorScripts[0].onload());
  await p.click({cookieSettings:''});
  assert.equal(p.nodes.get('cookie-panel').hidden, false);
});

test('no automatic popup or Google collection; the footer opens optional preferences', async () => {
  const p = await page({url: ORIGIN + '/?utm_source=linkedin&utm_medium=organic_social'});
  await p.click({outbound: 'sample-tool'});
  assert.equal(p.scripts.length, 0);
  assert.equal(p.commands().length, 0);
  assert.equal(p.writes.length, 0, 'Entry attribution must not be persisted before consent');
  assert.equal(p.nodes.get('cookie-panel').hidden, true);
  assert.equal(p.context.window['ga-disable-' + ID], true);
  await p.click({cookieSettings: ''});
  assert.equal(p.nodes.get('cookie-panel').hidden, false);
  assert.equal(p.scripts.length, 0, 'Opening preferences does not grant analytics permission');
});

const comparisonCatalog = {
  categories: [],
  tools: ['chatgpt', 'claude', 'notion'].map(id => ({
    id, name: id, tagline: 'Example task', bestFor: ['Example workflow'],
    notFor: ['Example limitation'], features: ['Example capability'], limitations: ['Check limits'],
    setup: 'Easy', freePlan: true, pricingSummary: 'Check current plans',
    pricingUrl: 'https://example.test/pricing/', checkedAt: '2026-11-01',
  })),
  comparisons: [{title: 'ChatGPT vs Claude', url: '/comparisons/chatgpt-vs-claude/', toolIds: ['chatgpt', 'claude']}],
};

test('both selection orders link to the same published comparison without changing column order', async () => {
  for (const ids of [['chatgpt', 'claude'], ['claude', 'chatgpt']]) {
    const p = await page({comparison: true, catalog: comparisonCatalog, url: ORIGIN + '/compare/?tools=' + ids.join(',')});
    const output = p.nodes.get('compare-output').innerHTML;
    assert.match(output, /href="\/comparisons\/chatgpt-vs-claude\/"/);
    assert.match(output, /Read ChatGPT vs Claude/);
    assert.ok(output.indexOf('<h3>' + ids[0] + '</h3>') < output.indexOf('<h3>' + ids[1] + '</h3>'));
    assert.equal(new URLSearchParams(p.context.location.search).get('tools'), ids.join(','));
    assert.equal(p.context.location.pathname, '/compare/', 'A guide link must not redirect the interactive workspace');
  }
});

test('unreviewed pairs, unknown tools, and selections outside two tools show no invented guide', async () => {
  for (const selection of ['', 'chatgpt', 'chatgpt,notion', 'chatgpt,missing', 'chatgpt,claude,notion']) {
    const p = await page({comparison: true, catalog: comparisonCatalog, url: ORIGIN + '/compare/?tools=' + selection});
    const output = p.nodes.get('compare-output').innerHTML;
    assert.doesNotMatch(output, /Published comparison guide|href="\/comparisons\//);
    assert.match(output, selection ? /<table/ : /Start with two tools/);
  }
});

test('changing the selected pair removes and restores its published guide link', async () => {
  const p = await page({comparison: true, catalog: comparisonCatalog, url: ORIGIN + '/compare/?tools=chatgpt,claude'});
  const second = p.nodes.get('compare-select-1');
  second.value = 'notion';
  second.listeners.get('change')();
  assert.doesNotMatch(p.nodes.get('compare-output').innerHTML, /Published comparison guide/);
  second.value = 'claude';
  second.listeners.get('change')();
  assert.match(p.nodes.get('compare-output').innerHTML, /href="\/comparisons\/chatgpt-vs-claude\/"/);
});

test('remembered denial still loads no tag and collects no custom event', async () => {
  const p = await page({consent: 'no'});
  await p.click({outbound: 'sample-tool', outboundPlacement: 'tutorial_tools'}, {rel: 'sponsored nofollow noopener'});
  assert.equal(p.scripts.length, 0);
  assert.equal(p.events().length, 0);
  assert.equal(p.nodes.get('cookie-panel').hidden, true);
});

test('one outbound event distinguishes an affiliate action from an ordinary vendor visit', async () => {
  const p = await page({consent: 'yes'});
  await p.click({outbound: 'sample-tool', outboundPlacement: 'tutorial_tools'}, {rel: 'sponsored nofollow noopener'});
  assert.equal(p.events().length, 1);
  assert.equal(p.events()[0][1], 'outbound_tool_click');
  assert.deepEqual(JSON.parse(JSON.stringify(p.events()[0][2])), {
    tool_id: 'sample-tool', link_type: 'affiliate', placement: 'tutorial_tools'
  });
  await p.click({outbound: 'sample-tool', outboundPlacement: 'tool_profile'}, {rel: 'noopener'});
  assert.equal(p.events().length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(p.events()[1][2])), {
    tool_id: 'sample-tool', link_type: 'vendor', placement: 'tool_profile'
  });
});

test('outbound placements are enumerated and contain no arbitrary attribute text', async () => {
  const p = await page({consent: 'yes'});
  await p.click({outbound: 'sample-tool', outboundPlacement: 'reader@example.test'}, {rel: 'sponsored'});
  assert.equal(p.events()[0][2].placement, 'other');
  assert.doesNotMatch(JSON.stringify(p.events()), /reader@example/);
});

test('feed clicks record only an enumerated format for actual same-origin RSS and Atom links', async () => {
  const p = await page({consent: 'yes'});
  await p.click({}, {href: '/feed.xml?email=reader%40example.test#private'});
  await p.click({}, {href: ORIGIN + '/atom.xml'});
  for (const href of ['https://elsewhere.example/feed.xml', '/feed.xml.backup', '/tools/feed.xml', '/']) await p.click({}, {href});
  await p.click({}, {href: '/feed.xml', tagName: 'BUTTON'});
  await p.click({}, {href: '/feed.xml', defaultPrevented: true});
  assert.deepEqual(JSON.parse(JSON.stringify(p.events())), [
    ['event', 'feed_open', {feed_format: 'rss'}],
    ['event', 'feed_open', {feed_format: 'atom'}],
  ]);
  assert.doesNotMatch(JSON.stringify(p.events()), /example|private|email|https/);
});

test('feed measurement obeys live consent and excludes preview hosts', async () => {
  for (const options of [{}, {consent: 'no'}, {consent: 'yes', url: 'https://sample-preview.netlify.app/'}]) {
    const p = await page(options);
    await p.click({}, {href: '/feed.xml'});
    assert.equal(p.events().length, 0);
    assert.equal(p.scripts.length, 0);
  }
  const p = await page({consent: 'yes'});
  await p.click({}, {href: '/feed.xml'});
  await p.click({consent: 'no'});
  await p.click({}, {href: '/atom.xml'});
  assert.equal(p.events().length, 1);
});

test('invalid stored consent grants no permission and does not open preferences', async () => {
  for (const consent of [true, 'maybe', {}]) {
    const p = await page({consent});
    assert.equal(p.scripts.length, 0);
    assert.equal(p.nodes.get('cookie-panel').hidden, true);
  }
});

test('remembered permission starts one page view for the existing GA4 property', async () => {
  const p = await page({consent: 'yes'});
  assert.equal(p.scripts.length, 1);
  assert.equal(p.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=' + ID);
  const config = p.configurations();
  assert.equal(config.length, 1);
  assert.equal(config[0][1], ID);
  assert.equal(config[0][2].send_page_view, true);
  assert.equal(config[0][2].allow_google_signals, false);
  assert.equal(config[0][2].allow_ad_personalization_signals, false);
});

test('preview and local hosts never load production analytics, even with permission', async () => {
  for (const url of ['http://localhost:4173/', 'http://terminal.local:4173/', 'https://sample-preview.netlify.app/', 'https://sellerinsiderhub.com.example.test/']) {
    const p = await page({url, consent: 'yes'});
    assert.equal(p.storage.get(CONSENT), '"yes"', 'Host isolation must not rewrite a saved choice');
    assert.equal(p.writes.length, 0);
    await p.click({consent: 'yes'});
    await p.click({outbound: 'sample-tool'});
    assert.equal(p.scripts.length, 0);
    assert.equal(p.commands().length, 0);
    assert.equal(p.context.window['ga-disable-' + ID], true);
  }
  const www = await page({url: 'https://www.sellerinsiderhub.com/', consent: 'yes'});
  assert.equal(www.configurations().length, 1);
});

test('campaign source survives the actual directory filter URL rewrite before consent', async () => {
  const p = await page({library: true, url: ORIGIN + '/tool-library/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=november-ai-guides&utm_id=launch-1&utm_content=profile-link&utm_term=ai-tools&q=private+business+note'});
  assert.equal(p.context.location.search, '?q=private+business+note', 'The production library code removes UTM tags from its filtered URL');
  assert.equal(p.scripts.length, 0);
  await p.click({consent: 'yes'});
  const config = p.configurations()[0][2];
  assert.equal(config.page_location, ORIGIN + '/tool-library/');
  assert.equal(config.campaign_source, 'linkedin');
  assert.equal(config.campaign_medium, 'organic_social');
  assert.equal(config.campaign_name, 'november-ai-guides');
  assert.equal(config.campaign_id, 'launch-1');
  assert.equal(config.campaign_content, 'profile-link');
  assert.equal(config.campaign_term, 'ai-tools');
  assert.doesNotMatch(JSON.stringify(config), /private|business.note|\?q=/);
});

test('arbitrary query parameters and fragments never enter the configured page URL', async () => {
  const p = await page({consent: 'yes', url: ORIGIN + '/search/?q=customer+private+notes&email=reader%40example.test&token=secret&hours=41&rate=80#private-fragment'});
  const config = p.configurations()[0][2];
  assert.equal(config.page_location, ORIGIN + '/search/');
  assert.doesNotMatch(JSON.stringify(config), /customer|example.test|secret|fragment|hours|rate/);
});

test('campaign labels reject sensitive-looking, free-text, encoded, numeric, and overlong values', async () => {
  const values = ['reader@example.test', 'Mary Smith', 'https://private.example/path', '15555551234', 'reader%40example.test', 's'.repeat(101)];
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_term', 'utm_content'];
  const query = new URLSearchParams(Object.fromEntries(keys.map((key, index) => [key, values[index]])));
  const p = await page({consent: 'yes', url: ORIGIN + '/?' + query});
  const config = p.configurations()[0][2];
  assert.equal(Object.keys(config).filter(key => key.startsWith('campaign_')).length, 0);
  assert.equal(config.page_location, ORIGIN + '/');
});

test('only syntactically valid supported Google click IDs survive in the page URL', async () => {
  const p = await page({consent: 'yes', url: ORIGIN + '/?gclid=Example-123_ab&dclid=Another_456&gbraid=Group-789&wbraid=Web_987&fbclid=omit-me&email=reader%40example.test'});
  assert.equal(p.configurations()[0][2].page_location, ORIGIN + '/?gclid=Example-123_ab&dclid=Another_456&gbraid=Group-789&wbraid=Web_987');
  const invalid = await page({consent: 'yes', url: ORIGIN + '/?gclid=reader%40example.test&gbraid=' + 'x'.repeat(201)});
  assert.equal(invalid.configurations()[0][2].page_location, ORIGIN + '/');
});

test('referrers preserve source domains without third-party paths or private queries', async () => {
  const p = await page({consent: 'yes', referrer: 'https://www.google.com/search?q=private+search#private-fragment'});
  assert.equal(p.configurations()[0][2].page_referrer, 'https://www.google.com/');
  const internal = await page({consent: 'yes', referrer: ORIGIN + '/search/?q=private+note'});
  assert.equal(internal.configurations()[0][2].page_referrer, ORIGIN + '/search/');
  const invalid = await page({consent: 'yes', referrer: 'javascript:private'});
  assert.equal(invalid.configurations()[0][2].page_referrer, '');
});

test('repeating a choice or revoking and allowing again does not duplicate the page view', async () => {
  const p = await page();
  await p.click({consent: 'yes'});
  await p.click({consent: 'yes'});
  await p.click({consent: 'no'});
  await p.click({consent: 'yes'});
  assert.equal(p.configurations().length, 1);
  assert.equal(p.scripts.length, 1);
  await p.click({outbound: 'sample-tool'});
  assert.equal(p.events().length, 1);
  assert.equal(p.events()[0][1], 'outbound_tool_click');
});

test('revocation stops later events and removes analytics cookies without removing essentials', async () => {
  const p = await page({consent: 'yes'});
  await p.click({outbound: 'before-revocation'});
  await p.click({consent: 'no'});
  await p.click({outbound: 'after-revocation'});
  assert.equal(p.events().length, 1);
  assert.equal(p.context.window['ga-disable-' + ID], true);
  assert.equal(p.storage.get(CONSENT), '"no"');
  assert.deepEqual([...p.cookies.keys()], ['essential']);
  assert.ok(p.cookieWrites.some(value => value.includes('domain=.sellerinsiderhub.com')));
});

test('explicit permission works for this page when browser storage is unavailable', async () => {
  const p = await page({storageDenied: true});
  assert.equal(p.scripts.length, 0);
  await p.click({consent: 'yes'});
  await p.click({outbound: 'consented-tool'});
  assert.equal(p.configurations().length, 1);
  assert.equal(p.events().length, 1, 'Allowed page views and custom events must use the same live consent state');
  assert.match(p.nodes.get('toast').textContent, /applies to this page/);
  await p.click({consent: 'no'});
  await p.click({outbound: 'denied-tool'});
  assert.equal(p.events().length, 1);
});

test('a failed saved revocation still disables collection and forgets old permission when possible', async () => {
  const p = await page({consent: 'yes'});
  p.controls.writeDenied = true;
  await p.click({consent: 'no'});
  await p.click({outbound: 'denied-tool'});
  assert.equal(p.events().length, 0);
  assert.equal(p.context.window['ga-disable-' + ID], true);
  assert.equal(p.storage.has(CONSENT), false);
  assert.match(p.nodes.get('toast').textContent, /could not save/);
});

test('revocation or clearing consent in another tab updates this page immediately', async () => {
  const p = await page({consent: 'yes'});
  p.storageEvent({key: CONSENT, newValue: '"no"'});
  await p.click({outbound: 'denied-tool'});
  assert.equal(p.events().length, 0);
  assert.equal(p.context.window['ga-disable-' + ID], true);
  p.storageEvent({key: CONSENT, newValue: '"yes"'});
  await p.click({outbound: 'allowed-tool'});
  assert.equal(p.events().length, 1);
  assert.equal(p.configurations().length, 1);
  p.storageEvent({key: 'unrelated', newValue: '"no"'});
  assert.equal(p.context.window['ga-disable-' + ID], false);
  p.storageEvent({key: null, newValue: null});
  assert.equal(p.context.window['ga-disable-' + ID], true);
  assert.equal(p.nodes.get('cookie-panel').hidden, true, 'Clearing consent in another tab must not interrupt this page');
});
