'use strict';

// Production hub.js runs unchanged in a minimal browser boundary. All POSTs are
// captured locally; this suite never contacts Netlify or submits real data.
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../site-assets/hub.js'), 'utf8');
const origin = 'https://sellerinsiderhub.com';
const receipt = '<html><head><title>Thank you!</title></head><body><h1>Thank you!</h1><p>Your form submission has been received.</p></body></html>';
const custom = '<html><head><title>Thank you for getting in touch</title><link rel="canonical" href="https://sellerinsiderhub.com/thank-you/"></head><body><h1>Thank you. Keep exploring.</h1></body></html>';
const soft404 = '<html><head><title>This page took a different turn</title><link rel="canonical" href="https://sellerinsiderhub.com/404.html"></head><body><h1>This page took a different turn.</h1><p>Page not found</p></body></html>';
function response({status = 200, html = receipt, type = 'text/html; charset=UTF-8', url = origin + '/'} = {}) {
  return {ok: status >= 200 && status < 300, status, url, headers: {get: () => type}, text: async () => html};
}

function page(replies = []) {
  const calls = [], navigations = [], timers = new Map(); let timerID = 0;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
      this.listeners = new Map(); this.parentNode = null; this.disabled = false;
      this.hidden = false; this.textContent = ''; this.className = ''; this.type = '';
    }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    focus() { this.focused = true; }
    querySelector(selector) { return selector === '.form-status' ? this.children.find(x => x.className.split(' ').includes('form-status')) || null : null; }
    querySelectorAll(selector) { return selector.includes('[type="submit"]') ? this.children.filter(x => x.type === 'submit') : []; }
  }
  function form(name, fields, existingStatus) {
    const el = new Element('form'); el.setAttribute('name', name); el.setAttribute('action', '/thank-you/');
    el.fields = {'form-name': name, website: '', ...fields}; el.valid = true; el.validityChecks = 0;
    el.reportValidity = () => { el.validityChecks++; return el.valid; };
    el.reset = () => { throw new Error('The handler must not clear entered values'); };
    const submit = el.appendChild(new Element('button')); submit.type = 'submit'; submit.textContent = 'Submit';
    if (existingStatus) { const status = el.appendChild(new Element('p')); status.className = 'form-status'; }
    return el;
  }
  const newsletter = form('sih-newsletter', {email: 'reader+guide@example.test', consent: 'yes'}, true);
  const contact = form('sih-contact', {name: 'Sample Person', email: 'reader@example.test', topic: 'Editorial correction', message: 'Please check A&B <details>.'}, false);
  const forms = [newsletter, contact];
  const document = {
    querySelector: () => null,
    querySelectorAll: selector => selector === 'form[name="sih-newsletter"], form[name="sih-contact"]' ? forms : [],
    createElement: tag => new Element(tag), addEventListener() {},
  };
  const context = {
    document, window: {}, URL, URLSearchParams, AbortController, Intl, console,
    location: {origin, pathname: '/', search: '', assign: url => navigations.push(url)},
    localStorage: {getItem: key => key === 'sih.analytics.v1' ? '"no"' : null},
    setTimeout(callback) { const id = ++timerID; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
    FormData: class extends Map { constructor(el) { super(Object.entries(el.fields)); } },
    DOMParser: class {
      parseFromString(html, type) {
        assert.equal(type, 'text/html');
        const plain = text => text.replace(/<[^>]*>/g, ' ');
        return {
          body: {textContent: plain(html)},
          querySelector(selector) {
            if (selector === 'link[rel="canonical"]') {
              const url = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
              return url ? {getAttribute: () => url} : null;
            }
            const found = html.match(new RegExp('<' + selector + '>([\\s\\S]*?)</' + selector + '>', 'i'));
            return found ? {textContent: plain(found[1])} : null;
          },
        };
      }
    },
    fetch: async (url, options = {}) => {
      if (url === '/data/catalog.json') return {ok: true, json: async () => ({tools: [], categories: []})};
      calls.push({url, ...options});
      assert.ok(replies.length, 'Unexpected submission: native validity and pending guards must prevent it');
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next(options) : next;
    },
  };
  vm.runInNewContext(source, context, {filename: 'site-assets/hub.js'});
  assert.ok(newsletter.listeners.has('submit')); assert.ok(contact.listeners.has('submit'));
  const status = el => el.querySelector('.form-status');
  const retry = el => el.children.find(x => x.className.includes('form-retry'));
  async function submit(el) {
    let prevented = false;
    await el.listeners.get('submit')({preventDefault() { prevented = true; }});
    assert.equal(prevented, true, 'enhancement must prevent failure navigation');
  }
  return {newsletter, contact, calls, navigations, status, retry, submit, timers};
}

function retained(p, form, fields) {
  assert.deepEqual(form.fields, fields);
  assert.equal(p.navigations.length, 0);
  assert.match(p.status(form).textContent, /could not confirm/);
  assert.doesNotMatch(p.status(form).textContent, /Opening the confirmation/);
  assert.equal(p.status(form).getAttribute('role'), 'status');
  assert.equal(p.status(form).getAttribute('aria-live'), 'polite');
  assert.equal(p.status(form).getAttribute('aria-atomic'), 'true');
  assert.equal(p.status(form).focused, true);
  assert.equal(p.retry(form).hidden, false);
  assert.equal(p.retry(form).type, 'submit', 'Retry must go through native form validity again');
  assert.equal(form.getAttribute('aria-busy'), 'false');
  assert.ok(form.querySelectorAll('[type="submit"]').every(x => !x.disabled));
}

