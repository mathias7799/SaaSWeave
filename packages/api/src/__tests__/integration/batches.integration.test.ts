/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { eq } from "drizzle-orm";
import { describe, expect } from "vite-plus/test";

import { db } from "@saasweave/db";
import { batchJob, batchJobItem } from "@saasweave/db/schema";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

describe.sequential("console.batches", () => {
  integrationIt("create is blocked when batch_jobs is disabled (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { batch_jobs: false });
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () =>
        caller.console.batches.create({
          items: [{ text: "hello" }],
          type: "uppercase"
        }),
      "FORBIDDEN"
    );
  });

  integrationIt("owner can create a batch job with items", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { batch_jobs: true });
    const caller = await createCallerFor({ seed });

    const created = await caller.console.batches.create({
      items: [{ text: "hello" }, { text: "world" }],
      type: "uppercase"
    });

    expect(created.status).toBe("pending");
    expect(created.totalItems).toBe(2);
    expect(created.items).toHaveLength(2);

    const jobs = await db
      .select()
      .from(batchJob)
      .where(eq(batchJob.organizationId, seed.organizationId));

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.createdByUserId).toBe(seed.userId);
    expect(jobs[0]?.type).toBe("uppercase");

    const items = await db
      .select()
      .from(batchJobItem)
      .where(eq(batchJobItem.batchJobId, created.id));

    expect(items).toHaveLength(2);
  });

  integrationIt("cancel transitions a pending batch job to canceled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { batch_jobs: true });
    const caller = await createCallerFor({ seed });

    const created = await caller.console.batches.create({
      items: [{ text: "hold" }],
      type: "uppercase"
    });

    const canceled = await caller.console.batches.cancel({ id: created.id });

    expect(canceled.status).toBe("canceled");

    const [row] = await db.select().from(batchJob).where(eq(batchJob.id, created.id)).limit(1);

    expect(row?.status).toBe("canceled");
  });

  integrationIt("cancel returns BATCH_JOB_NOT_CANCELABLE for finished jobs", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { batch_jobs: true });
    const caller = await createCallerFor({ seed });

    const created = await caller.console.batches.create({
      items: [{ text: "done" }],
      type: "uppercase"
    });
    await caller.console.batches.cancel({ id: created.id });

    await expectOrpcError(
      () => caller.console.batches.cancel({ id: created.id }),
      "BATCH_JOB_NOT_CANCELABLE"
    );
  });
});
