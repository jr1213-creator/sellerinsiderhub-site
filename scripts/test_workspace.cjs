'use strict';

// Executes the production script, not a duplicate of its persistence functions.
// The small DOM/storage boundary below makes blocked browser storage reproducible
// without a browser, dependencies, network, or changes to real user data.
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../site-assets/hub.js'), 'utf8');
const WS = 'sih.workspace.v1';
const empty = () => ({version: 1, tools: [], guides: [], stacks: []});
const baseline = () => ({
  version: 1,
  tools: ['alpha'],
  guides: [{url: '/playbooks/existing-guide/', title: 'Existing guide'}],
  stacks: [{id: 'original-stack', name: 'Existing stack', created: '2026-10-31', tools: ['alpha'], recommendations: []}],
});
const catalog = {
  categories: [{id: 'productivity', label: 'Productivity'}],
  tools: ['alpha', 'beta'].map(id => ({
    id, name: id === 'alpha' ? 'Alpha tool' : 'Beta tool', category: 'productivity',
    icon: id.slice(0, 2), color: '#aabbcc', tagline: 'A sample tool',
    setup: 'Easy', freePlan: true, freeWorkflowEligible: true,
    audiences: ['creators'], bestFor: ['A sample workflow'], limitations: ['Example limit'],
    features: ['Example feature'], pricingSummary: 'Sample only',
    website: 'https://example.test/', pricingUrl: 'https://example.test/pricing/',
    affiliateStatus: 'unverified', affiliateUrl: null,
  })),
};

