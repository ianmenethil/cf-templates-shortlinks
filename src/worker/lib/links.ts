import type { Context } from 'hono';
import { validator } from 'hono/validator';
import type { LinkMetadata, LinkRecord } from '../../shared/types';
import type { AppEnv } from '../env';

/** Characters used in codes. Leaves out ones that are easy to misread (0/O, 1/I/l). */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Number of characters in each code. */
const CODE_LENGTH = 8;

/** KV metadata is limited to 1024 bytes, so longer URLs are cut for display; the full URL is the KV value. */
const MAX_METADATA_URL_LENGTH = 800;

/**
 * Builds a random short code.
 * @returns A code of `CODE_LENGTH` characters taken from `CODE_ALPHABET`.
 */
const newCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
};

/**
 * Checks that a value is an https URL on an allowed host, so a short link cannot send people anywhere else.
 * @param value - The `url` field from a request body.
 * @param allowedHosts - The `ALLOWED_HOSTS` variable: host names separated by commas.
 * @returns The normalised URL, or `null` when it is not allowed.
 */
const parseTargetUrl = (value: unknown, allowedHosts: string): string | null => {
  if (typeof value !== 'string' || !URL.canParse(value)) {
    return null;
  }
  const url = new URL(value);
  const hosts = new Set(
    allowedHosts
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  return url.protocol === 'https:' && hosts.has(url.hostname) ? url.href : null;
};

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
 * Saves a destination URL under a new, unused code.
 * @param kv - The `LINKS` namespace.
 * @param url - A URL already accepted by {@link targetUrlValidator}.
 * @param createdBy - Who is creating the link.
 * @returns The saved link.
 */
export const createLink = async (kv: KVNamespace, url: string, createdBy: string): Promise<LinkRecord> => {
  let code = newCode();
  while ((await kv.get(code)) !== null) {
    code = newCode();
  }
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
  return links.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};
