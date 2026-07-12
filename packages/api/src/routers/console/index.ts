import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { getOrganizationActivity, recordAudit } from "@saasweave/db";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { dispatchOrgWebhook } from "@saasweave/jobs/webhook-dispatch";

import { createApiKey, listApiKeys, revokeApiKey } from "#@/lib/api-keys";
import { canManageApiKeys, canManageBilling, canRecordUsage } from "#@/lib/console-access";
import { listFeaturesForOrg, isFeatureEnabledForOrg } from "#@/lib/features";
import { getOrgSeatContext } from "#@/lib/organization";
import { orgProcedure, requireApiKeyScope, requireFeature } from "#@/lib/procedures/factory";
import { createCheckoutSession, createPortalSession, priceFor } from "#@/lib/stripe";
import { recordUsage, USAGE_METRICS } from "#@/lib/usage";
import { auditExportRouter } from "#@/routers/console/audit-export";
import { batchesRouter } from "#@/routers/console/batches";
import { getBillingSummary } from "#@/routers/console/billing";
import { buildAiUsage, buildOverview } from "#@/routers/console/data";
import { dataExportRouter } from "#@/routers/console/data-export";
import { ipAllowlistRouter } from "#@/routers/console/ip-allowlist";
import { notificationsRouter } from "#@/routers/console/notifications";
import { profileRouter } from "#@/routers/console/profile";
import { ssoRouter } from "#@/routers/console/sso";
import { getTeam } from "#@/routers/console/team";
import { webhooksRouter } from "#@/routers/console/webhooks";

const apiKeysProcedure = requireFeature("api_keys");
const billingPortalProcedure = requireFeature("billing_portal");
const teamProcedure = requireFeature("team_management");

const billingReturnUrl = `${ENV_SERVER.VITE_WEB_URL}/app/billing`;

function assertCanManageBilling(role: string) {
  if (!canManageBilling(role)) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have access to billing." });
  }
}

function assertCanManageApiKeys(role: string) {
  if (!canManageApiKeys(role)) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have access to API keys." });
  }
}

function assertCanRecordUsage(role: string) {
  if (!canRecordUsage(role)) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have access to record usage." });
  }
}

/**
 * Console router — dashboard, AI usage, and billing for the caller's active
 * organization. Team data is real (org membership + invitations); billing is
 * real when Stripe is configured (checkout, portal, webhook-driven state) and
 * falls back to deterministic sample data otherwise.
 */
