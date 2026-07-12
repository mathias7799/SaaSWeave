# SaaSWeave product tour

This tour was captured from the complete local Docker stack with PostgreSQL, Redis, workers,
MinIO, imgproxy, OpenAPI documentation, and the platform administration surface enabled.

## Complete slideshow

![SaaSWeave complete product slideshow](media/saasweave-product-slideshow.gif)

## Public experience

The public site introduces the product, publishes plan choices, and provides a live runtime
workbench that verifies the API connection, hydration, localization, and image delivery.

![SaaSWeave home page](media/tour/home.png)

![SaaSWeave pricing](media/tour/pricing.png)

![SaaSWeave runtime workbench](media/tour/playground.png)

## Account and workspace setup

New accounts receive a personal workspace and a short onboarding flow for naming the workspace and
inviting teammates.

![SaaSWeave onboarding](media/tour/onboarding.png)

## Workspace console

The workspace console brings product activity, AI usage, billing, credentials, team management,
notifications, profile settings, and account security into one operational surface.

![SaaSWeave workspace console tour](media/saasweave-console-tour.gif)

### Active batch processing

This demo submits an uppercase batch, follows it through BullMQ, and finishes at `Completed · 100% ·
2/2 done` in the workspace console.

![Active batch-processing workflow](media/saasweave-batch-demo.gif)

### Active webhook configuration

The webhook workflow opens the endpoint editor, validates an HTTPS destination, exposes the signed
event catalog, and closes without persisting the demonstration endpoint.

![Active webhook configuration workflow](media/saasweave-webhook-demo.gif)

### Usage and billing

![Workspace overview](media/tour/console-overview.png)

![AI usage and cost analytics](media/tour/console-ai-usage.png)

![Asynchronous batch jobs](media/tour/console-batch-jobs.png)

![Billing and metered usage](media/tour/console-billing.png)

### Access and organization

![API key management](media/tour/console-api-keys.png)

![Outbound webhook management](media/tour/console-webhooks.png)

![Workspace team management](media/tour/console-team.png)

![Workspace audit log](media/tour/console-audit.png)

![Account security and active sessions](media/tour/console-security.png)

## Platform administration

Allow-listed platform operators can manage every tenant, plan, user, feature rollout, transactional
email, audit event, and global platform setting without leaving the product.

![SaaSWeave platform administration tour](media/saasweave-admin-tour.gif)

### Active email previews

The email workbench renders welcome, invitation, subscription, password-reset, and magic-link
templates through the same shared layout used for delivery.

![Active transactional-email preview demo](media/saasweave-email-demo.gif)

### Active administration controls

This demo opens a tenant detail view, changes and restores its plan entitlement, opens the plan
catalog editor, and disables then restores a global feature flag.

![Active platform administration workflow](media/saasweave-admin-controls-demo.gif)

### Business operations

![Platform analytics](media/tour/admin-analytics.png)

![Workspace administration](media/tour/admin-workspaces.png)

![Plans and billing catalog](media/tour/admin-plans.png)

### Platform control

![Platform feature controls](media/tour/admin-features.png)

![Transactional email workbench](media/tour/admin-emails.png)

![Platform audit log](media/tour/admin-audit.png)

![Global platform settings](media/tour/admin-settings.png)

## API documentation

When `ENABLE_OPEN_API_DOCS=true`, the server exposes an interactive Scalar reference generated from
the typed API contract.

The active demo navigates from the generated catalog to the email-preview endpoint and its request
schema, client example, and test-request control.

![Interactive API reference workflow](media/saasweave-api-docs-demo.gif)

![Interactive SaaSWeave API documentation](media/saasweave-api-docs.png)
