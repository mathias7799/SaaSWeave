/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { eq } from "drizzle-orm";
import { describe, expect } from "vite-plus/test";

import { db } from "@saasweave/db";
import { dataExportRequest } from "@saasweave/db/schema";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

describe.sequential("console.dataExport", () => {
  integrationIt("member cannot request a data export (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner({ role: "member" });
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { data_export: true });
    const caller = await createCallerFor({ seed, role: "member" });

    await expectOrpcError(() => caller.console.dataExport.request(), "FORBIDDEN");
  });

  integrationIt("owner can request a data export (creates a row)", async () => {
    const seed = await seedOrgWithOwner({ role: "owner" });
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { data_export: true });
    const caller = await createCallerFor({ seed });

    const created = await caller.console.dataExport.request();

    expect(created.status).toBe("pending");
    expect(created.id).toBeTruthy();

    const rows = await db
      .select()
      .from(dataExportRequest)
      .where(eq(dataExportRequest.organizationId, seed.organizationId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.requestedByUserId).toBe(seed.userId);
    expect(rows[0]?.status).toBe("pending");
  });

  integrationIt("list and get return the pending export request", async () => {
    const seed = await seedOrgWithOwner({ role: "owner" });
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { data_export: true });
    const caller = await createCallerFor({ seed });

    const created = await caller.console.dataExport.request();
    const listed = await caller.console.dataExport.list();
    expect(listed.some((entry) => entry.id === created.id)).toBe(true);

    const fetched = await caller.console.dataExport.get({ id: created.id });
    expect(fetched.status).toBe("pending");
    expect(fetched.canDownload).toBe(false);
  });

  integrationIt("get returns EXPORT_NOT_FOUND for unknown ids", async () => {
    const seed = await seedOrgWithOwner({ role: "owner" });
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { data_export: true });
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.dataExport.get({ id: "missing-export-id" }),
      "EXPORT_NOT_FOUND"
    );
  });
});
