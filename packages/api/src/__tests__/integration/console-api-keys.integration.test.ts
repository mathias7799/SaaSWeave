/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedApiKey,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

async function seedApiKeyFeature(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedOrganizationPlan(seed.organizationId);
  await seedOrganizationFeatureFlags(seed.organizationId, { api_keys: true });
}

describe.sequential("console apiKeys", () => {
  integrationIt("list returns seeded keys without exposing secrets", async () => {
    const seed = await seedOrgWithOwner();
    await seedApiKeyFeature(seed);
    const key = await seedApiKey({
      createdBy: seed.userId,
      name: "Integration list key",
      organizationId: seed.organizationId,
      scopes: ["usage:read"]
    });
    const caller = await createCallerFor({ seed });

    const keys = await caller.console.apiKeys.list();

    expect(keys).toEqual([
      expect.objectContaining({
        id: key.id,
        name: "Integration list key",
        scopes: ["usage:read"]
      })
    ]);
    expect(keys[0]).not.toHaveProperty("secret");
  });

  integrationIt("create returns a one-time secret with integration preset scopes", async () => {
    const seed = await seedOrgWithOwner();
    await seedApiKeyFeature(seed);
    const caller = await createCallerFor({ seed });

    const created = await caller.console.apiKeys.create({
      name: "New integration key",
      preset: "integration"
    });

    expect(created.secret.startsWith("swv_")).toBe(true);
    expect(created.scopes).toContain("usage:write");

    const listed = await caller.console.apiKeys.list();
    expect(listed.some((entry) => entry.id === created.id)).toBe(true);
  });

  integrationIt("revoke removes a key from the workspace roster", async () => {
    const seed = await seedOrgWithOwner();
    await seedApiKeyFeature(seed);
    const key = await seedApiKey({
      createdBy: seed.userId,
      organizationId: seed.organizationId
    });
    const caller = await createCallerFor({ seed });

    const revoked = await caller.console.apiKeys.revoke({ id: key.id });

    expect(revoked).toEqual({ ok: true });
    const listed = await caller.console.apiKeys.list();
    const entry = listed.find((row) => row.id === key.id);
    expect(entry?.revokedAt).toBeTruthy();
  });

  integrationIt("revoke returns API_KEY_NOT_FOUND for unknown ids", async () => {
    const seed = await seedOrgWithOwner();
    await seedApiKeyFeature(seed);
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.apiKeys.revoke({ id: "missing-key-id" }),
      "API_KEY_NOT_FOUND"
    );
  });

  integrationIt("create rejects members without api key access (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner({ role: "member" });
    await seedApiKeyFeature(seed);
    const caller = await createCallerFor({ seed, role: "member" });

    await expectOrpcError(() => caller.console.apiKeys.create({ name: "Denied key" }), "FORBIDDEN");
  });
});