export const consoleRouter = {
  overview: orgProcedure
    .route({
      description: "Workspace overview: headline metrics, usage trend, plan status, and activity",
      method: "GET"
    })
    .handler(async ({ context }) => {
      const [seat, activity] = await Promise.all([
        getOrgSeatContext(context.organization.id),
        getOrganizationActivity(context.organization.id, 8)
      ]);
      const overview = await buildOverview(context.organization.id, {
        name: seat.planName,
        planId: seat.planId,
        seatsIncluded: seat.seatsIncluded,
        seatsUsed: seat.seatsUsed
      });

      return { ...overview, activity };
    }),

  aiUsage: requireFeature("ai_assistant")
    .route({
      description: "AI usage analytics: totals, daily trend, per-model and per-feature breakdowns",
      method: "GET"
    })
    .handler(({ context }) => buildAiUsage(context.organization.id)),

  auditLog: requireFeature("audit_logs")
    .route({
      description: "This workspace's audit trail: member, billing, and settings changes",
      method: "GET"
    })
    .handler(({ context }) => getOrganizationActivity(context.organization.id, 100)),

  features: orgProcedure
    .route({
      description: "Feature entitlements for the caller's workspace: on, off, or locked by plan",
      method: "GET"
    })
    .handler(async ({ context }) => {
      const seat = await getOrgSeatContext(context.organization.id);
      return listFeaturesForOrg(context.organization.id, seat.planId);
    }),

  billing: billingPortalProcedure
    .route({
      description: "Billing summary: subscription, estimate, metered usage, invoices",
      method: "GET"
    })
    .handler(({ context }) => getBillingSummary(context.organization.id)),

  checkout: billingPortalProcedure
    .route({
      description: "Start a Stripe Checkout session to subscribe to a plan",
      method: "POST"
    })
    .input(z.object({ interval: z.enum(["monthly", "annual"]), planId: z.string() }))
    .handler(async ({ context, input }) => {
      assertCanManageBilling(context.organization.role);
      if (input.interval === "annual") {
        const annualEnabled = await isFeatureEnabledForOrg(
          context.organization.id,
          "annual_billing"
        );
        if (!annualEnabled) {
          throw new ORPCError("FORBIDDEN", {
            message: "Annual billing is not enabled for this workspace."
          });
        }
        if (!priceFor(input.planId, "annual")) {
          throw new ORPCError("BAD_REQUEST", {
            message: "No annual Stripe price is configured for this plan."
          });
        }
      }
      const url = await createCheckoutSession({
        cancelUrl: billingReturnUrl,
        interval: input.interval,
        organizationId: context.organization.id,
        planId: input.planId,
        successUrl: billingReturnUrl
      });
      return { url };
    }),

  billingPortal: billingPortalProcedure
    .route({
      description: "Open the Stripe customer portal to manage the subscription",
      method: "POST"
    })
    .handler(async ({ context }) => {
      assertCanManageBilling(context.organization.role);
      const url = await createPortalSession({
        organizationId: context.organization.id,
        returnUrl: billingReturnUrl
      });
      return { url };
    }),

  team: teamProcedure
    .route({
      description: "Real organization roster, seat usage, and pending invitations",
      method: "GET"
    })
    .handler(async ({ context }) => {
      const seat = await getOrgSeatContext(context.organization.id);
      return getTeam(context.organization.id, seat.seatsIncluded);
    }),

  recordUsage: requireApiKeyScope("usage:write")
    .route({
      description:
        "Record metered usage for the active organization (session or API key integration point)",
      method: "POST"
    })
    .input(
      z.object({
        feature: z.string().min(1).max(200).optional(),
        inputTokens: z.number().int().nonnegative().max(1_000_000).optional(),
        metric: z.enum(USAGE_METRICS),
        model: z.string().min(1).max(200).optional(),
        outputTokens: z.number().int().nonnegative().max(1_000_000).optional(),
        provider: z.string().min(1).max(200).optional(),
        quantity: z.number().int().positive().max(1_000_000)
      })
    )
    .handler(async ({ context, input }) => {
      if (!context.organization) {
        throw new ORPCError("UNAUTHORIZED");
      }
      assertCanRecordUsage(context.organization.role);
      const enabled = await isFeatureEnabledForOrg(context.organization.id, "usage_billing");
      if (!enabled) {
        throw new ORPCError("FORBIDDEN", {
          message: "Usage billing is not enabled for this workspace."
        });
      }
      const { metric, quantity, ...attribution } = input;
      await recordUsage(context.organization.id, metric, quantity, attribution);
      void dispatchOrgWebhook(context.organization.id, "usage.recorded", {
        feature: attribution.feature,
        inputTokens: attribution.inputTokens,
        metric,
        model: attribution.model,
        outputTokens: attribution.outputTokens,
        provider: attribution.provider,
        quantity
      });
      return { ok: true };
    }),

  apiKeys: {
    list: apiKeysProcedure
      .route({ description: "This workspace's API keys", method: "GET" })
      .handler(({ context }) => listApiKeys(context.organization.id)),

    create: apiKeysProcedure
      .route({ description: "Create a new API key. The secret is returned once.", method: "POST" })
      .input(
        z.object({
          name: z.string().min(1).max(100),
          preset: z.enum(["integration", "read_only", "full"]).optional()
        })
      )
      .handler(async ({ context, input }) => {
        assertCanManageApiKeys(context.organization.role);
        const created = await createApiKey({
          createdBy: context.session.user.id,
          name: input.name,
          organizationId: context.organization.id,
          preset: input.preset
        });
        await recordAudit({
          actorId: context.session.user.id,
          actorName: context.session.user.name,
          action: "api_key.created",
          metadata: { scopes: created.scopes },
          organizationId: context.organization.id,
          targetLabel: input.name,
          targetType: "api_key"
        });
        void dispatchOrgWebhook(context.organization.id, "api_key.created", {
          name: input.name,
          scopes: created.scopes
        });
        return created;
      }),

    revoke: apiKeysProcedure
      .route({ description: "Revoke an API key", method: "POST" })
      .errors({
        API_KEY_NOT_FOUND: { description: "No such key on this workspace", status: 404 }
      })
      .input(z.object({ id: z.string().min(1) }))
      .handler(async ({ context, errors, input }) => {
        assertCanManageApiKeys(context.organization.role);
        const revoked = await revokeApiKey(context.organization.id, input.id);
        if (!revoked) throw errors.API_KEY_NOT_FOUND();
        await recordAudit({
          actorId: context.session.user.id,
          actorName: context.session.user.name,
          action: "api_key.revoked",
          organizationId: context.organization.id,
          targetLabel: input.id,
          targetType: "api_key"
        });
        void dispatchOrgWebhook(context.organization.id, "api_key.revoked", {
          id: input.id
        });
        return { ok: true };
      })
  },

  auditExport: auditExportRouter,

  batches: batchesRouter,

  dataExport: dataExportRouter,

  ipAllowlist: ipAllowlistRouter,

  notifications: notificationsRouter,

  profile: profileRouter,

  sso: ssoRouter,

  webhooks: webhooksRouter
};
