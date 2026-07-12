# @saasweave/auth

Better Auth configuration: sessions, organizations, admin plugin, 2FA, SSO, and platform access policy.

## Always on

- Email/password authentication
- Organization plugin (multi-tenant workspaces, invitations, roles)
- Admin plugin (platform role)
- Session cookies with `BETTER_AUTH_SECRET`
- Audit hooks → DB + outbound webhooks
- Seat limit checks on invite/join
- Signup policy (`assertSignupsOpen`)
- Platform admin resolution (`PLATFORM_ADMIN_EMAILS` in production; first-user promotion in
  development only)

## Optional plugins / env-gated

| Capability                      | Enabled when                                       |
| ------------------------------- | -------------------------------------------------- |
| Google OAuth                    | `GOOGLE_CLIENT_ID` + secret                        |
| GitHub OAuth                    | `GITHUB_CLIENT_ID` + secret                        |
| SSO / SAML (`@better-auth/sso`) | Provider registered in console; feature flag `sso` |
| Two-factor (`twoFactor` plugin) | User opts in on security page                      |
| Queued emails                   | `REDIS_URL` → BullMQ; else sync/log                |

## Key exports

- `@saasweave/auth/index` — configured `auth` instance
- `@saasweave/auth/public-providers` — `getPublicAuthProviderFlags()` for `/auth/providers`

## Environment variables

| Variable                | Notes                     |
| ----------------------- | ------------------------- |
| `BETTER_AUTH_SECRET`    | Min 32 chars              |
| `VITE_WEB_URL`          | Auth redirects            |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated           |
| `GOOGLE_*`, `GITHUB_*`  | OAuth                     |
| `REDIS_URL`             | Async email/notifications |

## Tests

```bash
pnpm --filter @saasweave/auth test:unit
```

## Related

- [packages/db](../db/README.md) — auth schema via Drizzle adapter
- [apps/server](../../apps/server/README.md) — mounts `auth.handler`
