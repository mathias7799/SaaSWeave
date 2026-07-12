import { randomBytes, randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import {
  cacheGet,
  cacheInvalidateTag,
  cacheSet,
  resolveSecurityFailureMode
} from "@saasweave/cache";
import {
  type ApiKeyScope,
  type ApiKeyScopePreset,
  normalizeApiKeyScopesInput,
  resolveApiKeyScopes,
  scopesFromPreset
} from "@saasweave/core/api-keys";
import { db } from "@saasweave/db";
import { apiKey, user } from "@saasweave/db/schema";

import { type ApiKeyAuth } from "#@/lib/context/types";

const KEY_PREFIX = "swv";
const BEARER_PREFIXES = ["swv_", "bnk_"] as const;
const API_KEY_CACHE_NAMESPACE = "api-keys";
const API_KEY_CACHE_TTL_SECONDS = 60;

type CachedApiKeyRecord = {
  id: string;
  lastUsedAt: string | null;
  organizationId: string;
  scopes: ApiKeyScope[];
};

function apiKeyCacheTag(apiKeyId: string): string {
  return `api-key:${apiKeyId}`;
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Generates a new secret and its display prefix. The secret is never persisted in plaintext. */
function generateSecret(): { secret: string; displayPrefix: string } {
  const token = randomBytes(24).toString("base64url");
  const secret = `${KEY_PREFIX}_${token}`;
  return { displayPrefix: `${secret.slice(0, 11)}…`, secret };
}

export type ApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  createdByName: string | null;
  revokedAt: string | null;
};

export async function listApiKeys(organizationId: string): Promise<ApiKeySummary[]> {
  const rows = await db
    .select({
      createdAt: apiKey.createdAt,
      createdByName: user.name,
      id: apiKey.id,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      revokedAt: apiKey.revokedAt,
      scopes: apiKey.scopes
    })
    .from(apiKey)
    .leftJoin(user, eq(apiKey.createdBy, user.id))
    .where(eq(apiKey.organizationId, organizationId))
    .orderBy(desc(apiKey.createdAt));

  return rows.map((row) => {
    return {
      createdAt: row.createdAt.toISOString(),
      createdByName: row.createdByName ?? null,
      id: row.id,
      keyPrefix: row.keyPrefix,
      name: row.name,
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      scopes: resolveApiKeyScopes(row.scopes ?? [])
    };
  });
}

/** Creates a key and returns the plaintext secret exactly once. It cannot be retrieved again. */
export async function createApiKey(input: {
  organizationId: string;
  name: string;
  createdBy: string;
  preset?: ApiKeyScopePreset;
  scopes?: ApiKeyScope[];
}): Promise<{ id: string; secret: string; keyPrefix: string; scopes: ApiKeyScope[] }> {
  const { secret, displayPrefix } = generateSecret();
  const id = randomUUID();
  const scopes = input.scopes
    ? normalizeApiKeyScopesInput(input.scopes)
    : scopesFromPreset(input.preset ?? "integration");

  await db.insert(apiKey).values({
    createdBy: input.createdBy,
    id,
    keyHash: hashSecret(secret),
    keyPrefix: displayPrefix,
    name: input.name,
    organizationId: input.organizationId,
    scopes
  });

  return { id, keyPrefix: displayPrefix, scopes, secret };
}

export async function invalidateApiKeyCache(apiKeyId: string): Promise<void> {
  await cacheInvalidateTag(apiKeyCacheTag(apiKeyId), {
    failureMode: resolveSecurityFailureMode()
  });
}

export async function revokeApiKey(organizationId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(apiKey.id, id), eq(apiKey.organizationId, organizationId), isNull(apiKey.revokedAt))
    )
    .returning({ id: apiKey.id });
  if (rows.length > 0) {
    await invalidateApiKeyCache(id);
  }
  return rows.length > 0;
}

async function lookupApiKeyByHash(keyHash: string): Promise<CachedApiKeyRecord | null> {
  const cached = await cacheGet<CachedApiKeyRecord>(keyHash, {
    failureMode: resolveSecurityFailureMode(),
    namespace: API_KEY_CACHE_NAMESPACE
  });
  if (cached !== null) return cached;

  const [row] = await db
    .select({
      id: apiKey.id,
      lastUsedAt: apiKey.lastUsedAt,
      organizationId: apiKey.organizationId,
      scopes: apiKey.scopes
    })
    .from(apiKey)
    .where(and(eq(apiKey.keyHash, keyHash), isNull(apiKey.revokedAt)))
    .limit(1);
  if (!row) return null;

  const record: CachedApiKeyRecord = {
    id: row.id,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    organizationId: row.organizationId,
    scopes: resolveApiKeyScopes(row.scopes ?? [])
  };

  await cacheSet(keyHash, record, {
    failureMode: resolveSecurityFailureMode(),
    namespace: API_KEY_CACHE_NAMESPACE,
    tags: [apiKeyCacheTag(row.id)],
    ttlSeconds: API_KEY_CACHE_TTL_SECONDS
  });

  return record;
}

/** Resolve a bearer API key to its workspace scope. Returns null when invalid. */
export async function verifyApiKey(secret: string): Promise<ApiKeyAuth | null> {
  if (!BEARER_PREFIXES.some((prefix) => secret.startsWith(prefix))) return null;
  const keyHash = hashSecret(secret);
  const row = await lookupApiKeyByHash(keyHash);
  if (!row) return null;

  const staleThreshold = Date.now() - 5 * 60 * 1000;
  const lastUsedAt = row.lastUsedAt ? new Date(row.lastUsedAt) : null;
  if (!lastUsedAt || lastUsedAt.getTime() < staleThreshold) {
    const now = new Date();
    await db.update(apiKey).set({ lastUsedAt: now }).where(eq(apiKey.id, row.id));
    // Refresh the cached record so later hits within the TTL see the fresh
    // lastUsedAt and don't re-issue the update on every request.
    row.lastUsedAt = now.toISOString();
    await cacheSet(keyHash, row, {
      failureMode: resolveSecurityFailureMode(),
      namespace: API_KEY_CACHE_NAMESPACE,
      tags: [apiKeyCacheTag(row.id)],
      ttlSeconds: API_KEY_CACHE_TTL_SECONDS
    });
  }

  return {
    id: row.id,
    organizationId: row.organizationId,
    scopes: row.scopes
  };
}
