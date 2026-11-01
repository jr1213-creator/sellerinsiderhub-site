import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createInvestorHandler } from '../netlify/lib/investor-auth.mjs';
import { config as portalConfig } from '../netlify/functions/investor-portal.mjs';
import { config as loginConfig } from '../netlify/functions/investor-login.mjs';

// These are generated, disposable test credentials, never deployment secrets.
const ORIGIN = 'https://sellerinsiderhub.com';
const ROOM = '/partners/investors/';
const NAME = 'test-investor';
const PASSWORD = randomBytes(24).toString('base64url');
const SALT = randomBytes(18);
const HASH = pbkdf2Sync(PASSWORD, SALT, 600_000, 32, 'sha256');
const ENVIRONMENT = {
  SIH_VIP_USERNAME: NAME,
  SIH_VIP_PASSWORD_HASH: `pbkdf2-sha256$600000$${SALT.toString('base64url')}$${HASH.toString('base64url')}`,
  SIH_VIP_SESSION_SECRET: randomBytes(32).toString('base64url'),
};
const FIXTURES = new Map([
  ['index.html', '<!doctype html><title>Private fixture</title><h1>PRIVATE_FINANCIAL_FIXTURE</h1>'],
  ['investor.css', ':root{--private-fixture:1}'],
  ['investor.js', 'const PRIVATE_INVESTOR_FIXTURE = true;'],
  ['investor-model.js', 'export const PRIVATE_MODEL_FIXTURE = 101;'],
  ['investor-costs.js', 'const PRIVATE_COST_FIXTURE = 102;'],
]);

function harness(overrides = {}) {
  let environment = { ...ENVIRONMENT, ...overrides };
  let clock = 1_800_000_000_000;
  const reads = [];
  const options = {
    environment: () => environment,
    now: () => clock,
    readAsset: async filename => {
      reads.push(filename);
      assert.ok(FIXTURES.has(filename), 'only a fixed allowlisted filename may reach the file reader');
      return FIXTURES.get(filename);
    },
  };
  return {
    portal: createInvestorHandler(options),
    login: createInvestorHandler({ ...options, mode: 'login' }),
    reads,
    advance: seconds => { clock += seconds * 1_000; },
    replaceEnvironment: next => { environment = next; },
  };
}

