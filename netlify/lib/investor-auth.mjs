import { createHash, createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

// This is a server-side gate. private/investor must never be copied into dist.
// Include private/investor/** in this function's Netlify bundle instead.
// Required Functions-scoped environment variables (there are no defaults):
// SIH_VIP_USERNAME
// SIH_VIP_PASSWORD_HASH = pbkdf2-sha256$600000$<base64url salt>$<base64url digest>
//   salt: at least 16 random bytes; digest: 32 bytes; UTF-8 password input.
// SIH_VIP_SESSION_SECRET = base64url encoding of at least 32 random bytes.
// Rotating any credential or the session secret invalidates existing sessions.

const derivePassword = promisify(pbkdf2);
const COOKIE_NAME = '__Host-sih_investor';
const SESSION_SECONDS = 8 * 60 * 60;
const PASSWORD_ITERATIONS = 600_000;
const MAX_FORM_BYTES = 8_192;
const ROOM_PATH = '/partners/investors/';
const ROUTE_PREFIXES = ['/partners/investors', '/.netlify/functions/investor-portal'];
const ASSETS = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/investor.css', { file: 'investor.css', type: 'text/css; charset=utf-8' }],
  ['/investor.js', { file: 'investor.js', type: 'text/javascript; charset=utf-8' }],
  ['/investor-model.js', { file: 'investor-model.js', type: 'text/javascript; charset=utf-8' }],
]);

function decodeBase64url(value, minimum, maximum) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < minimum || bytes.length > maximum) return null;
  return bytes.toString('base64url') === value ? bytes : null;
}

function readConfiguration(environment) {
  const username = environment?.SIH_VIP_USERNAME;
  const encodedHash = environment?.SIH_VIP_PASSWORD_HASH;
  if (typeof username !== 'string' || username.length < 1 || username.length > 128
      || username !== username.trim() || /[\u0000-\u001f\u007f]/.test(username)
      || typeof encodedHash !== 'string') return null;
  const parts = encodedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256'
      || parts[1] !== String(PASSWORD_ITERATIONS)) return null;
  const salt = decodeBase64url(parts[2], 16, 64);
  const passwordHash = decodeBase64url(parts[3], 32, 32);
  const sessionSecret = decodeBase64url(environment.SIH_VIP_SESSION_SECRET, 32, 128);
  if (!salt || !passwordHash || !sessionSecret) return null;
  // Binding the signing key to the credentials also revokes old sessions when
  // the username or password hash changes, without retaining plaintext secrets.
  const sessionKey = createHmac('sha256', sessionSecret)
    .update('seller-insider-hub/investor-session/v1\0')
    .update(username).update('\0').update(encodedHash).digest();
  return { username, salt, passwordHash, sessionKey };
}

function routeFor(pathname) {
  for (const prefix of ROUTE_PREFIXES) {
    if (pathname === prefix) return '/';
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return null;
}

function securityHeaders(styleNonce) {
  const styleSource = styleNonce ? `'self' 'nonce-${styleNonce}'` : "'self'";
  return new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Netlify-CDN-Cache-Control': 'no-store',
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Cookie, Origin',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
      "object-src 'none'", "form-action 'self'", "script-src 'self'",
      `style-src ${styleSource}`, "img-src 'self' data:", "font-src 'self'",
      "connect-src 'self'", "worker-src 'none'", "manifest-src 'none'",
    ].join('; '),
  });
}

function respond(request, body, status = 200, extraHeaders = {}, styleNonce) {
  const headers = securityHeaders(styleNonce);
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);
  return new Response(request.method === 'HEAD' ? null : body, { status, headers });
}

function sessionCookie(value, timestamp) {
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; `
    + `Expires=${new Date((timestamp + SESSION_SECONDS) * 1000).toUTCString()}; `
    + 'HttpOnly; Secure; SameSite=Lax';
}

function expiredCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; `
    + 'HttpOnly; Secure; SameSite=Lax';
}

