import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../src/worker/env';
import { CERTS_CACHE_SECONDS, requireAccess } from '../src/worker/lib/access';
import { ADMIN_EMAIL, CERTS_URL, accessToken, serveAccessKeys } from './helpers/access';
import { AUD, TEAM_DOMAIN } from './helpers/constants';

const app = new Hono<AppEnv>();
app.use(requireAccess);
app.get('/admin', (c) => c.text(c.get('adminEmail')));

/** Execution context without `ctx.access`, as when the runtime does not provide it. */
const plainCtx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

const configured = { ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, ACCESS_AUD: AUD };

/**
 * Calls the test app.
 * @param env - Admin settings.
 * @param headers - Request headers.
 * @param ctx - Execution context.
 * @returns The response.
 */
const call = (env: Partial<CloudflareBindings>, headers: HeadersInit = {}, ctx: ExecutionContext = plainCtx) =>
  app.request('/admin', { headers }, env, ctx);

beforeEach(serveAccessKeys);
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requireAccess', () => {
  it('refuses every request until ACCESS_TEAM_DOMAIN and ACCESS_AUD are set', async () => {
    const response = await call({ ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' }, { 'Cf-Access-Jwt-Assertion': await accessToken() });
    expect(response.status).toBe(403);
    expect(await response.text()).toContain('Admin is not configured');
  });

  it('accepts ctx.access for this application and uses its email', async () => {
    const ctx = { ...plainCtx, access: { aud: AUD, getIdentity: async () => ({ email: 'sam@ianmenethil.com' }) } };
    const response = await call(configured, {}, ctx as ExecutionContext);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('sam@ianmenethil.com');
  });

  it('refuses ctx.access for a different application', async () => {
    const ctx = { ...plainCtx, access: { aud: 'other-app', getIdentity: async () => undefined } };
    expect((await call(configured, {}, ctx as ExecutionContext)).status).toBe(403);
  });

  it('refuses a request with no Access token', async () => {
    expect((await call(configured)).status).toBe(401);
  });

  it('accepts a valid Access token and uses its email', async () => {
    const response = await call(configured, { 'Cf-Access-Jwt-Assertion': await accessToken() });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(ADMIN_EMAIL);
  });

  // Miniflare does not emulate Cloudflare's edge cache, so the test cannot count real fetches to the
  // certs URL; it checks that every key fetch asks the edge cache to keep the response for 5 minutes.
  it('asks Cloudflare to cache the signing keys instead of fetching them on every request', async () => {
    const token = await accessToken();
    await call(configured, { 'Cf-Access-Jwt-Assertion': token });
    await call(configured, { 'Cf-Access-Jwt-Assertion': token });
    const certsFetches = vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === CERTS_URL);
    expect(certsFetches).toHaveLength(2);
    for (const [, init] of certsFetches) {
      expect(init).toEqual({ cf: { cacheTtl: CERTS_CACHE_SECONDS, cacheEverything: true } });
    }
  });

  it('refuses a token for a different application', async () => {
    const token = await accessToken({ aud: ['other-app'] });
    expect((await call(configured, { 'Cf-Access-Jwt-Assertion': token })).status).toBe(401);
  });

  it('refuses a token from a different team', async () => {
    const token = await accessToken({ iss: 'https://other.cloudflareaccess.com' });
    expect((await call(configured, { 'Cf-Access-Jwt-Assertion': token })).status).toBe(401);
  });

  it('refuses an expired token', async () => {
    const token = await accessToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect((await call(configured, { 'Cf-Access-Jwt-Assertion': token })).status).toBe(401);
  });

  it('refuses a token that has been tampered with', async () => {
    const [header, , signature] = (await accessToken()).split('.');
    const forgedPayload = btoa(JSON.stringify({ iss: TEAM_DOMAIN, aud: [AUD], email: 'mallory@evil.example' }))
      .replaceAll('=', '')
      .replaceAll('+', '-')
      .replaceAll('/', '_');
    const response = await call(configured, { 'Cf-Access-Jwt-Assertion': `${header}.${forgedPayload}.${signature}` });
    expect(response.status).toBe(401);
  });
});
