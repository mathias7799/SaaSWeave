/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { eq } from "drizzle-orm";
import { describe, expect } from "vite-plus/test";

import { processBatchJob } from "@saasweave/app/batch-jobs/process";
import { createBatchJobWithItems, db, getBatchJobById } from "@saasweave/db";
import { batchJobItem } from "@saasweave/db/schema";

import { integrationIt, seedOrgWithOwner } from "./harness";

describe.sequential("batch multi-worker correctness", () => {
  integrationIt("two workers complete all items exactly once", async () => {
    const seed = await seedOrgWithOwner();
    const items = Array.from({ length: 24 }, (_, index) => {
      return { text: `parallel-${index}` };
    });
    const job = await createBatchJobWithItems({
      createdByUserId: seed.userId,
      items,
      organizationId: seed.organizationId,
      type: "uppercase"
    });

    await Promise.all([processBatchJob(job.id), processBatchJob(job.id)]);

    const finalJob = await getBatchJobById(job.id);
    const rows = await db.select().from(batchJobItem).where(eq(batchJobItem.batchJobId, job.id));

    expect(finalJob?.status).toBe("completed");
    expect(finalJob?.completedItems).toBe(items.length);
    expect(rows.filter((row) => row.status === "completed")).toHaveLength(items.length);
  });
});
