/* eslint-disable jest/no-export -- shared integration-test infrastructure */
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { DEFAULT_FEATURES } from "@saasweave/core/features";
import { type MediaAssetPurpose, type MediaAssetStatus } from "@saasweave/core/media-asset";

import { db } from "#@/connection";
import { featureFlag, member, organization, session, usageEvent, user } from "#@/schema/index";
import { mediaAsset } from "#@/schema/media-asset.schema";

const APP_TABLES = [
  "batch_job_item",
  "batch_job",
  "data_export_request",
  "webhook_delivery",
  "webhook_endpoint",
  "notification",
  "api_key",
  "organization_feature_flag",
  "organization_ip_rule",
  "processed_event",
  "sso_provider",
  "media_asset",
  "two_factor",
  "mrr_snapshot",
  "email_delivery",
  "email_template",
  "audit_log",
  "usage_event",
  "invitation",
  "member",
  "organization",
  "account",
  "session",
  "verification",
  "user",
  "feature_flag",
  "plan",
  "platform_settings",
  "platform_analytics_daily"
] as const;

export type SeedOrgWithOwnerResult = {
  email: string;
  memberId: string;
  name: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  sessionId: string;
  userId: string;
};

export type SeedUserResult = {
  email: string;
  name: string;
  userId: string;
};

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "workspace"}-${randomUUID().slice(0, 8)}`;
}

async function seedDefaultFeatureFlags(): Promise<void> {
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

/** Remove all application rows between tests without dropping the schema. */
export async function resetDb(): Promise<void> {
  const tableList = APP_TABLES.map((table) => `"${table}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
  await seedDefaultFeatureFlags();
}

/** Insert a user, workspace, owner membership, and session row. */
export async function seedOrgWithOwner(input?: {
  email?: string;
  name?: string;
  organizationName?: string;
  role?: string;
  stripeCustomerId?: string;
}): Promise<SeedOrgWithOwnerResult> {
  const userId = randomUUID();
  const organizationId = randomUUID();
  const memberId = randomUUID();
  const sessionId = randomUUID();
  const email = input?.email ?? `owner-${userId.slice(0, 8)}@integration.test`;
  const name = input?.name ?? "Integration Owner";
  const organizationName = input?.organizationName ?? `${name}'s workspace`;
  const role = input?.role ?? "owner";
  const organizationSlug = slugify(organizationName);
  const now = new Date();

  await db.insert(user).values({
    createdAt: now,
    email,
    emailVerified: true,
    id: userId,
    name,
    role: "user",
    updatedAt: now
  });

  await db.insert(organization).values({
    createdAt: now,
    id: organizationId,
    name: organizationName,
    slug: organizationSlug,
    stripeCustomerId: input?.stripeCustomerId ?? null
  });

  await db.insert(member).values({
    createdAt: now,
    id: memberId,
    organizationId,
    role,
    userId
  });

  await db.insert(session).values({
    activeOrganizationId: organizationId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    id: sessionId,
    token: `integration-${sessionId}`,
    updatedAt: now,
    userId
  });

  return {
    email,
    memberId,
    name,
    organizationId,
    organizationName,
    organizationSlug,
    role,
    sessionId,
    userId
  };
}

/** Insert an additional workspace member. */
export async function seedMember(input: {
  organizationId: string;
  role?: string;
}): Promise<SeedUserResult & { memberId: string }> {
  const userId = randomUUID();
  const memberId = randomUUID();
  const email = `member-${userId.slice(0, 8)}@integration.test`;
  const name = "Integration Member";
  const now = new Date();

  await db.insert(user).values({
    createdAt: now,
    email,
    emailVerified: true,
    id: userId,
    name,
    role: "user",
    updatedAt: now
  });

  await db.insert(member).values({
    createdAt: now,
    id: memberId,
    organizationId: input.organizationId,
    role: input.role ?? "member",
    userId
  });

  return { email, memberId, name, userId };
}

/** Insert usage events for aggregation helpers. */
export async function seedUsageEvents(
  organizationId: string,
  rows: Array<{
    createdAt?: Date;
    feature?: string | null;
    id?: string;
    inputTokens?: number | null;
    metric: string;
    model?: string | null;
    outputTokens?: number | null;
    provider?: string | null;
    quantity: number;
  }>
): Promise<void> {
  const now = new Date();
  await db.insert(usageEvent).values(
    rows.map((row) => {
      return {
        createdAt: row.createdAt ?? now,
        feature: row.feature ?? null,
        id: row.id ?? randomUUID(),
        inputTokens: row.inputTokens ?? null,
        metric: row.metric,
        model: row.model ?? null,
        organizationId,
        outputTokens: row.outputTokens ?? null,
        provider: row.provider ?? null,
        quantity: row.quantity
      };
    })
  );
}

/** Enable or disable a global feature flag row. */
export async function seedFeatureFlag(key: string, enabled: boolean): Promise<void> {
  await seedDefaultFeatureFlags();
  await db.update(featureFlag).set({ enabled }).where(eq(featureFlag.key, key));
}

/** Insert a media asset owned by a user. */
export async function seedMediaAsset(input: {
  contentType: string;
  key: string;
  ownerId: string;
  purpose?: string;
  size?: number;
  status: string;
}): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(mediaAsset).values({
    contentType: input.contentType,
    createdAt: new Date(),
    id,
    key: input.key,
    ownerId: input.ownerId,
    purpose: (input.purpose ?? "avatar") as MediaAssetPurpose,
    size: input.size ?? 1024,
    status: input.status as MediaAssetStatus
  });
  return { id };
}
