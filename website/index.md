---
layout: home

hero:
  name: SaaSWeave
  text: The operational layer of a SaaS, already wired.
  tagline: >-
    A production-oriented, multi-tenant SaaS starter built as a full-stack
    TypeScript monorepo. Workspaces, auth, billing, background jobs,
    observability, and typed APIs behind one application boundary.
  image:
    src: /saasweave-home.png
    alt: SaaSWeave public home page
  actions:
    - theme: brand
      text: Quick start
      link: /guide/getting-started
    - theme: alt
      text: Introduction
      link: /guide/introduction
    - theme: alt
      text: Product tour
      link: /tour

features:
  - icon: 🏢
    title: Workspace tenancy
    details: Member roles, invitations, profiles, and organization switching, with tenant-scoped data access enforced in the API layer.
  - icon: 🔐
    title: Authentication and SSO
    details: Email/password, OAuth provider discovery, 2FA, SSO/SAML, sessions, and an impersonation policy, built on Better Auth.
  - icon: 💳
    title: Billing that reconciles
    details: Stripe checkout, portal, ordered webhook handling, subscriptions, usage attribution, and MRR snapshots.
  - icon: ⚙️
    title: Background processing
    details: BullMQ workers for email, notifications, webhooks, Stripe, data exports, batch jobs, and scheduled work.
  - icon: 📊
    title: Observability built in
    details: Structured logs, Prometheus metrics, health and readiness probes, retention jobs, and backup verification tooling.
  - icon: 🧩
    title: One typed boundary
    details: TanStack Start, Hono, and oRPC give the web app, API, and workers a single end-to-end typed contract.
---

## See it running

The screenshots and recordings below come from the complete local Docker stack:
PostgreSQL, Redis, workers, MinIO, imgproxy, OpenAPI documentation, and the
platform administration surface, all enabled together.

### Workspace console

Product activity, AI usage, billing, credentials, team management, notifications,
and account security in one operational surface.

![SaaSWeave workspace console tour](/saasweave-console-tour.gif)

### Background jobs you can watch

Submitting a batch and following it through BullMQ to `Completed · 100% · 2/2 done`
in the console.

![Active batch-processing workflow](/saasweave-batch-demo.gif)

### Platform administration

Allow-listed operators manage every tenant, plan, user, feature rollout, and
global setting without leaving the product.

![SaaSWeave platform administration tour](/saasweave-admin-tour.gif)

### A typed API, documented

With `ENABLE_OPEN_API_DOCS=true`, the server exposes an interactive Scalar
reference generated from the same typed contract the clients use.

![Interactive SaaSWeave API documentation](/saasweave-api-docs.png)

<div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--vp-c-divider);">

Most integrations are environment-gated. Stripe, OAuth, external email delivery,
OpenAPI docs, metrics, and the local SAML identity provider stay off until you
configure them, so the default stack runs without external credentials.

[Read the full product tour](/tour) or [start the stack locally](/guide/getting-started).

</div>
