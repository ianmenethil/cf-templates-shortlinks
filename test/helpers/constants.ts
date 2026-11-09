/** Admin token the tests send as `Authorization: Bearer <token>` to create links through the API. */
export const ADMIN_TOKEN = 'test-admin-token';

/** Team domain the tests' Access tokens come from. */
export const TEAM_DOMAIN = 'https://menethil.cloudflareaccess.com';

/** AUD tag of the tests' Access application. */
export const AUD = 'test-admin-aud';

/** Address the tests send their requests to. */
export const ORIGIN = 'https://go.ianmenethil.com';

/** A destination on an allowed host, with a query string. */
export const DESTINATION = 'https://ianmenethil.com/blog/hello-world?utm_source=newsletter';
