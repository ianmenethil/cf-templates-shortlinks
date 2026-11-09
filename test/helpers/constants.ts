/** Admin token the tests send as `Authorization: Bearer <token>` to create links through the API. */
export const ADMIN_TOKEN = 'test-admin-token';

/** Team domain the tests' Access tokens come from. */
export const TEAM_DOMAIN = 'https://menethil.cloudflareaccess.com';

/** AUD tag of the tests' Access application. */
export const AUD = 'test-admin-aud';

/** Address the tests send their requests to. */
export const ORIGIN = 'https://go.ianmenethil.com';

/** Address the tests send as `CF-Connecting-IP`, as Cloudflare does for every real request. */
export const VISITOR_IP = '203.0.113.1';

/** A destination on an allowed host, with a query string. */
export const DESTINATION = 'https://ianmenethil.com/blog/hello-world?utm_source=newsletter';
