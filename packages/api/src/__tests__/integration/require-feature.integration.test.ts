/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper, which the jest lint plugin cannot trace */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

describe.sequential("requireFeature auth matrix", () => {
  integrationIt(
    "console.aiUsage is blocked when ai_assistant is disabled (FORBIDDEN)",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedOrganizationFeatureFlags(seed.organizationId, { ai_assistant: false });
      const caller = await createCallerFor({ seed });

      await expectOrpcError(() => caller.console.aiUsage(), "FORBIDDEN");
    }
  );

  integrationIt("console.aiUsage succeeds when ai_assistant is enabled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationFeatureFlags(seed.organizationId, { ai_assistant: true });
    const caller = await createCallerFor({ seed });

    const usage = await caller.console.aiUsage();

    expect(usage.totals).toBeDefined();
  });

  integrationIt(
    "console.ipAllowlist.list is blocked when ip_allowlist is disabled (FORBIDDEN)",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedOrganizationPlan(seed.organizationId);
      await seedOrganizationFeatureFlags(seed.organizationId, { ip_allowlist: false });
      const caller = await createCallerFor({ seed });

      await expectOrpcError(() => caller.console.ipAllowlist.list(), "FORBIDDEN");
    }
  );

  integrationIt("console.ipAllowlist.list succeeds when ip_allowlist is enabled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { ip_allowlist: true });
    const caller = await createCallerFor({ seed });

    const rules = await caller.console.ipAllowlist.list();

    expect(rules).toEqual([]);
  });

  integrationIt(
    "console.auditExport.export is blocked when audit_export is disabled (FORBIDDEN)",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedOrganizationPlan(seed.organizationId);
      await seedOrganizationFeatureFlags(seed.organizationId, {
        audit_export: false,
        audit_logs: true
      });
      const caller = await createCallerFor({ seed });

      await expectOrpcError(
        () => caller.console.auditExport.export({ format: "json" }),
        "FORBIDDEN"
      );
    }
  );

  integrationIt("console.auditExport.export succeeds when audit_export is enabled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, {
      audit_export: true,
      audit_logs: true
    });
    const caller = await createCallerFor({ seed });

    const exported = await caller.console.auditExport.export({ format: "json" });

    expect(exported.rowCount).toBe(0);
    expect(exported.contentType).toContain("json");
  });

  integrationIt("console.sso.delete is blocked when sso is disabled (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { sso: false });
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.sso.delete({ providerId: "missing-provider" }),
      "FORBIDDEN"
    );
  });

  integrationIt("console.sso.delete passes requireFeature when sso is enabled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { sso: true });
    const caller = await createCallerFor({ seed });

    await expect(
      caller.console.sso.delete({ providerId: "missing-provider" })
    ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
  });
});
