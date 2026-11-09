import { sign } from 'hono/jwt';
import { vi } from 'vitest';
import { AUD, TEAM_DOMAIN } from './constants';

/** Where the team publishes its signing keys. */
export const CERTS_URL = `${TEAM_DOMAIN}/cdn-cgi/access/certs`;

/** Email of the signed-in user in the tests' Access tokens. */
export const ADMIN_EMAIL = 'admin@ianmenethil.com';

const KEY_ID = 'test-key';

const keyPair = (await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
)) as CryptoKeyPair;

// A `kid` on the signing key puts it in the token header, where the verifier matches it to the key set.
const privateJwk = { ...((await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey), kid: KEY_ID };
const publicJwk = { ...((await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey), kid: KEY_ID };

/** Serves the test key set from the team's certs URL, the way Cloudflare Access does. */
export const serveAccessKeys = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input) === CERTS_URL
        ? Response.json({ keys: [publicJwk] })
        : new Response('not found', { status: 404 }),
    ),
  );
};

const defaultClaims = () => ({
  iss: TEAM_DOMAIN,
  aud: [AUD],
  email: ADMIN_EMAIL,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 300,
});

const base64Url = (data: string | Uint8Array): string =>
  btoa(String.fromCharCode(...(typeof data === 'string' ? new TextEncoder().encode(data) : data)))
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');

/**
 * Signs a token shaped like the one Cloudflare Access forwards in `Cf-Access-Jwt-Assertion`.
 * @param claims - Claims that replace the defaults; a claim set to `undefined` is left out of the token.
 * @param header - Header fields that replace the defaults; `{}` leaves out the key ID.
 * @returns The signed token.
 */
export const accessToken = (
  claims: Record<string, unknown> = {},
  header: { kid?: string } = { kid: KEY_ID },
): Promise<string> => sign({ ...defaultClaims(), ...claims }, { ...privateJwk, kid: header.kid }, 'RS256');

/**
 * Builds a token with a header written by hand, for algorithms the verifier must refuse.
 * @param header - The token header, for example `{ alg: 'none' }`.
 * @param secret - When set, signs the token with HMAC-SHA256 using this secret; otherwise the signature is empty.
 * @returns The token with Access's default claims.
 */
export const craftedToken = async (header: Record<string, unknown>, secret?: string): Promise<string> => {
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(defaultClaims()))}`;
  if (!secret) {
    return `${signingInput}.`;
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
};