test('newsletter sends encoded form name, consent, and honeypot; disables submission while pending and prevents duplicates', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const p = page([() => wait]);
  const pending = p.submit(p.newsletter);
  assert.equal(p.newsletter.getAttribute('aria-busy'), 'true');
  assert.ok(p.newsletter.querySelectorAll('[type="submit"]').every(x => x.disabled));
  assert.equal(p.retry(p.newsletter).hidden, true);
  await p.submit(p.newsletter);
  assert.equal(p.calls.length, 1);
  const sent = p.calls[0], data = new URLSearchParams(sent.body);
  assert.equal(sent.url, '/'); assert.equal(sent.method, 'POST'); assert.equal(sent.credentials, 'same-origin');
  assert.equal(sent.redirect, 'follow', 'a valid same-origin success redirect must be allowed');
  assert.equal(sent.mode, 'same-origin', 'cross-origin redirects must be blocked before forwarding data');
  assert.equal(sent.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(data.get('form-name'), 'sih-newsletter');
  assert.equal(data.get('email'), 'reader+guide@example.test');
  assert.equal(data.get('consent'), 'yes'); assert.equal(data.has('website'), true); assert.equal(data.get('website'), '');
  release(response()); await pending;
  assert.deepEqual(p.navigations, ['/thank-you/']);
  assert.match(p.status(p.newsletter).textContent, /Opening the confirmation/);
  assert.equal(p.timers.size, 0);
});

test('contact accepts the expected custom receipt and preserves correctly encoded message content', async () => {
  const p = page([response({html: custom})]);
  await p.submit(p.contact);
  assert.equal(new URLSearchParams(p.calls[0].body).get('message'), p.contact.fields.message);
  assert.equal(new URLSearchParams(p.calls[0].body).get('form-name'), 'sih-contact');
  assert.deepEqual(p.navigations, ['/thank-you/']);
});

test('HTTP failure including a success-looking body keeps inputs and Retry, then a valid retry succeeds', async () => {
  const p = page([response({status: 404, html: custom}), response({html: custom})]);
  const before = {...p.contact.fields};
  await p.submit(p.contact); retained(p, p.contact, before);
  await p.submit(p.contact);
  assert.equal(p.calls.length, 2);
  assert.equal(p.calls[0].body, p.calls[1].body);
  assert.deepEqual(p.navigations, ['/thank-you/']);
  assert.equal(p.retry(p.contact).hidden, true);
});

test('200 soft-404 and external responses are never treated as success', async () => {
  for (const result of [response({html: soft404}), response({html: soft404, type: ''}), response({url: 'https://elsewhere.example/thanks/'})]) {
    const p = page([result]); const before = {...p.newsletter.fields};
    await p.submit(p.newsletter); retained(p, p.newsletter, before);
  }
});

test('successful responses do not require an undocumented receipt format and cannot trigger a duplicate POST', async () => {
  for (const result of [
    response({html: '<h1>Submission accepted</h1>'}),
    response({html: ''}),
    response({status: 204, html: '', type: ''}),
    response({html: '{"ok":true}', type: 'application/json'}),
    response({html: custom, url: origin + '/thank-you/'}),
    {...response(), text: async () => { throw new TypeError('Response stream interrupted after 200'); }},
  ]) {
    const p = page([result]);
    await p.submit(p.newsletter);
    assert.deepEqual(p.navigations, ['/thank-you/']);
    assert.equal(p.retry(p.newsletter).hidden, true);
    assert.ok(p.newsletter.querySelectorAll('[type="submit"]').every(x => x.disabled));
    await p.submit(p.newsletter);
    assert.equal(p.calls.length, 1, 'an acknowledged request must not be sent again while navigation is pending');
  }
});

test('network failure preserves entered values, releases controls, and can be retried', async () => {
  const p = page([new TypeError('Network offline'), response()]); const before = {...p.newsletter.fields};
  await p.submit(p.newsletter); retained(p, p.newsletter, before);
  assert.match(p.status(p.newsletter).textContent, /may already have reached us/, 'a lost response cannot prove the POST failed');
  assert.equal(p.calls.length, 1, 'failed requests are never retried automatically');
  await p.submit(p.newsletter);
  assert.equal(p.calls.length, 2);
  assert.deepEqual(p.navigations, ['/thank-you/']);
});

test('native invalid fields or missing newsletter consent prevent both POST and navigation, including on retry', async () => {
  const p = page([response({status: 503})]);
  p.newsletter.valid = false; delete p.newsletter.fields.consent;
  await p.submit(p.newsletter);
  assert.equal(p.calls.length, 0); assert.equal(p.newsletter.validityChecks, 1);
  p.newsletter.valid = true; p.newsletter.fields.consent = 'yes';
  await p.submit(p.newsletter);
  assert.equal(p.retry(p.newsletter).hidden, false);
  p.newsletter.valid = false; delete p.newsletter.fields.consent;
  await p.submit(p.newsletter);
  assert.equal(p.calls.length, 1); assert.equal(p.navigations.length, 0);
});

test('external form actions are rejected before any form data is sent', async () => {
  const p = page(); p.contact.setAttribute('action', 'https://elsewhere.example/');
  const before = {...p.contact.fields};
  await p.submit(p.contact); retained(p, p.contact, before);
  assert.equal(p.calls.length, 0);
});

test('a timed-out request releases the form and retains its values for retry', async () => {
  const p = page([options => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Request timed out')));
  })]);
  const before = {...p.contact.fields};
  const pending = p.submit(p.contact);
  assert.equal(p.contact.getAttribute('aria-busy'), 'true');
  for (const expire of [...p.timers.values()]) expire();
  await pending;
  retained(p, p.contact, before);
  assert.equal(p.timers.size, 0);
});
