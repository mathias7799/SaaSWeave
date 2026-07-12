# @saasweave/web

TanStack Start web application: marketing pages, authentication, admin console, and organization workspace UI.

## Always on

- SSR/SPA routing via TanStack Router
- Better Auth client (session cookies)
- Organization console (`/app/*`): overview, billing, team, API keys, webhooks, SSO settings, security (2FA), profile
- Platform admin (`/admin/*`): users, features, maintenance
- Paraglide i18n for console and auth copy
- SEO routes (`sitemap.xml`, meta via `@saasweave/seo`)

## Optional / env-gated

| Feature               | Enabled when                        |
| --------------------- | ----------------------------------- |
| OAuth sign-in buttons | Server has `GOOGLE_*` or `GITHUB_*` |
| SSO sign-in button    | Org has SSO provider configured     |
| imgproxy avatars      | `VITE_IMGPROXY_URL` set             |
| Live Stripe checkout  | Server has `STRIPE_SECRET_KEY`      |

## Key paths

```
src/routes/           # file-based routes
src/pages/console/    # workspace UI
src/features/auth/    # sign-in, sign-up, OAuth
src/shared/lib/       # console i18n, sitemap
__e2e__/              # integration smoke tests (needs running stack)
```

## Environment variables

| Variable                  | Required | Notes                                          |
| ------------------------- | -------- | ---------------------------------------------- |
| `VITE_WEB_URL`            | Yes      | Public app URL                                 |
| `VITE_SERVER_URL`         | Yes      | API base, e.g. `http://localhost:5000/server`  |
| `BETTER_AUTH_SECRET`      | Yes      | Must match server                              |
| `DATABASE_URL`            | Yes      | Used at build/prerender                        |
| `VITE_IMGPROXY_URL`       | No       | Image CDN                                      |
| `VITE_IMGPROXY_SIGNATURE` | No       | Default `_`; use `insecure` for local imgproxy |

## Development

```bash
vp run dev          # from repo root (starts web + server)
vp test             # unit tests in src/**/__tests__
cross-env VITEST_E2E=1 vp test  # e2e (see package.json test:e2e)
```

## Related

- [apps/server](../server/README.md) — API backend
- [packages/api](../../packages/api/README.md) — oRPC client types
- [packages/ui](../../packages/ui/README.md) — shared components
