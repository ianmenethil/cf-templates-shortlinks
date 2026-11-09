import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { validator } from 'hono/validator';
import type { LinkMetadata, LinkRecord } from '../../shared/types';
import type { AppEnv } from '../env';

/** Characters used in codes. Leaves out ones that are easy to misread (0/O, 1/I/l). */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Number of characters in each code. */
const CODE_LENGTH = 8;

/** Route parameter for a code: Hono matches only codes in this app's own format, so any other path is a 404. */
export const CODE_PARAM = `:code{[${CODE_ALPHABET}]{${CODE_LENGTH}}}`;

/** Largest request body the create routes accept, in bytes. Room for any realistic https URL. */
const MAX_BODY_BYTES = 4 * 1024;

/** KV metadata is limited to 1024 bytes, so longer URLs are cut for display; the full URL is the KV value. */
const MAX_METADATA_URL_LENGTH = 800;

/**
 * Builds a random short code.
 * @returns A code of `CODE_LENGTH` characters taken from `CODE_ALPHABET`.
 */
const newCode = (): string => {
  // Bytes at or above this limit are discarded, so every character is equally likely.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(CODE_LENGTH))) {
      if (byte < limit && code.length < CODE_LENGTH) {
        code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      }
    }
  }
  return code;
};

/**
 * Checks that a value is an https URL on an allowed host, so a short link cannot send people anywhere else.
 * @param value - The `url` field from a request body.
 * @param allowedHosts - The `ALLOWED_HOSTS` variable: host names separated by commas.
 * @returns The normalised URL, or `null` when it is not allowed.
 */
const parseTargetUrl = (value: unknown, allowedHosts: string): string | null => {
  const url = typeof value === 'string' ? URL.parse(value) : null;
  if (!url) {
    return null;
  }
  const hosts = new Set(
    allowedHosts
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  return url.protocol === 'https:' && hosts.has(url.hostname) ? url.href : null;
};

/** Refuses a request body over the size limit with a `413` JSON answer. Put it before {@link targetUrlValidator}. */
export const limitBody = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => c.json({ error: 'The request body is too large.' }, 413),
});

/**
 * Builds the JSON validator that route handlers put in front of link creation. It reads `url` from
 * the request body and passes `{ url }` on once {@link parseTargetUrl} accepts it.
 * @param message - The `error` text of the `400` answer when the URL is not accepted.
 * @returns Hono middleware; the handler reads the URL with `c.req.valid('json').url`.
 */
export const targetUrlValidator = (message: string) =>
  validator('json', (body, c: Context<AppEnv>) => {
    // A JSON body of `null` is valid JSON, so `body` itself can be null.
    const url = parseTargetUrl(body?.url, c.env.ALLOWED_HOSTS);
    if (!url) {
      return c.json({ error: message }, 400);
    }
    return { url };
  });

/**
 * Saves a destination URL under a new random code.
 * @param kv - The `LINKS` namespace.
 * @param url - A URL already accepted by {@link targetUrlValidator}.
 * @param createdBy - Who is creating the link.
 * @returns The saved link.
 */
export const createLink = async (kv: KVNamespace, url: string, createdBy: string): Promise<LinkRecord> => {
  const code = newCode();
  const metadata: LinkMetadata = {
    url: url.length > MAX_METADATA_URL_LENGTH ? `${url.slice(0, MAX_METADATA_URL_LENGTH)}…` : url,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  await kv.put(code, url, { metadata });
  return { code, ...metadata };
};

/**
 * Lists every saved link, newest first. KV lists are eventually consistent, so a link
 * created or deleted in the last minute may not be reflected yet.
 * @param kv - The `LINKS` namespace.
 * @returns All links that have metadata.
 */
export const listLinks = async (kv: KVNamespace): Promise<LinkRecord[]> => {
  const links: LinkRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list<LinkMetadata>({ cursor });
    for (const key of page.keys) {
      if (key.metadata) {
        links.push({ code: key.name, ...key.metadata });
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return links.sort((a, b) => (a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? 1 : -1));
};
