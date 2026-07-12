import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  createDataExportRequest,
  getDataExportRequest,
  getDataExportRequestById,
  listDataExportRequests,
  updateDataExportRequestStatus
} from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("data-export-request", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates, lists, fetches, and updates export requests", async () => {
    const seed = await seedOrgWithOwner();

    const created = await createDataExportRequest({
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId
    });
    expect(created.status).toBe("pending");
    expect(created.organizationId).toBe(seed.organizationId);

    const listed = await listDataExportRequests(seed.organizationId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);

    const byOrg = await getDataExportRequest(seed.organizationId, created.id);
    expect(byOrg?.requestedByUserId).toBe(seed.userId);

    const byId = await getDataExportRequestById(created.id);
    expect(byId?.id).toBe(created.id);

    const completedAt = new Date();
    const updated = await updateDataExportRequestStatus(created.id, {
      completedAt,
      fileKey: "exports/workspace.zip",
      status: "ready"
    });
    expect(updated?.status).toBe("ready");
    expect(updated?.fileKey).toBe("exports/workspace.zip");
    expect(updated?.completedAt).toBe(completedAt.toISOString());

    const failed = await updateDataExportRequestStatus(created.id, {
      error: "storage unavailable",
      status: "failed"
    });
    expect(failed?.error).toBe("storage unavailable");

    const missing = await getDataExportRequest(seed.organizationId, "missing-export");
    expect(missing).toBeNull();
  });
});
