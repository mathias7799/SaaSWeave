import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, getOrganizationActivity, recordAudit } from "@saasweave/db";
import { organization } from "@saasweave/db/schema";

import { listFeaturesForOrg } from "#@/lib/features";
import { getPlanCatalog, resolvePlanEntry } from "#@/lib/plans";
import { adminProcedure } from "#@/lib/procedures/factory";
import { getTeam } from "#@/routers/console/team";

export const adminWorkspacesRouter = {
  detail: adminProcedure
    .route({
      description:
        "Full detail for a single workspace: plan, team, activity, and feature overrides",
      method: "GET"
    })
    .errors({
      WORKSPACE_NOT_FOUND: { description: "No workspace with this id exists", status: 404 }
    })
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ errors, input }) => {
      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, input.id))
        .limit(1);
      if (!org) throw errors.WORKSPACE_NOT_FOUND();

      const catalog = await getPlanCatalog();
      const plan = resolvePlanEntry(catalog, org.planId);

      const [team, activity, features] = await Promise.all([
        getTeam(org.id, plan.seats),
        getOrganizationActivity(org.id, 30),
        listFeaturesForOrg(org.id, org.planId)
      ]);
      const owner = team.members.find((entry) => entry.role === "owner");

      return {
        activity,
        createdOn: org.createdAt.toISOString(),
        features,
        id: org.id,
        name: org.name,
        owner: owner ? { email: owner.email, name: owner.name } : null,
        plan: {
          id: org.planId ?? "free",
          mrr: plan.price,
          name: plan.name,
          seatsIncluded: plan.seats
        },
        slug: org.slug,
        status: org.subscriptionStatus ?? "active",
        stripeCustomerId: org.stripeCustomerId,
        team: { invitations: team.invitations, members: team.members }
      };
    }),

  updatePlan: adminProcedure
    .route({ description: "Manually reassign a workspace's plan", method: "POST" })
    .errors({
      WORKSPACE_NOT_FOUND: { description: "No workspace with this id exists", status: 404 }
    })
    .input(z.object({ id: z.string().min(1), planId: z.string().min(1) }))
    .handler(async ({ context, errors, input }) => {
      const rows = await db
        .update(organization)
        .set({ planId: input.planId })
        .where(eq(organization.id, input.id))
        .returning({ id: organization.id, name: organization.name });
      const org = rows[0];
      if (!org) throw errors.WORKSPACE_NOT_FOUND();

      await recordAudit({
        actorId: context.session.user.id,
        actorName: context.session.user.name,
        action: "workspace.plan_changed",
        metadata: { planId: input.planId },
        organizationId: org.id,
        targetLabel: org.name,
        targetType: "organization"
      });
      return { ok: true };
    })
};
