import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import { shortUrl } from '../../shared/short-url';
import type { AdminProfile, CreatedLink, LinkList } from '../../shared/types';
import type { AppEnv } from '../env';
import { requireAccess } from '../lib/access';
import { CODE_PARAM, createLink, limitBody, listLinks, targetUrlValidator } from '../lib/links';

/**
 * Admin panel, its JSON API and its files, mounted at `/admin` and only reachable through Cloudflare Access.
 * `run_worker_first` in `wrangler.jsonc` sends every `/admin` request here, so the panel's own page
 * and script are behind the same Access check as the API.
 */
export const admin = new Hono<AppEnv>();

// `vite dev` adds an inline script (React's hot reload). Vite replaces `import.meta.env.DEV` with
// `false` in a build, so the production Worker allows only the page's own scripts.
const scriptSrc = import.meta.env.DEV ? ["'self'", "'unsafe-inline'"] : ["'self'"];

// shadcn's toast (Sonner) and dialog (Radix) add <style> tags and style attributes at runtime.
const styleSrc = ["'self'", "'unsafe-inline'"];

admin.use(requireAccess);
admin.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc,
      styleSrc,
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
    },
    strictTransportSecurity: 'max-age=15552000',
    xFrameOptions: 'DENY',
  }),
);
// The API answers only this panel: it sends no CORS headers, so browsers stop other sites from
// reading it, and csrf() refuses changes (create, delete) that do not come from this site's pages.
admin.use('/api/*', csrf());
// Answers hold the signed-in user's data, so no cache keeps a copy.
admin.use('/api/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
});

admin.get('/api/me', (c) => c.json<AdminProfile>({ email: c.get('adminEmail'), brand: c.env.BRAND_NAME }));

admin.get('/api/links', async (c) => c.json<LinkList>({ links: await listLinks(c.env.LINKS) }));

admin.post(
  '/api/links',
  limitBody,
  targetUrlValidator('Enter an https link to one of your allowed sites.'),
  async (c) => {
    const link = await createLink(c.env.LINKS, c.req.valid('json').url, c.get('adminEmail'));
    return c.json<CreatedLink>({ link, shortUrl: shortUrl(c.req.url, link.code) }, 201);
  },
);

admin.delete(`/api/links/${CODE_PARAM}`, async (c) => {
  await c.env.LINKS.delete(c.req.param('code'));
  return c.body(null, 204);
});

// Everything else under /admin is the React app: its page and bundled files.
admin.get('*', async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  // Asset responses have immutable headers; a copy lets secureHeaders add its own.
  return new Response(asset.body, asset);
});
