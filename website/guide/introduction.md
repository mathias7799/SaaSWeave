# Introduction

SaaSWeave is a production-oriented, multi-tenant SaaS starter built as a
full-stack TypeScript monorepo. It combines TanStack Start, Hono, oRPC, Drizzle
ORM, Better Auth, BullMQ, Redis, and Paraglide.js behind one typed application
boundary.

The repository is intended for teams building a hosted product with workspaces,
billing, background processing, administration, and operational controls already
connected. The internal workspace packages use the `@saasweave/*` scope
consistently across apps, libraries, and tooling.

## What is included

- Workspace tenancy with member roles, invitations, profiles, and organization switching
- Email/password authentication, OAuth provider discovery, 2FA, SSO/SAML, sessions, and impersonation policy
- Workspace console for billing, usage, API keys, webhooks, notifications, audit history, exports, and security settings
- Platform administration for users, workspaces, plans, feature rollout, analytics, email, maintenance mode, and audit events
- Stripe checkout, portal, webhook ordering, subscriptions, usage attribution, and MRR snapshots
- BullMQ workers for email, notifications, webhooks, Stripe, data exports, batch jobs, and schedules
- PostgreSQL persistence through Drizzle schema and checked-in migrations
- Redis-backed cache, rate limits, queues, readiness, and queue metrics
- S3-compatible media storage through MinIO, a local-disk fallback, and optional imgproxy delivery
- Paraglide localization, SEO helpers, sitemap generation, transactional email templates, and a shared UI package
- Structured logs, Prometheus metrics, health probes, retention jobs, and backup verification tools

Most integrations are environment-gated. Stripe, OAuth, external email delivery,
OpenAPI docs, metrics, and the local SAML identity provider remain off until
configured.

## The stack

| Area         | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Web          | React 19, TanStack Start and Router, TanStack Query, Tailwind CSS |
| API          | Hono, oRPC, OpenAPI                                                |
| Auth         | Better Auth, organization, 2FA, SSO, OAuth                        |
| Data         | PostgreSQL 18, Drizzle ORM                                        |
| Async        | Redis 8, BullMQ                                                    |
| Storage      | MinIO/S3-compatible storage, local disk, imgproxy                 |
| Localization | Paraglide.js                                                      |
| Tooling      | Vite Plus, pnpm workspaces, Vitest, Playwright, Oxfmt, Oxlint     |
| Deployment   | Multi-stage Docker images, Docker Compose, Coolify Compose        |

## Who it is for

This is a starter framework, not a finished product. It gives a team the
undifferentiated operational machinery of a SaaS (tenancy, auth, billing,
queues, observability) so the work that remains is the product itself.

Read on:

- [Quick start](/guide/getting-started) runs the full stack locally with Docker.
- [Architecture](/guide/architecture) explains how the apps and packages fit together.
- [Product tour](/tour) is a visual walkthrough of every surface.
