import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vite-plus/test";

import { BATCH_JOB_CHUNK_SIZE } from "@saasweave/core/batch-jobs/constants";
import { claimBatchJobItems, createBatchJobWithItems } from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("batch chunk claims", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("claims items with SKIP LOCKED without loading the full job", async () => {
    const seed = await seedOrgWithOwner();
    const items = Array.from({ length: BATCH_JOB_CHUNK_SIZE + 5 }, (_, index) => {
      return {
        text: `item-${index}`
      };
    });
    const job = await createBatchJobWithItems({
      createdByUserId: seed.userId,
      items,
      organizationId: seed.organizationId,
      type: "uppercase"
    });

    const firstChunk = await claimBatchJobItems({
      batchJobId: job.id,
      chunkSize: BATCH_JOB_CHUNK_SIZE,
      leaseSeconds: 120,
      workerId: randomUUID()
    });
    const secondChunk = await claimBatchJobItems({
      batchJobId: job.id,
      chunkSize: BATCH_JOB_CHUNK_SIZE,
      leaseSeconds: 120,
      workerId: randomUUID()
    });

    expect(firstChunk).toHaveLength(BATCH_JOB_CHUNK_SIZE);
    expect(secondChunk.length).toBeGreaterThan(0);
    expect(firstChunk.every((item) => item.status === "processing")).toBe(true);
  });
});
