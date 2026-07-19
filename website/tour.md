# Product tour

This tour was captured from the complete local Docker stack with PostgreSQL,
Redis, workers, MinIO, imgproxy, OpenAPI documentation, and the platform
administration surface enabled.

## Complete slideshow

![SaaSWeave complete product slideshow](/saasweave-product-slideshow.gif)

## Public experience

The public site introduces the product, publishes plan choices, and provides a
live runtime workbench that verifies the API connection, hydration,
localization, and image delivery.

![SaaSWeave home page](/tour/home.png)

![SaaSWeave pricing](/tour/pricing.png)

![SaaSWeave runtime workbench](/tour/playground.png)

## Account and workspace setup

New accounts receive a personal workspace and a short onboarding flow for naming
the workspace and inviting teammates.

![SaaSWeave onboarding](/tour/onboarding.png)

## Workspace console

The workspace console brings product activity, AI usage, billing, credentials,
team management, notifications, profile settings, and account security into one
operational surface.

![SaaSWeave workspace console tour](/saasweave-console-tour.gif)

### Active batch processing

This demo submits an uppercase batch, follows it through BullMQ, and finishes at
`Completed · 100% · 2/2 done` in the workspace console.

![Active batch-processing workflow](/saasweave-batch-demo.gif)

### Active webhook configuration

The webhook workflow opens the endpoint editor, validates an HTTPS destination,
exposes the signed event catalog, and closes without persisting the
demonstration endpoint.

![Active webhook configuration workflow](/saasweave-webhook-demo.gif)

### Usage and billing

![Workspace overview](/tour/console-overview.png)

![AI usage and cost analytics](/tour/console-ai-usage.png)

![Asynchronous batch jobs](/tour/console-batch-jobs.png)

![Billing and metered usage](/tour/console-billing.png)

### Access and organization

![API key management](/tour/console-api-keys.png)

![Outbound webhook management](/tour/console-webhooks.png)

![Workspace team management](/tour/console-team.png)

![Workspace audit log](/tour/console-audit.png)

![Account security and active sessions](/tour/console-security.png)

## Platform administration

Allow-listed platform operators can manage every tenant, plan, user, feature
rollout, transactional email, audit event, and global platform setting without
leaving the product.

![SaaSWeave platform administration tour](/saasweave-admin-tour.gif)

### Active email previews

The email workbench renders welcome, invitation, subscription, password-reset,
and magic-link templates through the same shared layout used for delivery.

![Active transactional-email preview demo](/saasweave-email-demo.gif)

### Active administration controls

This demo opens a tenant detail view, changes and restores its plan entitlement,
opens the plan catalog editor, and disables then restores a global feature flag.

![Active platform administration workflow](/saasweave-admin-controls-demo.gif)

### Business operations

![Platform analytics](/tour/admin-analytics.png)

![Workspace administration](/tour/admin-workspaces.png)

![Plans and billing catalog](/tour/admin-plans.png)

### Platform control

![Platform feature controls](/tour/admin-features.png)

![Transactional email workbench](/tour/admin-emails.png)

![Platform audit log](/tour/admin-audit.png)

![Global platform settings](/tour/admin-settings.png)

## API documentation

When `ENABLE_OPEN_API_DOCS=true`, the server exposes an interactive Scalar
reference generated from the typed API contract.

The active demo navigates from the generated catalog to the email-preview
endpoint and its request schema, client example, and test-request control.

![Interactive API reference workflow](/saasweave-api-docs-demo.gif)

![Interactive SaaSWeave API documentation](/saasweave-api-docs.png)
