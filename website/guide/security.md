# Security model

The codebase includes tenant-scoped procedures, hashed and scoped API keys,
session and platform policies, Redis-backed security rate limits, bounded
request bodies, CSP and baseline response headers, webhook signature
verification, DNS-pinned outbound webhook requests, sanitized logs, and
production container hardening. Production Compose runs application containers
read-only with dropped Linux capabilities and resource limits.

## What is covered

- Tenant-scoped procedures so a request cannot read another workspace's data
- API keys stored hashed and scoped, never in plaintext
- Session and platform-operator policies, including an impersonation policy
- Redis-backed rate limiting on security-sensitive routes
- Bounded request bodies and a baseline of response headers, including CSP
- Webhook signature verification on inbound events
- DNS-pinned outbound webhook delivery to resist SSRF against internal hosts
- Log sanitization to keep secrets out of structured logs
- Read-only application containers with dropped capabilities in production

## What remains your responsibility

These controls are a foundation, not a substitute for deployment-specific
review. Configure TLS, managed secrets, backups and point-in-time recovery,
object-store versioning, alerting, and provider credentials for your
environment.

::: warning Review before exposing a deployment
Read
[SECURITY.md](https://github.com/mathias7799/SaaSWeave/blob/main/SECURITY.md)
before exposing a deployment publicly. Security vulnerabilities must follow the
private reporting process described there, not a public issue.
:::
