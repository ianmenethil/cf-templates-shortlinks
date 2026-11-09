import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { shortUrl } from '../../shared/short-url';
import type { AppEnv } from '../env';
import { createLink, targetUrlValidator } from '../lib/links';
import { rateLimit } from '../lib/rate-limit';

/** Create a link from your own server. Mounted at `/links`; only callers holding the admin token get past bearerAuth. */
export const links = new Hono<AppEnv>();

links.use(rateLimit('links'));

links.post(
  '/',
  (c, next) => bearerAuth<AppEnv>({ token: c.env.LINKS_ADMIN_TOKEN })(c, next),
  targetUrlValidator('url must be an https link to a host in ALLOWED_HOSTS'),
  async (c) => {
    const { code } = await createLink(c.env.LINKS, c.req.valid('json').url, 'api');
    return c.json({ code, shortUrl: shortUrl(c.req.url, code) }, 201);
  },
);
