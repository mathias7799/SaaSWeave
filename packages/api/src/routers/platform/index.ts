import { PlanTierSchema } from "@saasweave/core/plans";

import { listPlans } from "#@/lib/plans";
import { publicProcedure } from "#@/lib/procedures/factory";
import { getPublicPlatformSettings } from "#@/lib/settings";

/**
 * Public, unauthenticated platform surface: the plan catalog (shown on
 * billing/upgrade screens before or without a session) and the safe subset
 * of platform settings needed by the sign-up page and the maintenance banner.
 */
export const platformRouter = {
  plans: publicProcedure
    .route({ description: "Public plan catalog", method: "GET" })
    .output(PlanTierSchema.array())
    .handler(() => listPlans()),

  settings: publicProcedure
    .route({
      description:
        "Public subset of platform settings (name, support email, sign-up/maintenance state)",
      method: "GET"
    })
    .handler(() => getPublicPlatformSettings())
};
