import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { ADMIN_TOKEN, AUD, TEAM_DOMAIN } from './test/helpers/constants';

// Test-only secret, read by Wrangler when it loads the config. Real deployments set
// LINKS_ADMIN_TOKEN with `wrangler secret put` or on the Deploy to Cloudflare setup page.
process.env.LINKS_ADMIN_TOKEN ??= ADMIN_TOKEN;

export default defineConfig({
  test: {
    // Builds the admin panel so its files exist for the Worker's ASSETS binding.
    globalSetup: ['./test/global-setup.ts'],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // Fixed values the tests rely on, so a local .dev.vars does not change them: the admin token
      // and the Access settings that match the tokens the tests sign (test/helpers/access.ts).
      miniflare: {
        bindings: {
          LINKS_ADMIN_TOKEN: ADMIN_TOKEN,
          ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
          ACCESS_AUD: AUD,
        },
      },
    }),
  ],
});
