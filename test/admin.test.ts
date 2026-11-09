import { exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatedLink, LinkRecord } from '../src/shared/types';
import { ADMIN_EMAIL, accessToken, serveAccessKeys } from './helpers/access';
import { ADMIN_TOKEN, DESTINATION, ORIGIN } from './helpers/constants';
import { createViaToken } from './helpers/links';

const OTHER_SITE = 'https://evil.example';

/**
 * Calls an admin path the way the panel does in a browser: with the Access token Cloudflare
 * forwards for a signed-in user and the headers a browser adds to a same-site request.
 * @param path - Path below `/admin`.
 * @param init - Request options.
 * @returns The Worker's response.
 */
const asAdmin = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  headers.set('Cf-Access-Jwt-Assertion', await accessToken());
  if (!headers.has('Origin')) {
    headers.set('Origin', ORIGIN);
    headers.set('Sec-Fetch-Site', 'same-origin');
  }
  return exports.default.fetch(`${ORIGIN}/admin${path}`, { ...init, headers });
};

/**
 * Calls the admin API the way the panel does.
 * @param path - Path below `/admin/api`.
 * @param init - Request options.
 * @returns The Worker's response.
 */
const adminApi = (path: string, init?: RequestInit): Promise<Response> => asAdmin(`/api${path}`, init);

/**
 * Creates a link through the admin API.
 * @param url - The destination URL.
 * @param headers - Extra request headers.
 * @returns The Worker's response.
 */
const createViaAdmin = (url: string, headers: HeadersInit = {}): Promise<Response> =>
  adminApi('/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ url }),
  });

beforeEach(serveAccessKeys);
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin panel', () => {
  it('refuses a visitor who did not come through Cloudflare Access', async () => {
    expect((await exports.default.fetch(`${ORIGIN}/admin`)).status).toBe(401);
    expect((await exports.default.fetch(`${ORIGIN}/admin/api/links`)).status).toBe(401);
  });

  it('refuses the panel files too without an Access sign-in', async () => {
    expect((await exports.default.fetch(`${ORIGIN}/admin/`)).status).toBe(401);
    expect((await exports.default.fetch(`${ORIGIN}/admin/assets/anything.js`)).status).toBe(401);
  });

  it('sends /admin to /admin/', async () => {
    const response = await asAdmin('', { redirect: 'manual' });
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('/admin/');
  });

  it('serves the page with security headers, using only its own script and stylesheet', async () => {
    const response = await asAdmin('/');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    const html = await response.text();
    expect(html).toContain('<div id="root"></div>');
    expect(html).toMatch(/<script type="module"[^>]* src="\/admin\/assets\/[^"]+\.js"/);
    // The page's CSP forbids inline scripts, so the built page must not need any.
    expect(html).not.toMatch(/<script(?![^>]* src=)[^>]*>/);
  });

  it('serves its script with the security headers', async () => {
    const html = await (await asAdmin('/')).text();
    const [, scriptPath] = html.match(/ src="\/admin(\/assets\/[^"]+\.js)"/) ?? [];
    expect(scriptPath).toBeDefined();
    const script = await asAdmin(scriptPath!);
    expect(script.status).toBe(200);
    expect(script.headers.get('Content-Type')).toContain('javascript');
    expect(script.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('sends the site root to the panel', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/admin/');
  });
});

describe('admin API', () => {
  it('tells the panel who is signed in and the brand name', async () => {
    const response = await adminApi('/me');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: ADMIN_EMAIL, brand: 'Menethil' });
  });

  it('tells browsers and caches not to keep its answers', async () => {
    expect((await adminApi('/me')).headers.get('Cache-Control')).toBe('no-store');
    expect((await adminApi('/links')).headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses a request body of null with 400', async () => {
    const response = await adminApi('/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    expect(response.status).toBe(400);
  });

  it('creates, lists and deletes a link', async () => {
    const created = await createViaAdmin(DESTINATION);
    expect(created.status).toBe(201);
    const { link, shortUrl } = await created.json<CreatedLink>();
    expect(link).toMatchObject({ url: DESTINATION, createdBy: ADMIN_EMAIL });
    expect(shortUrl).toBe(`${ORIGIN}/s/${link.code}`);

    const listed = await adminApi('/links');
    const { links } = await listed.json<{ links: LinkRecord[] }>();
    expect(links.map((item) => item.code)).toContain(link.code);

    expect((await adminApi(`/links/${link.code}`, { method: 'DELETE' })).status).toBe(204);
    expect((await exports.default.fetch(shortUrl)).status).toBe(404);
  });

  it('refuses a URL outside ALLOWED_HOSTS', async () => {
    const response = await createViaAdmin('https://evil.example/pay');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Enter an https link to one of your allowed sites.' });
  });

  it('lists links created through the token route as created by "api"', async () => {
    const created = await createViaToken(JSON.stringify({ url: DESTINATION }), { token: ADMIN_TOKEN });
    const { code } = await created.json<{ code: string }>();
    const { links } = await (await adminApi('/links')).json<{ links: LinkRecord[] }>();
    expect(links.find((item) => item.code === code)?.createdBy).toBe('api');
  });
});

describe('admin API answers only its own panel', () => {
  it('gives other sites no CORS permission to read it', async () => {
    const response = await adminApi('/links', { headers: { Origin: OTHER_SITE, 'Sec-Fetch-Site': 'cross-site' } });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('does not approve a CORS preflight from another site', async () => {
    const response = await adminApi('/links', {
      method: 'OPTIONS',
      headers: {
        Origin: OTHER_SITE,
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
  });

  it('refuses a form posted from another site', async () => {
    const response = await adminApi('/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: OTHER_SITE, 'Sec-Fetch-Site': 'cross-site' },
      body: 'url=https%3A%2F%2Fianmenethil.com%2F',
    });
    expect(response.status).toBe(403);
  });

  it('refuses a delete sent from another site', async () => {
    const created = await createViaAdmin(DESTINATION);
    const { link } = await created.json<CreatedLink>();
    const response = await adminApi(`/links/${link.code}`, {
      method: 'DELETE',
      headers: { Origin: OTHER_SITE, 'Sec-Fetch-Site': 'cross-site' },
    });
    expect(response.status).toBe(403);
    expect((await exports.default.fetch(`${ORIGIN}/s/${link.code}`, { redirect: 'manual' })).status).toBe(302);
  });
});
