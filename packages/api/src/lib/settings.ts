import { eq } from "drizzle-orm";

import { cacheInvalidateTag, cacheWrap } from "@saasweave/cache";
import {
  getPlatformSettings as getPlatformSettingsFromDb,
  type PlatformSettings,
  type PublicPlatformSettings
} from "@saasweave/db";
import { db } from "@saasweave/db";
import { platformSettings } from "@saasweave/db/schema";

const SETTINGS_ID = "default";
const SETTINGS_TAG = "platform:settings";
const SETTINGS_CACHE_KEY = "singleton";
const SETTINGS_NAMESPACE = "settings";

export type { PlatformSettings, PublicPlatformSettings };

export async function getPlatformSettings(): Promise<PlatformSettings> {
  return cacheWrap(SETTINGS_CACHE_KEY, getPlatformSettingsFromDb, {
    namespace: SETTINGS_NAMESPACE,
    tags: [SETTINGS_TAG],
    ttlSeconds: 30
  });
}

export async function getPublicPlatformSettings(): Promise<PublicPlatformSettings> {
  const settings = await getPlatformSettings();
  return {
    maintenanceMode: settings.maintenanceMode,
    platformName: settings.platformName,
    signupsOpen: settings.signupsOpen,
    supportEmail: settings.supportEmail
  };
}

export async function updatePlatformSettings(
  patch: Partial<PlatformSettings>
): Promise<PlatformSettings> {
  await getPlatformSettings();
  const [row] = await db
    .update(platformSettings)
    .set(patch)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .returning();
  await cacheInvalidateTag(SETTINGS_TAG);
  if (!row) return getPlatformSettings();
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
