# SSO / SAML testing (local IdP)

Reproducible manual verification of the console SSO settings panel and SP-initiated SAML login against a real Identity Provider. Automated SAML e2e is intentionally **not** run in CI (browser + IdP + cookies); see [apps/web/**e2e**/sso.spec.ts](../apps/web/__e2e__/sso.spec.ts).

## Test IdP image

**Image:** [`kristophjunge/test-saml-idp:1.15`](https://hub.docker.com/r/kristophjunge/test-saml-idp)

Chosen because it is a widely used, documented SimpleSAMLphp-based dev IdP with static demo users, env-driven SP configuration (`SIMPLESAMLPHP_SP_*`), and no extra wiring beyond Docker Compose. **Do not use in production** (static credentials and keys).

## Prerequisites

1. Main stack running (see [LOCAL-STACK.md](./LOCAL-STACK.md)):

   ```bash
   cp .env.docker.example .env.docker
   # set BETTER_AUTH_SECRET (vp run auth:secret)
   pnpm run docker:up:build
   ```

2. Start the opt-in IdP profile (does **not** start with default `docker compose up`):

   ```bash
   pnpm dotenvx run -f .env.docker -- docker compose --profile sso-test up -d sso-idp
   ```

   IdP UI: `http://localhost:${SSO_IDP_PORT:-8081}/simplesaml` (admin password: `secret`).

3. Workspace on a plan that includes SSO (`scale` or `enterprise`) and the `sso` feature enabled for that org. New workspaces default to `starter` — upgrade via **Admin → Organizations** (or set `organization.plan_id` in Postgres) before the SSO settings panel appears.

## Service Provider URLs (Better Auth)

With default `.env.docker` URLs (`VITE_SERVER_URL=http://localhost:5000/server`), Better Auth mounts SSO under `/server/auth`. For provider id `local-saml` (default in `.env.docker.example`):

| Role                             | URL                                                                  |
| -------------------------------- | -------------------------------------------------------------------- |
| ACS (Assertion Consumer Service) | `http://localhost:5000/server/auth/sso/saml2/sp/acs/local-saml`      |
| SP metadata (optional)           | `http://localhost:5000/server/auth/sso/saml2/sp/metadata/local-saml` |

The compose `sso-idp` service pre-configures the test IdP with these values via `SSO_TEST_SP_*` env vars.

## Identity Provider metadata

| Field                 | Value (default port 8081)                                   |
| --------------------- | ----------------------------------------------------------- |
| Metadata URL          | `http://localhost:8081/simplesaml/saml2/idp/metadata.php`   |
| Entity ID / Issuer    | `http://localhost:8081/simplesaml/saml2/idp/metadata.php`   |
| SSO URL (entry point) | `http://localhost:8081/simplesaml/saml2/idp/SSOService.php` |
| Certificate           | X509 block inside metadata XML (see below)                  |

Fetch the signing certificate (**manual** — paste into the console textarea):

```bash
curl -s "http://localhost:8081/simplesaml/saml2/idp/metadata.php" \
  | sed -n 's/.*<ds:X509Certificate>\(.*\)<\/ds:X509Certificate>.*/\1/p' \
  | fold -w 64 \
  | sed '1s/^/-----BEGIN CERTIFICATE-----\n/;$s/$/\n-----END CERTIFICATE-----/'
```

## Register the provider in the console (**manual**)

1. Sign in as workspace **owner** or **admin**.
2. Open **Console → Settings** (SSO panel visible only when `sso` is enabled for the org).
3. Register with these values (must match compose defaults):

| Console field   | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Provider ID     | `local-saml`                                                |
| Domain          | `example.com`                                               |
| Issuer          | `http://localhost:8081/simplesaml/saml2/idp/metadata.php`   |
| SSO entry point | `http://localhost:8081/simplesaml/saml2/idp/SSOService.php` |
| Certificate     | PEM from metadata (command above)                           |

4. Click **Register** and confirm the provider appears in the list.

> **Note:** Better Auth uses the **Issuer** field as the SP entity ID when `spMetadata` is empty. The test IdP `SIMPLESAMLPHP_SP_ENTITY_ID` is set to the same IdP metadata URL so AuthnRequest issuer and IdP SP config align.

## SP-initiated login (**manual**)

Demo IdP user (from the image):

| Username | Password    | Email               |
| -------- | ----------- | ------------------- |
| `user1`  | `user1pass` | `user1@example.com` |

The sign-in page SSO button does not send the email field to Better Auth. Start SP-initiated login with an API call (browser or terminal):

```bash
curl -s -c /tmp/sso-cookies.txt -b /tmp/sso-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"user1@example.com","callbackURL":"http://localhost:3000/app"}' \
  "http://localhost:5000/server/auth/sign-in/sso" | jq -r .url
```

Open the printed URL in a browser (**manual**). At the IdP, sign in as `user1` / `user1pass`. After the POST to the ACS URL you should land on `http://localhost:3000/app` with an authenticated session.

**Verify:**

- Session exists (avatar / console loads).
- User is provisioned into the workspace that registered the provider (org member with role `member` via Better Auth `organizationProvisioning`).
- A second login with the same IdP user reuses the account (no duplicate user).

## Stop the IdP

```bash
pnpm dotenvx run -f .env.docker -- docker compose --profile sso-test stop sso-idp
```

## Troubleshooting

| Symptom                  | Check                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| SSO panel missing        | Org plan `scale`/`enterprise`; `sso` feature on at `/admin/features`                |
| IdP “unknown SP”         | `SSO_TEST_SP_ENTITY_ID` matches **Issuer** in console; provider id matches ACS path |
| ACS 404                  | `VITE_SERVER_URL` must be `http://localhost:5000/server`; provider id spelling      |
| Port clash with imgproxy | Change `SSO_IDP_PORT` (default `8081`; imgproxy uses `8080`)                        |
| Certificate errors       | Re-copy PEM from live metadata; include `BEGIN`/`END` lines                         |

## See also

- [LOCAL-STACK.md](./LOCAL-STACK.md) — full Docker stack
- [packages/auth/README.md](../packages/auth/README.md) — Better Auth + `@better-auth/sso`
