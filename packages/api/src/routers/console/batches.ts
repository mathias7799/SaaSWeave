import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  BATCH_JOB_TYPES,
  UPPERCASE_BATCH_ITEM_INPUT_SCHEMA,
  type BatchJobType
} from "@saasweave/core/batch-jobs/types";
import {
  cancelBatchJob,
  createBatchJobWithItems,
  db,
  getBatchJob,
  getBatchJobWithItems,
  listBatchJobs,
  type BatchJobItemRow,
  type BatchJobRow
} from "@saasweave/db";
import { apiKey } from "@saasweave/db/schema";

import { dispatchBatchJob } from "#@/lib/batch-jobs/dispatch";
import { isFeatureEnabledForOrg } from "#@/lib/features";
import { requireApiKeyScope, requireFeature } from "#@/lib/procedures/factory";

const batchesProcedure = requireFeature("batch_jobs");

const batchJobItemSchema = z.object({
  attempts: z.number().int(),
  createdAt: z.string().datetime(),
  error: z.string().nullable(),
  id: z.string(),
  input: z.unknown(),
  output: z.unknown().nullable(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  updatedAt: z.string().datetime()
});

const batchJobSchema = z.object({
  completedItems: z.number().int(),
  createdAt: z.string().datetime(),
  createdByUserId: z.string(),
  error: z.string().nullable(),
  failedItems: z.number().int(),
  id: z.string(),
  progressPercent: z.number().int().min(0).max(100),
  status: z.enum(["pending", "processing", "completed", "failed", "canceled"]),
  totalItems: z.number().int(),
  type: z.string(),
  updatedAt: z.string().datetime()
});

const batchJobWithItemsSchema = batchJobSchema.extend({
  items: z.array(batchJobItemSchema)
});

const uppercaseCreateInputSchema = z.object({
  items: z.array(UPPERCASE_BATCH_ITEM_INPUT_SCHEMA).min(1).max(100),
  type: z.literal("uppercase")
});

function progressPercent(job: BatchJobRow): number {
  if (job.totalItems <= 0) return 0;
  const done = job.completedItems + job.failedItems;
  return Math.min(100, Math.round((done / job.totalItems) * 100));
}

function shapeBatchJob(job: BatchJobRow) {
  return batchJobSchema.parse({
    ...job,
    progressPercent: progressPercent(job)
  });
}

function shapeBatchJobItem(item: BatchJobItemRow) {
  return batchJobItemSchema.parse(item);
}

function shapeBatchJobWithItems(job: BatchJobRow, items: BatchJobItemRow[]) {
  return batchJobWithItemsSchema.parse({
    ...shapeBatchJob(job),
    items: items.map(shapeBatchJobItem)
  });
}

function assertAllowedBatchJobType(type: string): asserts type is BatchJobType {
  if (!(BATCH_JOB_TYPES as readonly string[]).includes(type)) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Unsupported batch job type: ${type}`
    });
  }
}

const batchesCreateProcedure = requireApiKeyScope("usage:write").use(async ({ context, next }) => {
  const enabled = await isFeatureEnabledForOrg(context.organization.id, "batch_jobs");
  if (!enabled) {
    throw new ORPCError("FORBIDDEN", {
      message: 'Feature "batch_jobs" is not enabled for this workspace.'
    });
  }
  return next();
});

async function resolveCreatedByUserId(context: {
  apiKey?: { id: string };
  session?: { user: { id: string } } | null;
}): Promise<string> {
  if (context.session?.user) {
    return context.session.user.id;
  }
  if (context.apiKey) {
    const [row] = await db
      .select({ createdBy: apiKey.createdBy })
      .from(apiKey)
      .where(eq(apiKey.id, context.apiKey.id))
      .limit(1);
    if (row?.createdBy) {
      return row.createdBy;
    }
  }
  throw new ORPCError("UNAUTHORIZED");
}

export const batchesRouter = {
  create: batchesCreateProcedure
    .route({
      description: "Create a batch job with items (session or API key with usage:write)",
      method: "POST"
    })
    .input(uppercaseCreateInputSchema)
    .handler(async ({ context, input }) => {
      assertAllowedBatchJobType(input.type);

      const createdByUserId = await resolveCreatedByUserId(context);

      const created = await createBatchJobWithItems({
        createdByUserId,
        items: input.items,
        organizationId: context.organization.id,
        type: input.type
      });

      // Wait until BullMQ has accepted the job before returning. Fire-and-forget
      // dispatch can lose the enqueue when the request scope finishes first.
      await dispatchBatchJob(created.id);

      return shapeBatchJobWithItems(created, created.items);
    }),

  list: batchesProcedure
    .route({
      description: "List recent workspace batch jobs",
      method: "GET"
    })
    .handler(async ({ context }) => {
      const rows = await listBatchJobs(context.organization.id);
      return rows.map(shapeBatchJob);
    }),

  get: batchesProcedure
    .route({
      description: "Get a workspace batch job with items and progress",
      method: "GET"
    })
    .input(z.object({ id: z.string().min(1) }))
    .errors({
      BATCH_JOB_NOT_FOUND: { description: "No such batch job on this workspace", status: 404 }
    })
    .handler(async ({ context, errors, input }) => {
      const row = await getBatchJobWithItems(context.organization.id, input.id);
      if (!row) throw errors.BATCH_JOB_NOT_FOUND();
      return shapeBatchJobWithItems(row, row.items);
    }),

  cancel: batchesProcedure
    .route({
      description: "Cancel a pending or processing batch job",
      method: "POST"
    })
    .input(z.object({ id: z.string().min(1) }))
    .errors({
      BATCH_JOB_NOT_FOUND: { description: "No such batch job on this workspace", status: 404 },
      BATCH_JOB_NOT_CANCELABLE: {
        description: "Batch job is already finished or canceled",
        status: 409
      }
    })
    .handler(async ({ context, errors, input }) => {
      const existing = await getBatchJob(context.organization.id, input.id);
      if (!existing) throw errors.BATCH_JOB_NOT_FOUND();

      if (!["pending", "processing"].includes(existing.status)) {
        throw errors.BATCH_JOB_NOT_CANCELABLE();
      }

      const canceled = await cancelBatchJob(context.organization.id, input.id);
      if (!canceled) throw errors.BATCH_JOB_NOT_CANCELABLE();

      const row = await getBatchJobWithItems(context.organization.id, input.id);
      if (!row) throw errors.BATCH_JOB_NOT_FOUND();
      return shapeBatchJobWithItems(row, row.items);
    })
};
