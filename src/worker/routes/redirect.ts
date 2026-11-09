import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { CODE_PARAM } from '../lib/links';
import { rateLimit } from '../lib/rate-limit';

/** Open a link: send the visitor to the saved URL. Mounted at `/s`. */
export const redirect = new Hono<AppEnv>();

redirect.use(rateLimit('s'));

redirect.get(`/${CODE_PARAM}`, async (c) => {
  const target = await c.env.LINKS.get(c.req.param('code'));
  return target ? c.redirect(target) : c.notFound();
});