function readSessionCookie(request) {
  const header = request.headers.get('cookie');
  if (!header || header.length > 8_192) return null;
  const matching = header.split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${COOKIE_NAME}=`));
  // Reject ambiguous duplicate cookies rather than selecting one by order.
  if (matching.length !== 1) return null;
  const value = matching[0].slice(COOKIE_NAME.length + 1);
  return value.length <= 2_048 ? value : null;
}

function createSession(configuration, origin, timestamp) {
  const body = Buffer.from(JSON.stringify({
    v: 1, iat: timestamp, exp: timestamp + SESSION_SECONDS,
    aud: origin, nonce: randomBytes(16).toString('base64url'),
  })).toString('base64url');
  const unsigned = `v1.${body}`;
  const signature = createHmac('sha256', configuration.sessionKey)
    .update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function hasSession(request, configuration, origin, timestamp) {
  const token = readSessionCookie(request);
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const receivedSignature = decodeBase64url(parts[2], 32, 32);
  const encodedBody = decodeBase64url(parts[1], 1, 1_024);
  if (!receivedSignature || !encodedBody) return false;
  const expectedSignature = createHmac('sha256', configuration.sessionKey)
    .update(`v1.${parts[1]}`).digest();
  if (!timingSafeEqual(receivedSignature, expectedSignature)) return false;
  try {
    const body = JSON.parse(encodedBody.toString('utf8'));
    return body?.v === 1 && body.aud === origin
      && Number.isSafeInteger(body.iat) && Number.isSafeInteger(body.exp)
      && body.exp - body.iat === SESSION_SECONDS
      && body.iat <= timestamp && body.exp > timestamp
      && decodeBase64url(body.nonce, 16, 16) !== null;
  } catch {
    return false;
  }
}

function isSameOriginPost(request, url) {
  const fetchSite = request.headers.get('sec-fetch-site');
  return url.protocol === 'https:' && request.headers.get('origin') === url.origin
    && (!fetchSite || fetchSite === 'same-origin');
}

async function readLoginForm(request) {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/x-www-form-urlencoded') return { error: 415 };
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) return { error: 400 };
    if (Number(declaredLength) > MAX_FORM_BYTES) return { error: 413 };
  }
  if (!request.body) return { error: 400 };
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_FORM_BYTES) {
        await reader.cancel();
        return { error: 413 };
      }
      chunks.push(value);
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, length));
    const form = new URLSearchParams(text);
    if (form.getAll('username').length !== 1 || form.getAll('password').length !== 1) {
      return { error: 400 };
    }
    const username = form.get('username');
    const password = form.get('password');
    if (!username || username.length > 128 || !password
        || Buffer.byteLength(password, 'utf8') > 1_024) return { error: 401 };
    return { username, password };
  } catch {
    return { error: 400 };
  } finally {
    reader.releaseLock();
  }
}

async function correctCredentials(form, configuration) {
  // Always derive the password for a syntactically valid attempt, including an
  // unknown username. Compare fixed-size buffers to avoid username enumeration.
  const suppliedHash = await derivePassword(
    form.password, configuration.salt, PASSWORD_ITERATIONS, 32, 'sha256',
  );
  const suppliedName = createHash('sha256').update(form.username).digest();
  const expectedName = createHash('sha256').update(configuration.username).digest();
  const usernameMatches = timingSafeEqual(suppliedName, expectedName);
  const passwordMatches = timingSafeEqual(suppliedHash, configuration.passwordHash);
  return usernameMatches && passwordMatches;
}

function loginHtml(nonce, { invalid = false, unavailable = false } = {}) {
  const form = unavailable
    ? '<p class="notice" role="status">Investor access is temporarily unavailable. Please try again later.</p>'
    : `<form action="${ROOM_PATH}login" method="post" accept-charset="UTF-8">
        ${invalid ? '<p class="error" id="login-error" role="alert">We couldn’t sign you in. Check your access details and try again.</p>' : ''}
        <label for="username">Username</label>
        <input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="128" required${invalid ? ' aria-describedby="login-error"' : ''}>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" maxlength="1024" required${invalid ? ' aria-describedby="login-error"' : ''}>
        <button type="submit">Enter investor room <span aria-hidden="true">↗</span></button>
        <p class="session-note">Private access. Your session ends after eight hours.</p>
      </form>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="color-scheme" content="light">
<title>Investor access | Seller Insider Hub</title>
<style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#f6f3eb;color:#203c32;font-family:Arial,Helvetica,sans-serif;line-height:1.6}a{color:inherit}button,input{font:inherit}.shell{max-width:1360px;margin:auto;min-height:100svh;padding:36px 48px;display:flex;flex-direction:column}.brand{display:inline-flex;gap:12px;align-items:center;align-self:flex-start;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:-.025em}.brand-mark{display:grid;place-items:center;width:34px;height:38px;border:1px solid #284c3d;border-radius:18px 18px 6px 6px;font-family:Georgia,serif;font-size:19px}.layout{display:grid;grid-template-columns:1.15fr 1fr;gap:clamp(40px,8vw,130px);align-items:center;flex:1;padding:72px 0 88px}.eyebrow{text-transform:uppercase;letter-spacing:.17em;font-size:11px;font-weight:700;margin:0 0 24px;display:flex;align-items:center;gap:12px}.eyebrow:before{content:"";width:28px;height:1px;background:#75917d}h1{font:400 clamp(44px,5.2vw,76px)/1.05 Georgia,"Times New Roman",serif;letter-spacing:-.045em;max-width:650px;margin:0 0 28px}h1 em{font-weight:400;color:#64816b}.lede{font-size:18px;line-height:1.75;max-width:420px;color:#526258;margin:0}.line-art{margin-top:48px;display:flex;align-items:flex-end;gap:10px;height:60px;max-width:270px}.line-art span{display:block;flex:1;border:1px solid #a4b6a2;border-bottom:3px solid #2d5142;border-radius:3px 3px 0 0}.line-art span:nth-child(1){height:27%}.line-art span:nth-child(2){height:42%}.line-art span:nth-child(3){height:36%}.line-art span:nth-child(4){height:65%}.line-art span:nth-child(5){height:82%}.line-art span:nth-child(6){height:100%}.card{background:#fffefb;border:1px solid #dedfd4;border-radius:12px;padding:42px;box-shadow:0 18px 60px #19362908}.card-tag{display:inline-block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;border:1px solid #dce2d7;border-radius:30px;padding:5px 10px;color:#4a6555;margin-bottom:23px}h2{font:400 30px/1.2 Georgia,"Times New Roman",serif;letter-spacing:-.025em;margin:0 0 12px}.intro{font-size:14px;color:#647067;margin:0 0 26px}label{display:block;font-size:13px;font-weight:700;margin:20px 0 7px}input{width:100%;height:49px;border:1px solid #bac5b8;border-radius:5px;padding:10px 12px;background:white;color:#203c32}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #b67f32;outline-offset:4px}button{width:100%;border:1px solid #234a39;border-radius:5px;background:#234a39;color:white;padding:13px 16px;margin-top:26px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:space-between;cursor:pointer}button:hover{background:#163526}.session-note{font-size:11px;color:#667369;line-height:1.6;margin:17px 0 0}.error{font-size:13px;background:#fbefdf;border-left:3px solid #8b5b29;padding:12px 14px;color:#653f1b}.notice{font-size:14px;color:#5b685e;border-top:1px solid #e1e4d9;padding-top:20px}.footer{border-top:1px solid #d8ddcf;padding-top:21px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;font-size:11px;color:#607064}.footer a{text-underline-offset:4px}@media(max-width:760px){.shell{padding:24px}.layout{grid-template-columns:1fr;gap:34px;padding:48px 0}.eyebrow{margin-bottom:18px}h1{font-size:48px}.lede{font-size:16px}.line-art{display:none}.card{padding:28px}.footer{font-size:11px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style></head><body><div class="shell">
<a class="brand" href="/"><span class="brand-mark" aria-hidden="true">S</span>Seller Insider Hub</a>
<main class="layout"><section aria-labelledby="page-title"><p class="eyebrow">Private investor room</p>
<h1 id="page-title">A clearer view<br>of <em>the business.</em></h1>
<p class="lede">Market context. Transparent assumptions. A model you can interrogate.</p>
<div class="line-art" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div></section>
<section class="card" aria-labelledby="sign-in-title"><span class="card-tag">Investor access</span>
<h2 id="sign-in-title">Enter investor room</h2><p class="intro">Sign in with the access details shared with you.</p>${form}</section></main>
<footer class="footer"><span>Seller Insider Hub · Investor access</span><a href="/">Return to the publication</a></footer>
</div></body></html>`;
}

function loginResponse(request, status, options = {}) {
  const nonce = randomBytes(18).toString('base64url');
  return respond(request, loginHtml(nonce, options), status, {
    'Content-Type': 'text/html; charset=utf-8',
    ...(options.clearCookie ? { 'Set-Cookie': expiredCookie() } : {}),
  }, nonce);
}

async function readBundledAsset(filename) {
  // filename comes exclusively from ASSETS, never from a URL or query string.
  return readFile(path.join(process.cwd(), 'private', 'investor', filename));
}

// Dependency injection permits real-crypto, isolated request/response tests.
// The deployed default always uses process.env and bundled files.
export function createInvestorHandler({
  mode = 'portal',
  environment = () => process.env,
  now = () => Date.now(),
  readAsset = readBundledAsset,
} = {}) {
  if (mode !== 'portal' && mode !== 'login') throw new TypeError('Unknown gateway mode.');
  return async function investorPortal(request) {
    const url = new URL(request.url);
    const route = routeFor(url.pathname);
    // Only the dedicated, strictly rate-limited login function may verify
    // credentials. Neither the portal wildcard nor a direct function alias can
    // be used as an alternate login endpoint.
    if ((mode === 'login' && url.pathname !== `${ROOM_PATH}login`)
        || (mode === 'portal' && route === '/login')) {
      return respond(request, 'Not found.', 404);
    }
    const asset = ASSETS.get(route);
    if (!asset && route !== '/login' && route !== '/logout') {
      return respond(request, 'Not found.', 404);
    }
    if (url.protocol !== 'https:') {
      return respond(request, 'A secure connection is required.', 426);
    }
    const allowedMethods = asset ? ['GET', 'HEAD'] : ['POST'];
    if (!allowedMethods.includes(request.method)) {
      return respond(request, 'Method not allowed.', 405, { Allow: allowedMethods.join(', ') });
    }
    if (request.method === 'POST' && !isSameOriginPost(request, url)) {
      return respond(request, 'This request could not be completed.', 403);
    }
    let configuration;
    try {
      configuration = readConfiguration(environment());
    } catch {
      configuration = null;
    }
    if (!configuration) return loginResponse(request, 503, { unavailable: true });
    const timestamp = Math.floor(now() / 1_000);

    if (route === '/logout') {
      // Clear this browser's cookie. Stateless tokens are not individually
      // revoked server-side; expiry or credential/secret rotation revokes them.
      return respond(request, '', 303, { Location: ROOM_PATH, 'Set-Cookie': expiredCookie() });
    }
    if (route === '/login') {
      const form = await readLoginForm(request);
      if (form.error === 401) return loginResponse(request, 401, { invalid: true, clearCookie: true });
      if (form.error) return respond(request, 'This request could not be completed.', form.error);
      let valid = false;
      try {
        valid = await correctCredentials(form, configuration);
      } catch {
        return loginResponse(request, 503, { unavailable: true });
      }
      if (!valid) return loginResponse(request, 401, { invalid: true, clearCookie: true });
      const token = createSession(configuration, url.origin, timestamp);
      return respond(request, '', 303, {
        Location: ROOM_PATH,
        'Set-Cookie': sessionCookie(token, timestamp),
      });
    }

    if (!hasSession(request, configuration, url.origin, timestamp)) {
      if (asset.file === 'index.html') {
        return loginResponse(request, 200, { clearCookie: Boolean(request.headers.get('cookie')) });
      }
      return respond(request, 'Authentication required.', 401);
    }
    try {
      const body = await readAsset(asset.file);
      return respond(request, body, 200, { 'Content-Type': asset.type });
    } catch {
      return loginResponse(request, 503, { unavailable: true });
    }
  };
}
