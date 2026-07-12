import { eq } from "drizzle-orm";

import { db } from "#@/connection";
import { platformSettings } from "#@/schema/platform.schema";

const SETTINGS_ID = "default";

export type PlatformSettings = {
  billingMode: "subscription" | "usage" | "hybrid";
  currency: string;
  maintenanceMode: boolean;
  platformName: string;
  signupsOpen: boolean;
  supportEmail: string;
  trialsEnabled: boolean;
};

const DEFAULTS: PlatformSettings = {
  billingMode: "hybrid",
  currency: "USD",
  maintenanceMode: false,
  platformName: "SaaSWeave",
  signupsOpen: true,
  supportEmail: "support@saasweave.io",
  trialsEnabled: true
};

function toSettings(row: typeof platformSettings.$inferSelect): PlatformSettings {
  return {
    billingMode: row.billingMode as PlatformSettings["billingMode"],
    currency: row.currency,
    maintenanceMode: row.maintenanceMode,
    platformName: row.platformName,
    signupsOpen: row.signupsOpen,
    supportEmail: row.supportEmail,
    trialsEnabled: row.trialsEnabled
  };
}

/** Read the singleton settings row, creating it with defaults on first read. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .limit(1);
  if (existing) return toSettings(existing);

  const [created] = await db
    .insert(platformSettings)
    .values({ id: SETTINGS_ID, ...DEFAULTS })
    .onConflictDoNothing()
    .returning();
  if (created) return toSettings(created);

  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .limit(1);
  return row ? toSettings(row) : DEFAULTS;
}

export type PublicPlatformSettings = Pick<
  PlatformSettings,
  "platformName" | "supportEmail" | "signupsOpen" | "maintenanceMode"
>;

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings> {
  const settings = await getPlatformSettings();
  return {
    maintenanceMode: settings.maintenanceMode,
    platformName: settings.platformName,
    signupsOpen: settings.signupsOpen,
    supportEmail: settings.supportEmail
  };
}
