import { z } from "zod";

import { PlanTierSchema } from "@saasweave/core/plans";
import { recordAudit } from "@saasweave/db";

import {
  clearFeatureForOrganization,
  ensureFeaturesSeeded,
  listFeatures,
  setFeatureForOrganization,
  setFeatureGlobalEnabled,
  setFeatureRollout
} from "#@/lib/features";
import { createPlan, deletePlan, isPlanInUse, listPlans, updatePlan } from "#@/lib/plans";
import { adminProcedure } from "#@/lib/procedures/factory";
import { buildFeatureStats } from "#@/routers/admin/data";

const planInputSchema = z.object({
  cta: z.string().min(1).max(200),
  highlights: z.array(z.string().min(1).max(200)).max(50),
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  popular: z.boolean().optional(),
  priceMonthly: z.number().int().nonnegative().nullable(),
  seatPrice: z.number().int().nonnegative().nullable().optional(),
  seatsIncluded: z.number().int().nonnegative(),
  sortOrder: z.number().int().optional(),
  tagline: z.string().min(1).max(200)
});

function actor(context: { session: { user: { id: string; name: string } } }) {
  return { actorId: context.session.user.id, actorName: context.session.user.name };
}

export const adminCatalogRouter = {
  features: {
    list: adminProcedure
      .route({
        description: "Feature flag catalog with real per-feature adoption across workspaces",
        method: "POST"
      })
      .input(z.object({ keys: z.array(z.string()).optional() }))
      .handler(async ({ input }) => {
        const features = await listFeatures();
        const keys = input.keys ?? features.map((feature) => feature.key);
        const stats = await buildFeatureStats(keys);
        const statByKey = new Map(stats.stats.map((stat) => [stat.key, stat]));
        return {
          features: features.map((feature) => {
            return {
              ...feature,
              stats: statByKey.get(feature.key) ?? {
                adoptionPct: 0,
                key: feature.key,
                requests30d: 0,
                totalWorkspaces: stats.totalWorkspaces,
                workspacesEnabled: 0
              }
            };
          })
        };
      }),

    toggleGlobal: adminProcedure
      .route({ description: "Enable or disable a feature flag platform-wide", method: "POST" })
      .input(z.object({ enabled: z.boolean(), key: z.string() }))
      .handler(async ({ context, input }) => {
        await ensureFeaturesSeeded();
        await setFeatureGlobalEnabled(input.key, input.enabled);
        await recordAudit({
          ...actor(context),
          action: input.enabled ? "feature.enabled" : "feature.disabled",
          metadata: { key: input.key },
          targetLabel: input.key,
          targetType: "feature_flag"
        });
        return { ok: true };
      }),

    updateRollout: adminProcedure
      .route({ description: "Set a staged rollout percentage for a feature flag", method: "POST" })
      .input(z.object({ key: z.string(), rollout: z.number().int().min(0).max(100).nullable() }))
      .handler(async ({ context, input }) => {
        await ensureFeaturesSeeded();
        await setFeatureRollout(input.key, input.rollout);
        await recordAudit({
          ...actor(context),
          action: "feature.rollout_updated",
          metadata: { key: input.key, rollout: input.rollout },
          targetLabel: input.key,
          targetType: "feature_flag"
        });
        return { ok: true };
      }),

    setForOrganization: adminProcedure
      .route({ description: "Override a feature flag for a single workspace", method: "POST" })
      .input(
        z.object({
          enabled: z.boolean().nullable(),
          key: z.string(),
          organizationId: z.string()
        })
      )
      .handler(async ({ context, input }) => {
        if (input.enabled === null) {
          await clearFeatureForOrganization(input.organizationId, input.key);
        } else {
          await setFeatureForOrganization(input.organizationId, input.key, input.enabled);
        }
        await recordAudit({
          ...actor(context),
          action: "feature.override_updated",
          metadata: { enabled: input.enabled, key: input.key },
          organizationId: input.organizationId,
          targetLabel: input.key,
          targetType: "feature_flag"
        });
        return { ok: true };
      })
  },

  plans: {
    create: adminProcedure
      .route({ description: "Add a new plan to the catalog", method: "POST" })
      .errors({
        PLAN_EXISTS: { description: "A plan with this id already exists", status: 409 }
      })
      .input(planInputSchema)
      .output(PlanTierSchema)
      .handler(async ({ context, errors, input }) => {
        const existing = await listPlans();
        if (existing.some((plan) => plan.id === input.id)) {
          throw errors.PLAN_EXISTS();
        }
        const plan = await createPlan(input);
        await recordAudit({
          ...actor(context),
          action: "plan.created",
          targetLabel: plan.name,
          targetType: "plan"
        });
        return plan;
      }),

    update: adminProcedure
      .route({ description: "Edit an existing plan", method: "POST" })
      .errors({
        PLAN_NOT_FOUND: { description: "No plan with this id exists", status: 404 }
      })
      .input(planInputSchema.partial().extend({ id: z.string().min(1) }))
      .output(PlanTierSchema)
      .handler(async ({ context, errors, input }) => {
        const plan = await updatePlan(input);
        if (!plan) throw errors.PLAN_NOT_FOUND();
        await recordAudit({
          ...actor(context),
          action: "plan.updated",
          targetLabel: plan.name,
          targetType: "plan"
        });
        return plan;
      }),

    remove: adminProcedure
      .route({ description: "Delete a plan from the catalog", method: "POST" })
      .errors({
        PLAN_IN_USE: {
          description: "One or more workspaces are still subscribed to this plan",
          status: 409
        }
      })
      .input(z.object({ id: z.string().min(1) }))
      .handler(async ({ context, errors, input }) => {
        if (await isPlanInUse(input.id)) {
          throw errors.PLAN_IN_USE();
        }
        const deleted = await deletePlan(input.id);
        if (deleted) {
          await recordAudit({
            ...actor(context),
            action: "plan.deleted",
            targetLabel: input.id,
            targetType: "plan"
          });
        }
        return { ok: deleted };
      })
  }
};
