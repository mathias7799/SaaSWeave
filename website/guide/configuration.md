# Configuration

Environment values are validated at process startup. The complete templates are
[`packages/env/.env.example`](https://github.com/mathias7799/SaaSWeave/blob/main/packages/env/.env.example)
for native development and
[`.env.docker.example`](https://github.com/mathias7799/SaaSWeave/blob/main/.env.docker.example)
for Compose.

## Minimum configuration

At minimum, configure the public web and server URLs, `DATABASE_URL`, and
`BETTER_AUTH_SECRET`. Production deployments also require a shared Redis unless
the explicit single-instance fallback is enabled.

## Optional capabilities

Provider credentials activate optional capabilities. Each stays off until its
configuration is present.

| Capability     | Configuration                                              |
| -------------- | ---------------------------------------------------------- |
| OAuth          | `GOOGLE_*`, `GITHUB_*`                                     |
| Stripe         | `STRIPE_SECRET_KEY`, webhook secret, price and meter maps  |
| Email          | `MAIL_PROVIDER=resend` or `smtp` plus provider credentials |
| Object storage | `MINIO_*` / S3-compatible endpoint and bucket              |
| Image delivery | `VITE_IMGPROXY_*` and an allowlisted source origin         |
| Metrics        | `METRICS_ENABLED` and `METRICS_BEARER_TOKEN`               |
| OpenAPI UI     | `ENABLE_OPEN_API_DOCS=true`                                |

::: warning
Never commit populated environment files. The templates exist so that real
values stay out of version control.
:::
