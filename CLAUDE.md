# Shortlinks: agent guide

A link shortener template for Cloudflare Workers: a Hono Worker that redirects `/s/<code>` to a saved URL, an API for creating links with a token, and a React admin panel behind Cloudflare Access. It is a public template that other people copy and deploy, so everything in it is written for them. Keep the sample company (Menethil, `ianmenethil.com`, `go.ianmenethil.com`, `admin@ianmenethil.com`) consistent and leave nothing personal or machine-specific in it.

What the project does, how to deploy and use it, the routes and their answers, and the scripts are in the README. How a request flows, where the code lives, how the admin panel is secured and how type checking is split are in ARCHITECTURE.md. Both are imported here; this file adds only what an agent working on the code needs on top. Tools that do not follow imports: read both files first.

@README.md
@ARCHITECTURE.md

## Done means

Both of these pass, the same as CI (`.github/workflows/ci.yml`, which also runs `pnpm audit` and fails if `worker-configuration.d.ts` is out of date):

- `pnpm run check`: type check, lint with no warnings allowed, build, dry-run deploy.
- `pnpm test`: builds the panel, then runs the tests inside the Workers runtime.

Use `pnpm install --frozen-lockfile` to install. Run the check and the tests as separate commands; both take a while.

## Local development

- `pnpm run dev` needs a `.dev.vars` copied from `.dev.vars.example` with `LINKS_ADMIN_TOKEN` set and the `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` lines uncommented, or `/admin` answers `403`.
- `access.dev` in `wrangler.jsonc` simulates the signed-in user `admin@ianmenethil.com`, so curl and a browser reach `/admin` with no sign-in.
- The admin API's `csrf()` only refuses form-style requests. JSON from curl with `Content-Type: application/json` goes through without an `Origin` header.
- Local KV data lives in `.wrangler/` and keeps old test links between runs. Do not delete it: it is the owner's. For clean data (demos, screenshots), run a copy of the app in a scratch folder.

## Tests

- Tests live in `test/*.test.ts` and run in workerd through `@cloudflare/vitest-plugin`; storage is isolated per test file. Call the Worker with `exports.default.fetch` from `cloudflare:workers`, as the existing tests do.
- `vitest.config.ts` fixes the admin token and the Access settings, so a local `.dev.vars` never changes test results. The values are in `test/helpers/constants.ts`.
- `test/helpers/access.ts` signs real Access tokens with a test key and serves the matching public keys (`serveAccessKeys`, `accessToken`). Use it for any admin-route test instead of mocking the Access check.
- `test/helpers/links.ts` has `createViaToken` for `POST /links` and `openShortLink` for `/s/<code>`. Both send `CF-Connecting-IP`, which the rate-limited routes require; any direct `exports.default.fetch` to those routes must send it too.
- `test/helpers/access.ts` also has `craftedToken` for tokens with a hand-written header (unsigned or HS256), to prove the Access check refuses them.
- `test/global-setup.ts` builds the panel before the tests run and fails if the built Worker still allows inline scripts.

## Code conventions

- Match the file you are in. The Worker, tests and config files use single quotes; the React app uses double quotes, as shadcn/ui generates it. `.editorconfig`: 2 spaces, LF, final newline.
- Every exported function, type and constant has a short TSDoc comment; `eslint-plugin-tsdoc` checks the syntax and any warning fails lint.
- Worker routes go in `src/worker/routes/` and are mounted in `src/worker/index.ts`; shared helpers go in `src/worker/lib/`. Types used by both the Worker and the panel go in `src/shared/`.
- Add shadcn/ui components with `pnpm dlx shadcn@latest add <component>`; they land in `src/react-app/components/ui/`. The `@/` import alias works only inside the React app.
- Validate request bodies with Hono's `validator`, as `targetUrlValidator` in `src/worker/lib/links.ts` does.

## Adding a binding, variable or secret

1. Add it to `wrangler.jsonc` (`vars`, a binding, or `secrets.required` for a secret).
2. Run `pnpm run cf-typegen` and commit the updated `worker-configuration.d.ts`.
3. Add a description under `cloudflare.bindings` in `package.json`; the Deploy to Cloudflare page shows it.
4. A secret also goes in `.dev.vars.example`, which Deploy to Cloudflare reads to ask for secrets. A test value goes in `vitest.config.ts`.
5. Document it in the README tables.

## Security rules

Do not weaken any of these without the owner's explicit approval: the Access check on every `/admin` request (`requireAccess` in `src/worker/lib/access.ts`) and `run_worker_first` in `wrangler.jsonc`, the `csrf()` and no-CORS setup on the admin API, the Content Security Policy, the `https` and `ALLOWED_HOSTS` check on link targets, the admin token check on `POST /links`, and the rate limits on the public routes. `'unsafe-inline'` for scripts is allowed only under `vite dev`, and the test setup checks that it never reaches a build.

## Docs

- Change the docs in the same change as the code they describe: the README for anything a person deploying or using it sees, ARCHITECTURE.md for structure, code map and security design. Each fact lives in one file.
- The README text between `<!-- dash-content-start -->` and `<!-- dash-content-end -->` is shown on Cloudflare's Deploy page, which cannot load files from the repo. Keep images and repo-relative links outside it.
- Screenshots of the panel are in `docs/screenshots/`. Retake them if the panel's look changes.
- `docs/.archive/` is ignored by git and holds local work logs; nothing in the repo links to it.

## Gotchas

- Do not "fix" the `typescript` package alias to TypeScript 7; ARCHITECTURE.md explains why ESLint needs TypeScript 6. VS Code uses TypeScript 7 through `.vscode/settings.json`.
- `pnpm-workspace.yaml` holds dependency overrides that fix a security advisory and a version mismatch; keep them unless the reason in its comments no longer applies.
- A deployed Worker with static assets does not get `ctx.access`, so the Access check verifies the token itself there. Local dev does get `ctx.access`, so a passing local check does not prove the token path; the tests cover it.
