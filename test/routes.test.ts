import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { CreatedShortLink } from '../src/shared/types';
import { ADMIN_TOKEN, DESTINATION, ORIGIN } from './helpers/constants';
import { createViaToken, openShortLink } from './helpers/links';

describe('POST /links', () => {
  it('returns 400 for a request without CF-Connecting-IP', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ url: DESTINATION }),
    });
    expect(response.status).toBe(400);
  });

  it('refuses a body over the size limit with 413', async () => {
    const body = JSON.stringify({ url: `https://ianmenethil.com/${'a'.repeat(10_000)}` });
    const response = await createViaToken(body, { token: ADMIN_TOKEN });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

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
    const { code, shortUrl } = await created.json<CreatedShortLink>();
    expect(code).toMatch(/^[2-9A-HJ-NP-Za-km-z]{8}$/);
    expect(shortUrl).toBe(`${ORIGIN}/s/${code}`);

    const opened = await openShortLink(shortUrl);
    expect(opened.status).toBe(302);
    expect(opened.headers.get('Location')).toBe(DESTINATION);
  });
});

describe('GET /s/:code', () => {
  it('returns 404 for an unknown code', async () => {
    expect((await openShortLink('/s/unknown2')).status).toBe(404);
  });

  it.each([
    ['a code over the KV key limit', 'a'.repeat(513)],
    ['a code with a character outside the alphabet', 'unknown1'],
    ['a code of the wrong length', 'unknown'],
  ])('returns 404 for %s', async (_case, code) => {
    expect((await openShortLink(`/s/${code}`)).status).toBe(404);
  });

  it('returns 400 for a request without CF-Connecting-IP', async () => {
    expect((await exports.default.fetch(`${ORIGIN}/s/unknown2`)).status).toBe(400);
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
