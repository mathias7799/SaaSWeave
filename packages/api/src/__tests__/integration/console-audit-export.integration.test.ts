/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import { recordAudit } from "@saasweave/db";

import {
  createCallerFor,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

describe.sequential("console audit export formats", () => {
  integrationIt("exports audit rows as CSV when audit_export is enabled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId, "scale");
    await seedOrganizationFeatureFlags(seed.organizationId, {
      audit_export: true,
      audit_logs: true
    });
    await recordAudit({
      action: "api_key.created",
      actorId: seed.userId,
      actorName: seed.name,
      organizationId: seed.organizationId,
      targetLabel: "key",
      targetType: "api_key"
    });
    const caller = await createCallerFor({ seed });

    const exported = await caller.console.auditExport.export({ format: "csv" });

    expect(exported.contentType).toContain("csv");
    expect(exported.rowCount).toBeGreaterThanOrEqual(1);
    expect(exported.content).toContain("api_key.created");
  });
});