async function browserBoundary({saved = baseline(), blocked = false, denyAccess = false} = {}) {
  const nodes = [], byId = new Map(), downloads = [], toastMessages = [], documentListeners = new Map();
  const storage = new Map([[WS, JSON.stringify(saved)], ['sih.analytics.v1', JSON.stringify('no')]]);
  const controls = {blocked, denyAccess};
  const listeners = (map, name) => map.get(name) || [];
  let objectUrl = 0;
  const blobs = new Map();
  const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  class Element {
    constructor(tagName = 'div', id = '', dataset = {}) {
      this.tagName = tagName.toUpperCase(); this.id = id; this.dataset = {...dataset};
      this.listeners = new Map(); this.attributes = new Map(); this.className = '';
      this.innerHTML = ''; this.value = ''; this.hidden = false; this.files = [];
      this.parentElement = null; this._textContent = ''; this.style = {setProperty() {}};
      this.classList = {contains: name => this.className.split(/\s+/).includes(name)};
      nodes.push(this); if (id) byId.set(id, this);
    }
    get textContent() { return this._textContent; }
    set textContent(value) {
      this._textContent = String(value);
      if (this.id === 'toast') toastMessages.push(this._textContent);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(callback);
    }
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(s => this.matches(s.trim()));
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      const data = selector.match(/^\[data-([a-z-]+)\]$/);
      if (data) return Object.hasOwn(this.dataset, camel(data[1]));
      if (selector === 'a[download]') return this.tagName === 'A' && !!this.download;
      return selector.toUpperCase() === this.tagName;
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    click() {
      if (this.tagName === 'A' && this.download) {
        assert.ok(blobs.has(this.href), 'download must use the captured Blob');
        downloads.push({name: this.download, body: blobs.get(this.href).body});
      }
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    appendChild() {}
  }
  const add = (id, tag = 'div', data = {}) => new Element(tag, id, data);
  const ui = {
    toast: add('toast'), tools: add('workspace-tools'), guides: add('workspace-guides'), stacks: add('workspace-stacks'),
    export: add('export-workspace', 'button'), clear: add('clear-workspace', 'button'), import: add('import-workspace', 'input'),
    alpha: add('save-alpha', 'button', {saveTool: 'alpha'}), beta: add('save-beta', 'button', {saveTool: 'beta'}),
    oldGuide: add('save-old-guide', 'button', {saveGuide: '/playbooks/existing-guide/', title: 'Existing guide'}),
    newGuide: add('save-new-guide', 'button', {saveGuide: '/playbooks/new-guide/', title: 'New guide'}),
    form: add('stack-form', 'form'), audience: add('stack-audience', 'select'), budget: add('stack-budget', 'select'),
    output: add('stack-output'), saveStack: add('save-stack', 'button'),
  };
  ui.audience.selectedOptions = [{text: 'Creators'}]; ui.budget.selectedOptions = [{text: 'Free'}];
  ui.form.formValues = [['audience', 'creators'], ['budget', 'free'], ['comfort', 'Easy'], ['needs', 'productivity']];
  const document = {
    title: 'Workspace regression fixture', cookie: '',
    querySelector(selector) { return selector.startsWith('#') ? byId.get(selector.slice(1)) || null : null; },
    querySelectorAll(selector) { return nodes.filter(node => node.matches(selector)); },
    getElementById(id) { return byId.get(id) || null; },
    createElement(tag) { return new Element(tag); },
    addEventListener(name, callback) {
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push(callback);
    },
    head: {appendChild() { throw new Error('Analytics must not start in this fixture'); }},
    body: {scrollHeight: 1000}, documentElement: {scrollHeight: 1000, clientHeight: 700, style: {setProperty() {}}},
  };
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) {
      if (controls.blocked) { const error = new Error('Storage quota exceeded'); error.name = 'QuotaExceededError'; throw error; }
      storage.set(key, String(value));
    },
  };
  const context = {
    document,
    window: {addEventListener() {}, print() {}, scrollY: 0, innerHeight: 700},
    location: {origin: 'https://sellerinsiderhub.com', hostname: 'sellerinsiderhub.com', pathname: '/my-workspace/', search: ''},
    history: {replaceState() {}}, navigator: {}, URLSearchParams, Intl, console,
    confirm: () => true,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1,
    Blob: class { constructor(parts) { this.body = parts.join(''); } },
    URL: {createObjectURL(blob) { const id = 'blob:fixture-' + ++objectUrl; blobs.set(id, blob); return id; }, revokeObjectURL() {}},
    FormData: class {
      constructor(form) { this.entries = form.formValues; }
      get(name) { return this.entries.find(([key]) => key === name)?.[1] ?? null; }
      getAll(name) { return this.entries.filter(([key]) => key === name).map(([, value]) => value); }
      [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    },
    fetch: async url => {
      assert.equal(url, '/data/catalog.json', 'this regression test allows only the local catalog fixture');
      return {ok: true, json: async () => catalog};
    },
  };
  Object.defineProperty(context, 'localStorage', {get() {
    if (controls.denyAccess) { const error = new Error('Storage access denied'); error.name = 'SecurityError'; throw error; }
    return localStorage;
  }});
  vm.runInNewContext(script, context, {filename: 'site-assets/hub.js'});
  // Drain the actual catalog fetch/json/initialization promise chain.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(listeners(ui.form.listeners, 'submit').length, 1, 'production initialization must finish');

  async function dispatch(element, type, extra = {}) {
    const event = {target: element, currentTarget: element, preventDefault() {}, ...extra};
    for (const callback of listeners(element.listeners, type)) await callback(event);
    event.currentTarget = document;
    for (const callback of listeners(documentListeners, type)) await callback(event);
  }
  return {
    ui, controls, storage, toastMessages, dispatch,
    click: element => dispatch(element, 'click'),
    node: (data, id = '') => add(id, 'button', data),
    persisted: () => JSON.parse(storage.get(WS)),
    async exported() {
      await dispatch(ui.export, 'click');
      const result = downloads.at(-1);
      assert.equal(result.name, 'seller-insider-hub-workspace.json');
      return JSON.parse(result.body);
    },
    async importData(data, options = {}) {
      ui.import.value = 'workspace-backup.json';
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      ui.import.files = [{size: options.size ?? Buffer.byteLength(text), text: async () => text}];
      await dispatch(ui.import, 'change');
    },
  };
}

