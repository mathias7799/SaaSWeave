/* eslint-disable jest/no-export, jest/no-standalone-expect, jest/expect-expect, jest/require-to-throw-message -- this is shared integration-test infrastructure, not a spec file */
import { createHash, randomUUID } from "node:crypto";

import { ORPCError } from "@orpc/client";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { it } from "vite-plus/test";

import { type AuthSession } from "@saasweave/auth/index";
import { connectRedis, getRedis, cacheInvalidateTag } from "@saasweave/cache";
import { type ApiKeyScope } from "@saasweave/core/api-keys";
import { DEFAULT_FEATURES } from "@saasweave/core/features";
import { db } from "@saasweave/db";
import {
  apiKey,
  featureFlag,
  member,
  organization,
  organizationFeatureFlag,
  organizationIpRule,
  session,
  user
} from "@saasweave/db/schema";
import { createLogger } from "@saasweave/logger/server";

import { verifyApiKey } from "#@/lib/api-keys";
import { type ApiKeyAuth, type OrpcContext } from "#@/lib/context/types";
import { invalidateOrganizationIpRules } from "#@/lib/ip-allowlist";
import { appRouter } from "#@/routers/index";

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

export type SeedApiKeyResult = {
  id: string;
  organizationId: string;
  scopes: ApiKeyScope[];
  secret: string;
};

export type CreateCallerOverrides = {
  apiKey?: ApiKeyAuth | null;
  /** Resolve API key auth through the real verifyApiKey path (revocation, hashing). */
  apiKeySecret?: string;
  clientIp?: string;
  featureFlags?: Record<string, boolean>;
  headers?: Headers;
  impersonatedBy?: string | null;
  organizationId?: string;
  role?: string;
  session?: AuthSession | null;
  userRole?: string;
};

export type SeedOrganizationResult = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export type SeedIpAllowlistRuleResult = {
  cidr: string;
  id: string;
  organizationId: string;
};

export type CreateCallerOptions = CreateCallerOverrides & {
  seed: SeedOrgWithOwnerResult;
};

const INTEGRATION_REDIS_LOCK_KEY = "integration-test:db-lock";
const INTEGRATION_REDIS_LOCK_TTL_MS = 60_000;

let integrationDbChain: Promise<unknown> = Promise.resolve();

function withIntegrationDbLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = integrationDbChain.then(operation, operation);
  integrationDbChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function withPostgresIntegrationLock<T>(run: () => Promise<T>): Promise<T> {
  const redis = await connectRedis(getRedis());
  if (!redis) {
    return run();
  }

  const token = randomUUID();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const acquired = await redis.set(
      INTEGRATION_REDIS_LOCK_KEY,
      token,
      "PX",
      INTEGRATION_REDIS_LOCK_TTL_MS,
      "NX"
    );
    if (acquired === "OK") {
      break;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  try {
    return await run();
  } finally {
    const holder = await redis.get(INTEGRATION_REDIS_LOCK_KEY);
    if (holder === token) {
      await redis.del(INTEGRATION_REDIS_LOCK_KEY);
    }
  }
}

/** Remove all application rows between tests without dropping the schema. */
async function resetDbUnlocked(): Promise<void> {
  const tableList = APP_TABLES.map((table) => `"${table}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
  await seedDefaultFeatureFlags();
  await Promise.all([
    cacheInvalidateTag("platform:settings"),
    cacheInvalidateTag("platform:plans"),
    cacheInvalidateTag("platform-analytics")
  ]);
}

export async function resetDb(): Promise<void> {
  return withIntegrationDbLock(resetDbUnlocked);
}

/** Reset the database and run one isolated integration case under a global DB lock. */
export async function runIntegrationCase<T>(run: () => Promise<T>): Promise<T> {
  return withPostgresIntegrationLock(async () => {
    await resetDbUnlocked();
    return run();
  });
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

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "workspace"}-${randomUUID().slice(0, 8)}`;
}

function buildAuthSession(
  seed: SeedOrgWithOwnerResult,
  organizationId: string,
  impersonatedBy: string | null = null,
  userRole = "user"
): AuthSession {
  const now = new Date();
  return {
    session: {
      activeOrganizationId: organizationId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      id: seed.sessionId,
      impersonatedBy,
      ipAddress: "127.0.0.1",
      token: `integration-${seed.sessionId}`,
      updatedAt: now,
      userAgent: "integration-test",
      userId: seed.userId
    },
    user: {
      banExpires: null,
      banReason: null,
      banned: false,
      createdAt: now,
      email: seed.email,
      emailVerified: true,
      id: seed.userId,
      image: null,
      name: seed.name,
      role: userRole,
      twoFactorEnabled: false,
      updatedAt: now
    }
  } as AuthSession;
}

/** Insert a user, workspace, owner membership, and session row for procedure auth. */
export async function seedOrgWithOwner(input?: {
  email?: string;
  name?: string;
  organizationName?: string;
  role?: string;
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
    slug: organizationSlug
  });

  await db.insert(member).values({
    createdAt: now,
    id: memberId,
    organizationId,
    role,
    userId
  });

  await db.insert(session).values({
    createdAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    id: sessionId,
    activeOrganizationId: organizationId,
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

/** Enable or disable per-workspace feature overrides used by requireFeature guards. */
export async function seedOrganizationFeatureFlags(
  organizationId: string,
  flags: Record<string, boolean>
): Promise<void> {
  await seedDefaultFeatureFlags();

  for (const [featureKey, enabled] of Object.entries(flags)) {
    await db
      .insert(organizationFeatureFlag)
      .values({
        enabled,
        featureKey,
        id: randomUUID(),
        organizationId
      })
      .onConflictDoUpdate({
        set: { enabled },
        target: [organizationFeatureFlag.organizationId, organizationFeatureFlag.featureKey]
      });
  }
}

/** Insert a workspace API key row and return the bearer secret for context injection. */
export async function seedApiKey(input: {
  createdBy: string;
  organizationId: string;
  name?: string;
  scopes?: ApiKeyScope[];
}): Promise<SeedApiKeyResult> {
  const id = randomUUID();
  const secret = `swv_${randomUUID().replaceAll("-", "")}`;
  const scopes = input.scopes ?? [];

  await db.insert(apiKey).values({
    createdAt: new Date(),
    createdBy: input.createdBy,
    id,
    keyHash: hashApiKeySecret(secret),
    keyPrefix: `${secret.slice(0, 11)}…`,
    name: input.name ?? "Integration key",
    organizationId: input.organizationId,
    scopes
  });

  return { id, organizationId: input.organizationId, scopes, secret };
}

/** Insert a workspace with no members (for cross-tenant session scenarios). */
export async function seedOrganization(input?: { name?: string }): Promise<SeedOrganizationResult> {
  const organizationId = randomUUID();
  const organizationName = input?.name ?? "Foreign workspace";
  const organizationSlug = slugify(organizationName);
  const now = new Date();

  await db.insert(organization).values({
    createdAt: now,
    id: organizationId,
    name: organizationName,
    slug: organizationSlug
  });

  return { organizationId, organizationName, organizationSlug };
}

/** Insert an IP allowlist rule row for orgProcedure / integrationProcedure enforcement. */
export async function seedIpAllowlistRule(input: {
  cidr: string;
  createdBy?: string;
  organizationId: string;
}): Promise<SeedIpAllowlistRuleResult> {
  const id = randomUUID();
  await db.insert(organizationIpRule).values({
    cidr: input.cidr,
    createdAt: new Date(),
    createdBy: input.createdBy ?? null,
    id,
    organizationId: input.organizationId
  });
  await invalidateOrganizationIpRules(input.organizationId);
  return { cidr: input.cidr, id, organizationId: input.organizationId };
}

/** Grant the platform-admin role used by adminProcedure. */
export async function seedPlatformAdmin(userId: string): Promise<void> {
  await db.update(user).set({ role: "admin" }).where(eq(user.id, userId));
}

export function isOrpcErrorWithCode(
  error: unknown,
  code: string
): error is ORPCError<string, unknown> {
  return error instanceof ORPCError && error.code === code;
}

/** Move a workspace onto a paid plan tier for plan-gated feature eligibility. */
export async function seedOrganizationPlan(
  organizationId: string,
  planId: "growth" | "scale" | "enterprise" = "scale"
): Promise<void> {
  await db.update(organization).set({ planId }).where(eq(organization.id, organizationId));
}

/** Enable metered usage + scoped API keys for integrationProcedure tests on starter workspaces. */
export async function seedUsageIntegration(seed: SeedOrgWithOwnerResult): Promise<void> {
  await seedOrganizationPlan(seed.organizationId, "growth");
  await seedOrganizationFeatureFlags(seed.organizationId, {
    api_key_scopes: true,
    usage_billing: true
  });
}

export function integrationIt(name: string, run: () => Promise<void>): void {
  // eslint-disable-next-line jest/valid-title -- name is a dynamic title for this test wrapper
  it(name, () => runIntegrationCase(run), 30_000);
}

export async function expectOrpcError(run: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await run();
    throw new Error(`Expected ORPCError ${code} but the procedure succeeded`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected ORPCError")) {
      throw error;
    }
    if (!isOrpcErrorWithCode(error, code)) {
      throw error;
    }
  }
}

function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

async function applyCallerOverrides(
  seed: SeedOrgWithOwnerResult,
  overrides: CreateCallerOverrides
): Promise<{ organizationId: string; role: string }> {
  const organizationId = overrides.organizationId ?? seed.organizationId;
  const role = overrides.role ?? seed.role;

  if (role !== seed.role) {
    await db.update(member).set({ role }).where(eq(member.id, seed.memberId));
  }

  if (overrides.organizationId && overrides.organizationId !== seed.organizationId) {
    await db
      .update(session)
      .set({ activeOrganizationId: overrides.organizationId })
      .where(eq(session.id, seed.sessionId));
  }

  if (overrides.featureFlags) {
    await seedOrganizationFeatureFlags(organizationId, overrides.featureFlags);
  }

  return { organizationId, role };
}

function buildOrpcContext(
  seed: SeedOrgWithOwnerResult,
  overrides: CreateCallerOverrides,
  organizationId: string,
  apiKeyFromSecret?: ApiKeyAuth | null
): OrpcContext {
  if (apiKeyFromSecret !== undefined) {
    return {
      apiKey: apiKeyFromSecret ?? undefined,
      clientIp: overrides.clientIp ?? "127.0.0.1",
      headers: overrides.headers ?? new Headers(),
      logger: createLogger({ operation: "api__integration_test" }),
      session: overrides.session ?? null
    };
  }

  if (overrides.apiKey) {
    return {
      apiKey: overrides.apiKey,
      clientIp: overrides.clientIp ?? "127.0.0.1",
      headers: overrides.headers ?? new Headers(),
      logger: createLogger({ operation: "api__integration_test" }),
      session: null
    };
  }

  if (overrides.session === null) {
    return {
      clientIp: overrides.clientIp ?? "127.0.0.1",
      headers: overrides.headers ?? new Headers(),
      logger: createLogger({ operation: "api__integration_test" }),
      session: null
    };
  }

  const impersonatedBy = overrides.impersonatedBy === undefined ? null : overrides.impersonatedBy;
  const userRole = overrides.userRole ?? "user";
  const authSession =
    overrides.session ?? buildAuthSession(seed, organizationId, impersonatedBy, userRole);

  return {
    clientIp: overrides.clientIp ?? "127.0.0.1",
    headers: overrides.headers ?? new Headers(),
    logger: createLogger({ operation: "api__integration_test" }),
    session: authSession
  };
}

/** Build a typed in-process appRouter client with a fabricated request context. */
export async function createCallerFor(
  options: CreateCallerOptions
): Promise<RouterClient<typeof appRouter>> {
  const { seed, ...overrides } = options;
  const { organizationId } = await applyCallerOverrides(seed, overrides);

  const apiKeyFromSecret =
    overrides.apiKeySecret === undefined ? undefined : await verifyApiKey(overrides.apiKeySecret);
  const context = buildOrpcContext(
    seed,
    overrides,
    organizationId,
    apiKeyFromSecret === undefined ? undefined : apiKeyFromSecret
  );

  return createRouterClient(appRouter, {
    context: () => context
  });
}