function getRequest(route = ROOM, cookie, options = {}) {
  return new Request(`${options.origin || ORIGIN}${route}`, {
    method: options.method || 'GET',
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function postRequest(route = `${ROOM}login`, options = {}) {
  const headers = new Headers({
    Origin: ORIGIN,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Sec-Fetch-Site': 'same-origin',
    ...options.headers,
  });
  if (options.omitOrigin) headers.delete('Origin');
  const body = options.body ?? new URLSearchParams({
    username: options.username ?? NAME,
    password: options.password ?? PASSWORD,
  }).toString();
  return new Request(`${ORIGIN}${route}`, { method: 'POST', headers, body });
}

async function signIn(instance) {
  const response = await instance.login(postRequest());
  assert.equal(response.status, 303, 'correct credentials must complete the POST/redirect/GET flow');
  assert.equal(response.headers.get('location'), ROOM);
  const header = response.headers.get('set-cookie');
  assert.match(header, /^__Host-sih_investor=v1\./);
  return { response, cookie: header.split(';')[0] };
}

function privateHeaders(response) {
  assert.match(response.headers.get('cache-control'), /private/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('netlify-cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
}

test('an anonymous visitor receives a usable login, with no private bytes or credential hints', async () => {
  const instance = harness();
  const response = await instance.portal(getRequest());
  assert.equal(response.status, 200);
  privateHeaders(response);
  const html = await response.text();
  assert.match(html, /Market context\. Transparent assumptions\. A model you can interrogate\./);
  assert.match(html, /action="\/partners\/investors\/login" method="post"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.ok(!html.includes(NAME));
  assert.ok(!html.includes(PASSWORD));
  assert.ok(!html.includes('PRIVATE_FINANCIAL_FIXTURE'));
  const nonce = html.match(/<style nonce="([A-Za-z0-9_-]+)">/)[1];
  assert.ok(response.headers.get('content-security-policy').includes(`'nonce-${nonce}'`));
  assert.deepEqual(instance.reads, []);
});

test('all private assets and direct function aliases require a session before any file read', async () => {
  const instance = harness();
  for (const prefix of ['/partners/investors', '/.netlify/functions/investor-portal']) {
    for (const filename of ['investor.css', 'investor.js', 'investor-model.js', 'investor-costs.js']) {
      const response = await instance.portal(getRequest(`${prefix}/${filename}`));
      assert.equal(response.status, 401);
      privateHeaders(response);
      assert.equal(await response.text(), 'Authentication required.');
    }
    const response = await instance.portal(getRequest(prefix));
    assert.equal(response.status, 200);
    assert.ok(!(await response.text()).includes('PRIVATE_FINANCIAL_FIXTURE'));
  }
  assert.deepEqual(instance.reads, []);
});

test('native login and logout pages preserve the same-origin metadata required by strict CSRF checks', async () => {
  const instance = harness();
  const pageUrl = new URL(ROOM, ORIGIN);
  const page = await instance.portal(getRequest());
  const html = await page.text();
  // Node's Request does not synthesize a browser's Origin header. Assert the
  // browser-facing policy and native form target, then exercise the strict
  // handler with the Origin that Fetch §3.2 preserves under this policy.
  assert.equal(page.headers.get('referrer-policy'), 'same-origin');
  assert.doesNotMatch(html, /<meta\b[^>]*\bname=["']referrer["']/i,
    'a document-level override must not silently restore no-referrer');
  const formAction = html.match(/<form\b[^>]*\baction="([^"]+)"[^>]*\bmethod="post"/i)[1];
  const target = new URL(formAction, pageUrl);
  assert.equal(target.origin, pageUrl.origin);
  assert.equal(target.pathname, `${ROOM}login`);
  const signedIn = await instance.login(postRequest(target.pathname, {
    headers: { Origin: pageUrl.origin },
  }));
  assert.equal(signedIn.status, 303);
  const cookie = signedIn.headers.get('set-cookie').split(';')[0];
  const room = await instance.portal(getRequest(ROOM, cookie));
  assert.equal(room.status, 200);
  assert.equal(room.headers.get('referrer-policy'), 'same-origin',
    'the authenticated document must also preserve the native logout Origin');
  const signedOut = await instance.portal(postRequest(`${ROOM}logout`, {
    headers: { Cookie: cookie, Origin: pageUrl.origin }, body: '',
  }));
  assert.equal(signedOut.status, 303);
  assert.match(signedOut.headers.get('set-cookie'), /Max-Age=0/);
});

test('missing or malformed deployment secrets keep both page and login closed', async () => {
  const invalid = [
    { SIH_VIP_USERNAME: undefined },
    { SIH_VIP_USERNAME: ' reader ' },
    { SIH_VIP_PASSWORD_HASH: undefined },
    { SIH_VIP_PASSWORD_HASH: 'plaintext-is-not-a-hash' },
    { SIH_VIP_PASSWORD_HASH: ENVIRONMENT.SIH_VIP_PASSWORD_HASH.replace('$600000$', '$1000$') },
    { SIH_VIP_SESSION_SECRET: undefined },
    { SIH_VIP_SESSION_SECRET: randomBytes(16).toString('base64url') },
    { SIH_VIP_SESSION_SECRET: `${ENVIRONMENT.SIH_VIP_SESSION_SECRET}=` },
  ];
  for (const override of invalid) {
    const instance = harness(override);
    for (const response of [
      await instance.portal(getRequest()),
      await instance.portal(getRequest(`${ROOM}investor-model.js`)),
      await instance.login(postRequest()),
    ]) {
      assert.equal(response.status, 503);
      privateHeaders(response);
      const body = await response.text();
      assert.ok(!body.includes('PRIVATE_FINANCIAL_FIXTURE'));
      assert.ok(!body.includes('SIH_VIP_'));
    }
    assert.deepEqual(instance.reads, []);
  }
});

test('successful login issues an eight-hour host-only secure HttpOnly cookie and fixed redirect', async () => {
  const instance = harness();
  const { response } = await signIn(instance);
  privateHeaders(response);
  const cookie = response.headers.get('set-cookie');
  for (const part of ['Path=/', 'Max-Age=28800', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
    assert.ok(cookie.includes(part), part);
  }
  assert.ok(!cookie.includes('Domain='));
  assert.ok(!cookie.includes(PASSWORD));
  assert.equal(await response.text(), '');
  assert.deepEqual(instance.reads, []);
});

test('wrong username and wrong password receive the same generic visible error', async () => {
  const instance = harness();
  const responses = await Promise.all([
    instance.login(postRequest(undefined, { username: 'unknown-reader' })),
    instance.login(postRequest(undefined, { password: `${PASSWORD}-wrong` })),
  ]);
  const messages = [];
  for (const response of responses) {
    assert.equal(response.status, 401);
    privateHeaders(response);
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
    const body = await response.text();
    messages.push(body.match(/<p class="error"[^>]*>([^<]+)<\/p>/)[1]);
    assert.ok(!body.includes(NAME));
    assert.ok(!body.includes(PASSWORD));
    assert.ok(!body.includes('unknown-reader'));
  }
  assert.equal(messages[0], messages[1]);
  assert.deepEqual(instance.reads, []);
});

test('a genuine session serves only allowlisted files, including authenticated HEAD and aliases', async () => {
  const instance = harness();
  const { cookie } = await signIn(instance);
  for (const [filename, expected] of FIXTURES) {
    for (const prefix of ['/partners/investors', '/.netlify/functions/investor-portal']) {
      const response = await instance.portal(getRequest(`${prefix}/${filename}`, cookie));
      assert.equal(response.status, 200);
      privateHeaders(response);
      assert.equal(await response.text(), expected);
      assert.match(response.headers.get('content-type'), filename.endsWith('.html') ? /text\/html/ : filename.endsWith('.css') ? /text\/css/ : /javascript/);
    }
  }
  const head = await instance.portal(getRequest(`${ROOM}investor-model.js`, cookie, { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  privateHeaders(head);
});

test('tampered, malformed and duplicate session cookies cannot expose an asset', async () => {
  const instance = harness();
  const { cookie } = await signIn(instance);
  const token = cookie.slice(cookie.indexOf('=') + 1);
  const parts = token.split('.');
  const forgedBody = Buffer.from(JSON.stringify({ v: 1, iat: 1, exp: 9999999999, aud: ORIGIN })).toString('base64url');
  const forgedSignature = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
  for (const candidate of [
    '__Host-sih_investor=invalid',
    `__Host-sih_investor=v1.${forgedBody}.${parts[2]}`,
    `__Host-sih_investor=v1.${parts[1]}.${forgedSignature}`,
    `${cookie}; ${cookie}`,
    `__Host-sih_investor=${'x'.repeat(3_000)}`,
  ]) {
    const response = await instance.portal(getRequest(`${ROOM}investor-model.js`, candidate));
    assert.equal(response.status, 401);
    privateHeaders(response);
  }
  assert.deepEqual(instance.reads, []);
});

test('a session expires at eight hours, never slides with use, and rejects a future issue time', async () => {
  const instance = harness();
  const { cookie } = await signIn(instance);
  instance.advance(-1);
  assert.equal((await instance.portal(getRequest(`${ROOM}investor.css`, cookie))).status, 401);
  instance.advance(28_800);
  const nearExpiry = await instance.portal(getRequest(`${ROOM}investor.css`, cookie));
  assert.equal(nearExpiry.status, 200);
  assert.equal(nearExpiry.headers.get('set-cookie'), null, 'reading must not extend the session');
  instance.advance(1);
  assert.equal((await instance.portal(getRequest(`${ROOM}investor.css`, cookie))).status, 401);
});

test('a signed session is bound to its origin and to the current credentials', async () => {
  const instance = harness();
  const { cookie } = await signIn(instance);
  const anotherOrigin = await instance.portal(getRequest(`${ROOM}investor.css`, cookie, {
    origin: 'https://preview.example.net',
  }));
  assert.equal(anotherOrigin.status, 401);
  for (const update of [
    { SIH_VIP_USERNAME: 'a-new-test-user' },
    { SIH_VIP_SESSION_SECRET: randomBytes(32).toString('base64url') },
    { SIH_VIP_PASSWORD_HASH: `pbkdf2-sha256$600000$${SALT.toString('base64url')}$${randomBytes(32).toString('base64url')}` },
  ]) {
    instance.replaceEnvironment({ ...ENVIRONMENT, ...update });
    assert.equal((await instance.portal(getRequest(`${ROOM}investor.css`, cookie))).status, 401);
  }
});

test('login and logout reject missing, foreign and opaque origins before accepting an action', async () => {
  const instance = harness();
  for (const [handler, route] of [[instance.login, `${ROOM}login`], [instance.portal, `${ROOM}logout`]]) {
    for (const options of [
      { omitOrigin: true },
      { headers: { Origin: 'https://unrelated.example' } },
      { headers: { Origin: 'null' } },
      { headers: { Origin: 'https://sellerinsiderhub.com.evil.example' } },
      { headers: { 'Sec-Fetch-Site': 'cross-site' } },
    ]) {
      const response = await handler(postRequest(route, options));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('set-cookie'), null);
      privateHeaders(response);
    }
  }
  assert.deepEqual(instance.reads, []);
});

test('logout requires POST and expires the browser cookie without returning private data', async () => {
  const instance = harness();
  const { cookie } = await signIn(instance);
  const invalidMethod = await instance.portal(getRequest(`${ROOM}logout`, cookie));
  assert.equal(invalidMethod.status, 405);
  assert.equal(invalidMethod.headers.get('set-cookie'), null);
  const response = await instance.portal(postRequest(`${ROOM}logout`, { headers: { Cookie: cookie }, body: '' }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), ROOM);
  assert.match(response.headers.get('set-cookie'), /^__Host-sih_investor=;.*Max-Age=0/);
  privateHeaders(response);
  const clearedCookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal((await instance.portal(getRequest(`${ROOM}investor.js`, clearedCookie))).status, 401);
});

test('the permissive portal and all direct aliases cannot be used to bypass the login function', async () => {
  let configurationReads = 0;
  const environment = () => { configurationReads += 1; return ENVIRONMENT; };
  const portal = createInvestorHandler({ environment });
  const login = createInvestorHandler({ mode: 'login', environment });
  for (const route of [
    `${ROOM}login`, '/.netlify/functions/investor-portal/login',
    ROOM, '/.netlify/functions/investor-portal',
  ]) {
    const response = await portal(postRequest(route));
    assert.ok([404, 405].includes(response.status));
    assert.equal(response.headers.get('set-cookie'), null);
    privateHeaders(response);
  }
  for (const route of [
    '/.netlify/functions/investor-login', '/.netlify/functions/investor-login/login',
    '/.netlify/functions/investor-portal/login', `${ROOM}login/`, `${ROOM}LOGIN`,
    `${ROOM}%6cogin`, ROOM,
  ]) {
    const response = await login(postRequest(route));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(configurationReads, 0, 'blocked alternate paths must not even load login configuration');
});

test('native limits are declared on separate paths; platform enforcement is not simulated by these tests', () => {
  assert.equal(loginConfig.path, `${ROOM}login`);
  assert.equal(loginConfig.rateLimit.windowLimit, 6);
  assert.equal(loginConfig.rateLimit.windowSize, 60);
  assert.deepEqual(loginConfig.rateLimit.aggregateBy, ['ip', 'domain']);
  assert.equal(portalConfig.rateLimit.windowLimit, 120);
  assert.ok(portalConfig.excludedPath.includes(`${ROOM}login`));
  assert.equal(portalConfig.preferStatic, false);
  assert.equal(loginConfig.preferStatic, false);
});

test('unknown, encoded and traversal paths never reach the file reader, even after authentication', async () => {
  const instance = harness();
  const { cookie } = await signIn(instance);
  for (const route of [
    `${ROOM}../secrets.json`, `${ROOM}%2e%2e/secrets.json`, `${ROOM}%2f..%2fsecrets.json`,
    `${ROOM}investor.css%00`, `${ROOM}%69nvestor.css`, `${ROOM}assets/../../secrets.json`,
    `${ROOM}investor.css/extra`, `${ROOM}server.env`, '/private/investor/index.html',
    '/.netlify/functions/investor-portal/../investor-auth.mjs',
  ]) {
    const response = await instance.portal(getRequest(route, cookie));
    assert.equal(response.status, 404);
    privateHeaders(response);
    assert.equal(await response.text(), 'Not found.');
  }
  assert.deepEqual(instance.reads, []);
});

test('malformed forms, unsupported content types and oversized streamed bodies are rejected', async () => {
  const instance = harness();
  const cases = [
    [{ headers: { 'Content-Type': 'application/json' }, body: '{}' }, 415],
    [{ body: 'username=a&username=b&password=c' }, 400],
    [{ body: 'username=a' }, 400],
    [{ headers: { 'Content-Length': '99999' } }, 413],
    [{ body: `username=a&password=${'x'.repeat(9_000)}` }, 413],
  ];
  for (const [options, status] of cases) {
    const response = await instance.login(postRequest(undefined, options));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('set-cookie'), null);
    privateHeaders(response);
  }
  const http = new Request('http://sellerinsiderhub.com/partners/investors/');
  const response = await instance.portal(http);
  assert.equal(response.status, 426);
  privateHeaders(response);
  assert.deepEqual(instance.reads, []);
});

test('missing bundled files fail closed without revealing filesystem or error details', async () => {
  const instance = harness();
  const { cookie } = await signIn(instance);
  const portal = createInvestorHandler({
    environment: () => ENVIRONMENT,
    now: () => 1_800_000_000_000,
    readAsset: async () => { throw new Error('/private/sensitive-path failed'); },
  });
  const response = await portal(getRequest(ROOM, cookie));
  assert.equal(response.status, 503);
  privateHeaders(response);
  const body = await response.text();
  assert.ok(!body.includes('sensitive-path'));
  assert.ok(!body.includes('PRIVATE_FINANCIAL_FIXTURE'));
});

test('the production file reader resolves bundled files under cwd/private/investor', async () => {
  const initialDirectory = process.cwd();
  const directory = await mkdtemp(path.join(tmpdir(), 'sih-investor-test-'));
  try {
    await mkdir(path.join(directory, 'private', 'investor'), { recursive: true });
    await writeFile(path.join(directory, 'private', 'investor', 'investor-model.js'), 'export const bundled = 1;');
    const instance = harness();
    const { cookie } = await signIn(instance);
    const portal = createInvestorHandler({ environment: () => ENVIRONMENT, now: () => 1_800_000_000_000 });
    process.chdir(directory);
    const response = await portal(getRequest(`${ROOM}investor-model.js`, cookie));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'export const bundled = 1;');
  } finally {
    process.chdir(initialDirectory);
    await rm(directory, { recursive: true, force: true });
  }
});
