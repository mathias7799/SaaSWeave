import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { type PlatformFeatureType } from "@saasweave/core/features";
import { DEFAULT_FEATURES, IMPLEMENTED_FEATURE_KEYS } from "@saasweave/core/features";
import { db } from "@saasweave/db";
import { featureFlag, organizationFeatureFlag } from "@saasweave/db/schema";

import { resolveFeatureEnabled } from "#@/lib/feature-rollout";
import { getOrgSeatContext } from "#@/lib/organization";

let seeded = false;

/** Insert any missing default features. Runs once per process. */
export async function ensureFeaturesSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  await db
    .insert(featureFlag)
    .values(
      DEFAULT_FEATURES.map((entry) => {
        return {
          availableOn: entry.availableOn,
          category: entry.category,
          description: entry.description,
          enabled: entry.enabled,
          key: entry.key,
          name: entry.name,
          rollout: entry.rollout ?? null
        };
      })
    )
    .onConflictDoNothing();
}

function toFeature(row: typeof featureFlag.$inferSelect): PlatformFeatureType {
  return {
    availableOn: row.availableOn,
    category: row.category as PlatformFeatureType["category"],
    description: row.description,
    enabled: row.enabled,
    key: row.key,
    name: row.name,
    rollout: row.rollout ?? undefined
  };
}

/** Full feature catalog (global defaults, no per-org overrides applied). */
export async function listFeatures(): Promise<PlatformFeatureType[]> {
  await ensureFeaturesSeeded();
  const knownKeys = new Set<string>(IMPLEMENTED_FEATURE_KEYS);
  return (await db.select().from(featureFlag))
    .filter((row) => knownKeys.has(row.key))
    .map(toFeature);
}

export async function setFeatureGlobalEnabled(key: string, enabled: boolean): Promise<void> {
  await db.update(featureFlag).set({ enabled }).where(eq(featureFlag.key, key));
}

export async function setFeatureRollout(key: string, rollout: number | null): Promise<void> {
  await db.update(featureFlag).set({ rollout }).where(eq(featureFlag.key, key));
}

export async function setFeatureForOrganization(
  organizationId: string,
  featureKey: string,
  enabled: boolean
): Promise<void> {
  const [existing] = await db
    .select({ id: organizationFeatureFlag.id })
    .from(organizationFeatureFlag)
    .where(
      and(
        eq(organizationFeatureFlag.organizationId, organizationId),
        eq(organizationFeatureFlag.featureKey, featureKey)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(organizationFeatureFlag)
      .set({ enabled })
      .where(eq(organizationFeatureFlag.id, existing.id));
    return;
  }

  await db.insert(organizationFeatureFlag).values({
    enabled,
    featureKey,
    id: randomUUID(),
    organizationId
  });
}

export async function clearFeatureForOrganization(
  organizationId: string,
  featureKey: string
): Promise<void> {
  await db
    .delete(organizationFeatureFlag)
    .where(
      and(
        eq(organizationFeatureFlag.organizationId, organizationId),
        eq(organizationFeatureFlag.featureKey, featureKey)
      )
    );
}

export type ResolvedFeature = PlatformFeatureType & {
  /** Resolved on/off state for this organization: override wins, else the global default. */
  enabledForOrg: boolean;
  /** Whether the org's current plan is in `availableOn`. */
  planEligible: boolean;
  /** True when an explicit per-org override exists (vs. inheriting the global default). */
  overridden: boolean;
};

/** Every feature, resolved for one organization (override > global default, plus plan eligibility). */
export async function listFeaturesForOrg(
  organizationId: string,
  planId: string | null
): Promise<ResolvedFeature[]> {
  const [features, overrides] = await Promise.all([
    listFeatures(),
    db
      .select({
        enabled: organizationFeatureFlag.enabled,
        featureKey: organizationFeatureFlag.featureKey
      })
      .from(organizationFeatureFlag)
      .where(eq(organizationFeatureFlag.organizationId, organizationId))
  ]);
  const overrideByKey = new Map(overrides.map((row) => [row.featureKey, row.enabled]));
  const resolvedPlanId = planId ?? "starter";

  return features.map((feature) => {
    const override = overrideByKey.get(feature.key);
    const planEligible = feature.availableOn.includes(resolvedPlanId);
    const enabledForOrg = resolveFeatureEnabled({
      featureKey: feature.key,
      globalEnabled: feature.enabled,
      organizationId,
      override,
      planEligible,
      rollout: feature.rollout ?? null
    });
    return {
      ...feature,
      enabledForOrg,
      overridden: override !== undefined,
      planEligible
    };
  });
}

export async function isFeatureEnabledForOrg(
  organizationId: string,
  key: string
): Promise<boolean> {
  const seat = await getOrgSeatContext(organizationId);
  const [override] = await db
    .select({ enabled: organizationFeatureFlag.enabled })
    .from(organizationFeatureFlag)
    .where(
      and(
        eq(organizationFeatureFlag.organizationId, organizationId),
        eq(organizationFeatureFlag.featureKey, key)
      )
    )
    .limit(1);

  const [flag] = await db
    .select({
      availableOn: featureFlag.availableOn,
      enabled: featureFlag.enabled,
      rollout: featureFlag.rollout
    })
    .from(featureFlag)
    .where(eq(featureFlag.key, key))
    .limit(1);
  if (!flag) return false;

  const planId = seat.planId ?? "starter";
  return resolveFeatureEnabled({
    featureKey: key,
    globalEnabled: flag.enabled,
    organizationId,
    override: override?.enabled,
    planEligible: flag.availableOn.includes(planId),
    rollout: flag.rollout
  });
}
