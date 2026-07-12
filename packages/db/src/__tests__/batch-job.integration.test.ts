import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  cancelBatchJob,
  createBatchJobWithItems,
  getBatchJob,
  getBatchJobById,
  getBatchJobWithItems,
  getBatchJobWithItemsById,
  incrementBatchJobProgress,
  listBatchJobItems,
  listBatchJobs,
  updateBatchJobItemStatus,
  updateBatchJobStatus
} from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("batch-job", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates a batch job with items and retrieves it", async () => {
    const seed = await seedOrgWithOwner();

    const created = await createBatchJobWithItems({
      createdByUserId: seed.userId,
      items: [{ text: "alpha" }, { text: "beta" }],
      organizationId: seed.organizationId,
      type: "uppercase"
    });

    expect(created.status).toBe("pending");
    expect(created.totalItems).toBe(2);
    expect(created.items).toHaveLength(2);
    expect(created.items[0]?.status).toBe("pending");

    const listed = await listBatchJobs(seed.organizationId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);

    const byOrg = await getBatchJob(seed.organizationId, created.id);
    expect(byOrg?.type).toBe("uppercase");

    const byId = await getBatchJobById(created.id);
    expect(byId?.organizationId).toBe(seed.organizationId);

    const withItems = await getBatchJobWithItems(seed.organizationId, created.id);
    expect(withItems?.items).toHaveLength(2);

    const withItemsById = await getBatchJobWithItemsById(created.id);
    expect(withItemsById?.items).toHaveLength(2);

    const items = await listBatchJobItems(created.id);
    expect(items).toHaveLength(2);
  });

  it("updates job and item status plus progress counters", async () => {
    const seed = await seedOrgWithOwner();
    const created = await createBatchJobWithItems({
      createdByUserId: seed.userId,
      items: [{ text: "one" }],
      organizationId: seed.organizationId,
      type: "uppercase"
    });
    const itemId = created.items[0]?.id;
    expect(itemId).toBeDefined();

    const updatedJob = await updateBatchJobStatus(created.id, { status: "processing" });
    expect(updatedJob?.status).toBe("processing");

    const updatedItem = await updateBatchJobItemStatus(itemId!, {
      attempts: 1,
      output: { text: "ONE" },
      status: "completed"
    });
    expect(updatedItem?.status).toBe("completed");
    expect(updatedItem?.output).toEqual({ text: "ONE" });

    const progressed = await incrementBatchJobProgress(created.id, { completed: 1 });
    expect(progressed?.completedItems).toBe(1);

    const failed = await incrementBatchJobProgress(created.id, { failed: 1 });
    expect(failed?.failedItems).toBe(1);
  });

  it("cancels a pending batch job and returns null for foreign org", async () => {
    const seed = await seedOrgWithOwner();
    const other = await seedOrgWithOwner({ organizationName: "Other workspace" });
    const created = await createBatchJobWithItems({
      createdByUserId: seed.userId,
      items: [{ text: "hold" }],
      organizationId: seed.organizationId,
      type: "uppercase"
    });

    const canceled = await cancelBatchJob(seed.organizationId, created.id);
    expect(canceled?.status).toBe("canceled");

    const notCanceled = await cancelBatchJob(other.organizationId, created.id);
    expect(notCanceled).toBeNull();

    const missing = await getBatchJob(seed.organizationId, "missing-job-id");
    expect(missing).toBeNull();
  });
});
