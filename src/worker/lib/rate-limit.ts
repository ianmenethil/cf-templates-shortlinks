import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';

/**
 * Rate limits a public route per visitor. Each visitor gets one allowance for the whole route,
 * however many different paths under it they open, so one visitor flooding a route cannot block
 * it for anyone else. Cloudflare sets `CF-Connecting-IP` to the visitor's address. Limits are
 * approximate and counted separately in each Cloudflare location. The admin panel is not limited
 * here; Cloudflare Access guards it.
 * @param route - Name of the route the allowance covers, for example `s` or `links`.
 * @returns Middleware that answers `400` when the visitor's address is missing and `429` once the visitor is over the limit.
 */
export const rateLimit = (route: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const visitor = c.req.header('CF-Connecting-IP');
    if (!visitor) {
      return c.text('Missing CF-Connecting-IP header', 400);
    }
    const { success } = await c.env.RATE_LIMITER.limit({ key: `${visitor}:${route}` });
    if (!success) {
      return c.text('Too many requests', 429);
    }
    await next();
  });