function noFalseSuccess(harness, from = 0) {
  const messages = harness.toastMessages.slice(from);
  assert.ok(messages.some(message => message.includes('This change was not saved.')), 'failure must be visible');
  assert.ok(!messages.some(message => /^(Saved in this browser\.|Removed from your|Added to your reading list\.|Your stack is saved|Your saved workspace has been cleared\.|Backup imported)/.test(message)), 'blocked write must never report success');
}

test('blocked tool addition and removal roll back labels, rendered lists, exported state, and persisted state; retry works', async () => {
  const h = await browserBoundary({blocked: true});
  assert.equal(h.ui.alpha.getAttribute('aria-pressed'), 'true');
  const previous = h.persisted();
  await h.click(h.ui.beta);
  noFalseSuccess(h);
  assert.equal(h.ui.beta.getAttribute('aria-pressed'), 'false');
  assert.equal(h.ui.beta.textContent, 'Save this tool');
  assert.doesNotMatch(h.ui.tools.innerHTML, /Beta tool/);
  assert.deepEqual(await h.exported(), previous);
  assert.deepEqual(h.persisted(), previous);
  const start = h.toastMessages.length;
  await h.click(h.ui.alpha);
  noFalseSuccess(h, start);
  assert.equal(h.ui.alpha.getAttribute('aria-pressed'), 'true');
  assert.match(h.ui.tools.innerHTML, /Alpha tool/);
  assert.deepEqual(await h.exported(), previous);
  h.controls.blocked = false;
  await h.click(h.ui.beta);
  assert.deepEqual(h.persisted().tools, ['alpha', 'beta']);
  assert.equal(h.ui.beta.getAttribute('aria-pressed'), 'true');
  assert.match(h.ui.tools.innerHTML, /Beta tool/);
  assert.equal(h.ui.toast.textContent, 'Saved in this browser.');
  await h.click(h.ui.alpha);
  assert.deepEqual(h.persisted().tools, ['beta']);
  assert.equal(h.ui.alpha.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await h.exported(), h.persisted());
});

test('blocked guide changes and workspace clear preserve the complete prior workspace and can be retried', async () => {
  const h = await browserBoundary({blocked: true});
  const previous = h.persisted();
  await h.click(h.ui.newGuide);
  assert.equal(h.ui.newGuide.getAttribute('aria-pressed'), 'false');
  assert.doesNotMatch(h.ui.guides.innerHTML, /New guide/);
  await h.click(h.ui.oldGuide);
  assert.equal(h.ui.oldGuide.getAttribute('aria-pressed'), 'true');
  assert.match(h.ui.guides.innerHTML, /Existing guide/);
  await h.click(h.ui.clear);
  noFalseSuccess(h);
  assert.deepEqual(h.persisted(), previous);
  assert.deepEqual(await h.exported(), previous);
  assert.match(h.ui.stacks.innerHTML, /Existing stack/);
  h.controls.blocked = false;
  await h.click(h.ui.clear);
  assert.deepEqual(h.persisted(), empty());
  assert.deepEqual(await h.exported(), empty());
  assert.equal(h.ui.oldGuide.getAttribute('aria-pressed'), 'false');
  assert.equal(h.ui.toast.textContent, 'Your saved workspace has been cleared.');
  h.controls.blocked = true;
  await h.click(h.ui.newGuide);
  assert.deepEqual(await h.exported(), empty(), 'rollback baseline must advance after a successful clear');
  h.controls.blocked = false;
  await h.click(h.ui.newGuide);
  assert.deepEqual(h.persisted().guides, [{url: '/playbooks/new-guide/', title: 'New guide'}]);
});

