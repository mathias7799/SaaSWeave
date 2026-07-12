/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper, which the jest lint plugin cannot trace */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedApiKey,
  seedOrgWithOwner,
  seedUsageIntegration
} from "./harness";

const usagePayload = { metric: "api_calls" as const, quantity: 1 };

describe.sequential("API key auth matrix", () => {
  integrationIt(
    "console.recordUsage rejects callers without session or API key (UNAUTHORIZED)",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedUsageIntegration(seed);
      const caller = await createCallerFor({ seed, session: null });

      await expectOrpcError(() => caller.console.recordUsage(usagePayload), "UNAUTHORIZED");
    }
  );

  integrationIt("console.recordUsage accepts a key with usage:write scope", async () => {
    const seed = await seedOrgWithOwner();
    await seedUsageIntegration(seed);
    const key = await seedApiKey({
      createdBy: seed.userId,
      organizationId: seed.organizationId,
      scopes: ["usage:write"]
    });
    const caller = await createCallerFor({ apiKeySecret: key.secret, seed, session: null });

    const result = await caller.console.recordUsage(usagePayload);

    expect(result).toEqual({ ok: true });
  });

  integrationIt(
    "console.recordUsage rejects a read_only key missing usage:write (FORBIDDEN)",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedUsageIntegration(seed);
      const key = await seedApiKey({
        createdBy: seed.userId,
        organizationId: seed.organizationId,
        scopes: ["usage:read", "audit:read"]
      });
      const caller = await createCallerFor({ apiKeySecret: key.secret, seed, session: null });

      await expectOrpcError(() => caller.console.recordUsage(usagePayload), "FORBIDDEN");
    }
  );

  integrationIt("console.recordUsage rejects a revoked API key (UNAUTHORIZED)", async () => {
    const seed = await seedOrgWithOwner();
    await seedUsageIntegration(seed);
    const key = await seedApiKey({
      createdBy: seed.userId,
      organizationId: seed.organizationId,
      scopes: ["usage:write"]
    });
    const sessionCaller = await createCallerFor({ seed });
    await sessionCaller.console.apiKeys.revoke({ id: key.id });

    const caller = await createCallerFor({ apiKeySecret: key.secret, seed, session: null });

    await expectOrpcError(() => caller.console.recordUsage(usagePayload), "UNAUTHORIZED");
  });

  integrationIt("console.recordUsage treats legacy empty scopes as full access", async () => {
    const seed = await seedOrgWithOwner();
    await seedUsageIntegration(seed);
    const key = await seedApiKey({
      createdBy: seed.userId,
      organizationId: seed.organizationId,
      scopes: []
    });
    const caller = await createCallerFor({ apiKeySecret: key.secret, seed, session: null });

    const result = await caller.console.recordUsage(usagePayload);

    expect(result).toEqual({ ok: true });
  });
});
