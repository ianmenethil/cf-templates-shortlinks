import { Hono } from 'hono';
import { SHORT_LINK_PREFIX } from '../shared/short-url';
import type { AppEnv } from './env';
import { admin } from './routes/admin';
import { links } from './routes/links';
import { redirect } from './routes/redirect';

const app = new Hono<AppEnv>();

// The bare address opens the admin panel, so the URL a dev server or a new domain shows leads somewhere.
app.get('/', (c) => c.redirect('/admin/'));
app.route(SHORT_LINK_PREFIX, redirect);
app.route('/links', links);
app.route('/admin', admin);

export default app;