test('stack created by the real form is not reported saved on failure; retry saves one copy and removal rolls back', async () => {
  const h = await browserBoundary({saved: empty(), blocked: true});
  await h.dispatch(h.ui.form, 'submit');
  assert.match(h.ui.output.innerHTML, /Your business toolkit/);
  await h.click(h.ui.saveStack);
  noFalseSuccess(h);
  assert.deepEqual(await h.exported(), empty());
  h.controls.blocked = false;
  await h.click(h.ui.saveStack);
  const saved = h.persisted();
  assert.equal(saved.stacks.length, 1, 'failed attempt must not leave a duplicate behind');
  assert.deepEqual(saved.stacks[0].tools, ['alpha']);
  const remove = h.node({removeStack: saved.stacks[0].id});
  h.controls.blocked = true;
  const start = h.toastMessages.length;
  await h.click(remove);
  noFalseSuccess(h, start);
  assert.deepEqual(await h.exported(), saved);
  assert.match(h.ui.stacks.innerHTML, /Creators/);
  h.controls.blocked = false;
  await h.click(remove);
  assert.deepEqual(h.persisted().stacks, []);
});

test('blocked import rolls back the merge, resets file input, and retries without duplicate guides or tools', async () => {
  const h = await browserBoundary({blocked: true});
  const before = h.persisted();
  const backup = {version: 1, tools: ['alpha', 'beta', 'unknown-tool'], guides: [{url: '/playbooks/new-guide/', title: 'Imported guide'}], stacks: [{name: 'Imported stack', tools: ['beta', 'unknown-tool']}]};
  await h.importData(backup);
  noFalseSuccess(h);
  assert.equal(h.ui.import.value, '');
  assert.deepEqual(h.persisted(), before);
  assert.deepEqual(await h.exported(), before);
  assert.doesNotMatch(h.ui.guides.innerHTML, /Imported guide/);
  h.controls.blocked = false;
  await h.importData(backup);
  assert.deepEqual(h.persisted().tools, ['alpha', 'beta']);
  assert.equal(h.persisted().guides.length, 2);
  assert.equal(h.persisted().stacks.length, 2);
  assert.deepEqual(h.persisted().stacks[1].tools, ['beta']);
  assert.equal(h.ui.import.value, '');
  assert.equal(h.ui.toast.textContent, 'Backup imported and merged with your saved items.');
});

