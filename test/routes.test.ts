import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ADMIN_TOKEN, DESTINATION, ORIGIN } from './helpers/constants';
import { createViaToken } from './helpers/links';

describe('POST /links', () => {
  it('refuses a request without the admin token', async () => {
    expect((await createViaToken(JSON.stringify({ url: DESTINATION }))).status).toBe(401);
  });

  it('refuses a request with the wrong token', async () => {
    expect((await createViaToken(JSON.stringify({ url: DESTINATION }), { token: 'wrong' })).status).toBe(401);
  });

  it.each([
    ['another host', JSON.stringify({ url: 'https://evil.example/pay' })],
    ['plain http', JSON.stringify({ url: 'http://ianmenethil.com/blog' })],
    ['a missing url', JSON.stringify({})],
    ['broken JSON', '{oops'],
    ['a body of null', 'null'],
  ])('refuses %s', async (_case, body) => {
    expect((await createViaToken(body, { token: ADMIN_TOKEN })).status).toBe(400);
  });

  it('creates a link that opens the saved URL', async () => {
    const created = await createViaToken(JSON.stringify({ url: DESTINATION }), { token: ADMIN_TOKEN });
    expect(created.status).toBe(201);
    const { code, shortUrl } = await created.json<{ code: string; shortUrl: string }>();
    expect(code).toMatch(/^[2-9A-HJ-NP-Za-km-z]{8}$/);
    expect(shortUrl).toBe(`${ORIGIN}/s/${code}`);

    const opened = await exports.default.fetch(shortUrl, { redirect: 'manual' });
    expect(opened.status).toBe(302);
    expect(opened.headers.get('Location')).toBe(DESTINATION);
  });
});

describe('GET /s/:code', () => {
  it('returns 404 for an unknown code', async () => {
    expect((await exports.default.fetch(`${ORIGIN}/s/unknown1`)).status).toBe(404);
  });

  it('returns 429 once one visitor passes 100 requests a minute, without blocking other visitors', async () => {
    const open = (visitor: string) =>
      exports.default.fetch(`${ORIGIN}/s/flooded1`, { headers: { 'CF-Connecting-IP': visitor } });
    const statuses: number[] = [];
    for (let i = 0; i < 101; i++) {
      statuses.push((await open('198.51.100.1')).status);
    }
    expect(statuses.slice(0, 100).every((status) => status === 404)).toBe(true);
    expect(statuses[100]).toBe(429);
    expect((await open('198.51.100.2')).status).toBe(404);
  });

  it('counts a visitor across different codes, so new codes do not reset the allowance', async () => {
    const open = (visitor: string, code: string) =>
      exports.default.fetch(`${ORIGIN}/s/${code}`, { headers: { 'CF-Connecting-IP': visitor } });
    const statuses: number[] = [];
    for (let i = 0; i < 101; i++) {
      statuses.push((await open('198.51.100.3', `unknown${i}`)).status);
    }
    expect(statuses.slice(0, 100).every((status) => status === 404)).toBe(true);
    expect(statuses[100]).toBe(429);
    expect((await open('198.51.100.4', 'unknown0')).status).toBe(404);
  });

  it('keeps short links and the API on separate allowances', async () => {
    const visitor = '198.51.100.5';
    for (let i = 0; i < 101; i++) {
      await exports.default.fetch(`${ORIGIN}/s/code${i}`, { headers: { 'CF-Connecting-IP': visitor } });
    }
    const created = await createViaToken(JSON.stringify({ url: DESTINATION }), { token: ADMIN_TOKEN, visitor });
    expect(created.status).toBe(201);
  });
});
