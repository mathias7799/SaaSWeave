import { z } from "zod";

import { recordAudit } from "@saasweave/db";

import { adminProcedure } from "#@/lib/procedures/factory";
import { getPlatformSettings, updatePlatformSettings } from "#@/lib/settings";

const settingsPatchSchema = z.object({
  billingMode: z.enum(["subscription", "usage", "hybrid"]).optional(),
  currency: z.string().min(1).max(10).optional(),
  maintenanceMode: z.boolean().optional(),
  platformName: z.string().min(1).max(200).optional(),
  signupsOpen: z.boolean().optional(),
  supportEmail: z.email().optional(),
  trialsEnabled: z.boolean().optional()
});

export const adminSettingsRouter = {
  get: adminProcedure
    .route({ description: "Read the platform-wide settings singleton", method: "GET" })
    .handler(() => getPlatformSettings()),

  update: adminProcedure
    .route({ description: "Update one or more platform-wide settings", method: "POST" })
    .input(settingsPatchSchema)
    .handler(async ({ context, input }) => {
      const updated = await updatePlatformSettings(input);
      await recordAudit({
        actorId: context.session.user.id,
        actorName: context.session.user.name,
        action: "settings.updated",
        metadata: input,
        targetLabel: "platform settings",
        targetType: "platform_settings"
      });
      return updated;
    })
};