test('import rejects executable, external, malformed, encoded, and control-character guide URLs while escaping titles', async () => {
  const h = await browserBoundary({saved: empty()});
  const bad = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://evil.example/', '//evil.example/', '/\\evil.example/', '/guides/../admin/', '/guides/%2f%2fevil/', '/guides/okay/?next=evil', '/guides/okay/#x', '/guides/<script>/', '/guides/okay/\n', '/guides/okay/\u2028', null, {url: '/guides/okay/'}];
  const safe = '/playbooks/new-guide/';
  const title = '<img src=x onerror=alert(1)> & "quoted"';
  await h.importData({version: 1, tools: [], stacks: [], guides: [...bad.map(url => ({url, title: 'Unsafe route'})), {url: safe, title}, {url: safe, title: 'Duplicate'}]});
  assert.deepEqual(h.persisted().guides, [{url: safe, title}]);
  assert.deepEqual(await h.exported(), h.persisted());
  assert.doesNotMatch(h.ui.guides.innerHTML, /<img|onerror="|javascript:|evil\.example|Unsafe route/);
  assert.match(h.ui.guides.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;quoted&quot;/);
});

test('invalid JSON, wrong backup shape, and oversize import leave current workspace unchanged', async () => {
  const h = await browserBoundary();
  const previous = h.persisted();
  for (const [data, options] of [['{broken', {}], [{version: 2, tools: [], guides: [], stacks: []}, {}], [{version: 1, tools: {}, guides: [], stacks: []}, {}], [empty(), {size: 1000001}]]) {
    const start = h.toastMessages.length;
    await h.importData(data, options);
    assert.deepEqual(h.persisted(), previous);
    assert.deepEqual(await h.exported(), previous);
    assert.equal(h.ui.import.value, '');
    assert.ok(h.toastMessages.length > start, 'rejected import must provide an explanation');
    assert.ok(!h.toastMessages.slice(start).includes('Backup imported and merged with your saved items.'));
  }
});

test('SecurityError accessing localStorage is handled at startup and save, and saving works when access resumes', async () => {
  const h = await browserBoundary({saved: empty(), denyAccess: true});
  assert.equal(h.ui.beta.getAttribute('aria-pressed'), 'false');
  await h.click(h.ui.beta);
  noFalseSuccess(h);
  assert.deepEqual(await h.exported(), empty());
  h.controls.denyAccess = false;
  await h.click(h.ui.beta);
  assert.deepEqual(h.persisted().tools, ['beta']);
  assert.equal(h.ui.beta.getAttribute('aria-pressed'), 'true');
  assert.equal(h.ui.toast.textContent, 'Saved in this browser.');
});

test('storage recovery preserves an existing workspace that could not be read at startup', async () => {
  const h = await browserBoundary({denyAccess: true});
  const original = h.persisted();
  await h.click(h.ui.beta);
  noFalseSuccess(h);
  assert.deepEqual(h.persisted(), original, 'denied access must not touch unread saved data');
  h.controls.denyAccess = false;
  await h.click(h.ui.beta);
  assert.deepEqual(h.persisted(), {...original, tools: ['alpha', 'beta']}, 'retry must load and preserve unread tools, guides, and stacks before saving');
  assert.deepEqual(await h.exported(), h.persisted());
  assert.equal(h.ui.alpha.getAttribute('aria-pressed'), 'true');
  assert.equal(h.ui.beta.getAttribute('aria-pressed'), 'true');
});

test('saving an already-existing but initially unread item preserves Save intent and does not remove or duplicate it', async () => {
  const h = await browserBoundary({denyAccess: true});
  const original = h.persisted();
  assert.equal(h.ui.alpha.getAttribute('aria-pressed'), 'false', 'unread state is initially unknown to the page');
  h.controls.denyAccess = false;
  await h.click(h.ui.alpha);
  assert.deepEqual(h.persisted(), original, 'visible Save must not become Remove after recovery');
  assert.equal(h.ui.alpha.getAttribute('aria-pressed'), 'true');
  const other = await browserBoundary({denyAccess: true});
  other.controls.denyAccess = false;
  await other.click(other.ui.oldGuide);
  assert.deepEqual(other.persisted(), original, 'recovered reading-list Save must be idempotent');
});


test('reading-list removal keeps its Remove label while ordinary guide buttons reflect saved state', async () => {
  const h = await browserBoundary({blocked: true});
  const remove = h.node({saveGuide: '/playbooks/existing-guide/', title: 'Existing guide'});
  remove.parentElement = h.ui.guides;
  await h.click(remove);
  noFalseSuccess(h);
  assert.equal(remove.textContent, 'Remove');
  assert.equal(remove.getAttribute('aria-pressed'), 'true');
  assert.equal(h.ui.oldGuide.textContent, '✓ Saved to reading list');
  assert.match(h.ui.guides.innerHTML, /Existing guide/);
  h.controls.blocked = false;
  await h.click(remove);
  assert.deepEqual(h.persisted().guides, []);
  assert.equal(h.ui.oldGuide.getAttribute('aria-pressed'), 'false');
  assert.equal(h.ui.oldGuide.textContent, 'Save to reading list');
  assert.doesNotMatch(h.ui.guides.innerHTML, /Existing guide/);
});

test('a first import or stack save after read access resumes merges with previously unread items', async () => {
  const imported = await browserBoundary({denyAccess: true});
  imported.controls.denyAccess = false;
  await imported.importData({version: 1, tools: ['beta'], guides: [{url: '/playbooks/new-guide/', title: 'New guide'}], stacks: []});
  assert.deepEqual(imported.persisted().tools, ['alpha', 'beta']);
  assert.equal(imported.persisted().guides.length, 2);
  assert.equal(imported.persisted().stacks[0].id, 'original-stack');
  const stack = await browserBoundary({denyAccess: true});
  await stack.dispatch(stack.ui.form, 'submit');
  stack.controls.denyAccess = false;
  await stack.click(stack.ui.saveStack);
  assert.equal(stack.persisted().stacks.length, 2);
  assert.equal(stack.persisted().stacks[1].id, 'original-stack');
  assert.deepEqual(stack.persisted().guides, baseline().guides);
  assert.deepEqual(stack.persisted().tools, baseline().tools);
});
