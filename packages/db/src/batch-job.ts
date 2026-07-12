import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { type BatchJobType } from "@saasweave/core/batch-jobs/types";

import { db } from "#@/connection";
import {
  batchJob,
  batchJobItem,
  type BatchJobItemStatus,
  type BatchJobStatus
} from "#@/schema/batch-job.schema";

export type BatchJobRow = {
  completedItems: number;
  createdAt: string;
  createdByUserId: string;
  error: string | null;
  failedItems: number;
  id: string;
  organizationId: string;
  status: BatchJobStatus;
  totalItems: number;
  type: BatchJobType;
  updatedAt: string;
};

export type BatchJobItemRow = {
  attempts: number;
  batchJobId: string;
  claimedAt: string | null;
  createdAt: string;
  error: string | null;
  id: string;
  input: unknown;
  leaseExpiresAt: string | null;
  output: unknown;
  status: BatchJobItemStatus;
  updatedAt: string;
  workerId: string | null;
};

export type BatchJobWithItems = BatchJobRow & {
  items: BatchJobItemRow[];
};

function mapJobRow(row: typeof batchJob.$inferSelect): BatchJobRow {
  return {
    completedItems: row.completedItems,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    error: row.error,
    failedItems: row.failedItems,
    id: row.id,
    organizationId: row.organizationId,
    status: row.status,
    totalItems: row.totalItems,
    type: row.type,
    updatedAt: row.updatedAt.toISOString()
  };
}

function coerceIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toISOString();
  }
  throw new TypeError("Expected a date-like value");
}

function coerceOptionalIsoDate(value: unknown): string | null {
  return value == null ? null : coerceIsoDate(value);
}

function coerceText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function mapRawClaimedItemRow(row: Record<string, unknown>): BatchJobItemRow {
  const batchJobId = row.batchJobId ?? row.batch_job_id;
  const claimedAt = row.claimedAt ?? row.claimed_at;
  const createdAt = row.createdAt ?? row.created_at;
  const leaseExpiresAt = row.leaseExpiresAt ?? row.lease_expires_at;
  const updatedAt = row.updatedAt ?? row.updated_at;
  const workerId = row.workerId ?? row.worker_id;

  return {
    attempts: Number(row.attempts ?? 0),
    batchJobId: coerceText(batchJobId),
    claimedAt: coerceOptionalIsoDate(claimedAt),
    createdAt: coerceIsoDate(createdAt),
    error: row.error == null ? null : coerceText(row.error),
    id: coerceText(row.id),
    input: row.input,
    leaseExpiresAt: coerceOptionalIsoDate(leaseExpiresAt),
    output: row.output ?? null,
    status: coerceText(row.status) as BatchJobItemStatus,
    updatedAt: coerceIsoDate(updatedAt),
    workerId: workerId == null ? null : coerceText(workerId)
  };
}

function mapItemRow(row: typeof batchJobItem.$inferSelect): BatchJobItemRow {
  return mapRawClaimedItemRow(row as unknown as Record<string, unknown>);
}

export async function createBatchJobWithItems(input: {
  createdByUserId: string;
  items: unknown[];
  organizationId: string;
  type: BatchJobType;
}): Promise<BatchJobWithItems> {
  const jobId = randomUUID();
  const now = new Date();
  const itemRows = input.items.map((itemInput) => {
    return {
      batchJobId: jobId,
      createdAt: now,
      id: randomUUID(),
      input: itemInput,
      status: "pending" as const,
      updatedAt: now
    };
  });

  await db.transaction(async (tx) => {
    await tx.insert(batchJob).values({
      createdAt: now,
      createdByUserId: input.createdByUserId,
      id: jobId,
      organizationId: input.organizationId,
      status: "pending",
      totalItems: itemRows.length,
      type: input.type,
      updatedAt: now
    });
    if (itemRows.length > 0) {
      await tx.insert(batchJobItem).values(itemRows);
    }
  });

  const job = await getBatchJobWithItems(input.organizationId, jobId);
  if (!job) {
    throw new Error("Failed to create batch job");
  }
  return job;
}

export async function listBatchJobs(organizationId: string, limit = 20): Promise<BatchJobRow[]> {
  const rows = await db
    .select()
    .from(batchJob)
    .where(eq(batchJob.organizationId, organizationId))
    .orderBy(desc(batchJob.createdAt))
    .limit(limit);

  return rows.map(mapJobRow);
}

export async function getBatchJob(organizationId: string, id: string): Promise<BatchJobRow | null> {
  const [row] = await db
    .select()
    .from(batchJob)
    .where(and(eq(batchJob.id, id), eq(batchJob.organizationId, organizationId)))
    .limit(1);

  return row ? mapJobRow(row) : null;
}

export async function getBatchJobById(id: string): Promise<BatchJobRow | null> {
  const [row] = await db.select().from(batchJob).where(eq(batchJob.id, id)).limit(1);
  return row ? mapJobRow(row) : null;
}

export async function getBatchJobWithItems(
  organizationId: string,
  id: string
): Promise<BatchJobWithItems | null> {
  const job = await getBatchJob(organizationId, id);
  if (!job) return null;

  const items = await listBatchJobItems(id);
  return { ...job, items };
}

export async function getBatchJobWithItemsById(id: string): Promise<BatchJobWithItems | null> {
  const job = await getBatchJobById(id);
  if (!job) return null;

  const items = await listBatchJobItems(id);
  return { ...job, items };
}

export async function listBatchJobItems(batchJobId: string): Promise<BatchJobItemRow[]> {
  const rows = await db
    .select()
    .from(batchJobItem)
    .where(eq(batchJobItem.batchJobId, batchJobId))
    .orderBy(asc(batchJobItem.createdAt));

  return rows.map(mapItemRow);
}

export async function claimBatchJobItems(input: {
  batchJobId: string;
  chunkSize: number;
  leaseSeconds: number;
  workerId: string;
}): Promise<BatchJobItemRow[]> {
  const leaseUntil = new Date(Date.now() + input.leaseSeconds * 1_000);
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntilIso = leaseUntil.toISOString();

  const rows = await db.execute(sql`
    UPDATE batch_job_item
    SET
      status = 'processing',
      claimed_at = ${nowIso}::timestamp,
      lease_expires_at = ${leaseUntilIso}::timestamp,
      worker_id = ${input.workerId},
      updated_at = ${nowIso}::timestamp
    WHERE id IN (
      SELECT id
      FROM batch_job_item
      WHERE batch_job_id = ${input.batchJobId}
        AND (
          status = 'pending'
          OR (
            status = 'processing'
            AND lease_expires_at IS NOT NULL
            AND lease_expires_at < ${nowIso}::timestamp
          )
        )
      ORDER BY created_at ASC
      LIMIT ${input.chunkSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map(mapRawClaimedItemRow);
}

export async function releaseExpiredBatchJobLeases(batchJobId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const rows = await db
    .update(batchJobItem)
    .set({
      claimedAt: null,
      leaseExpiresAt: null,
      status: "pending",
      updatedAt: new Date(nowIso),
      workerId: null
    })
    .where(
      and(
        eq(batchJobItem.batchJobId, batchJobId),
        eq(batchJobItem.status, "processing"),
        sql`${batchJobItem.leaseExpiresAt} IS NOT NULL AND ${batchJobItem.leaseExpiresAt} < ${nowIso}::timestamp`
      )
    )
    .returning({ id: batchJobItem.id });

  return rows.length;
}

export async function updateBatchJobStatus(
  id: string,
  input: {
    error?: string | null;
    status: BatchJobStatus;
  }
): Promise<BatchJobRow | null> {
  const [row] = await db
    .update(batchJob)
    .set({
      error: input.error === undefined ? undefined : input.error,
      status: input.status,
      updatedAt: new Date()
    })
    .where(eq(batchJob.id, id))
    .returning();

  return row ? mapJobRow(row) : null;
}

export async function updateBatchJobItemStatus(
  id: string,
  input: {
    attempts?: number;
    error?: string | null;
    output?: unknown;
    status: BatchJobItemStatus;
    claimedAt?: Date | null;
    leaseExpiresAt?: Date | null;
    workerId?: string | null;
  }
): Promise<BatchJobItemRow | null> {
  const [row] = await db
    .update(batchJobItem)
    .set({
      ...(input.attempts === undefined ? {} : { attempts: input.attempts }),
      ...(input.error === undefined ? {} : { error: input.error }),
      ...(input.output === undefined ? {} : { output: input.output }),
      ...(input.claimedAt === undefined ? {} : { claimedAt: input.claimedAt }),
      ...(input.leaseExpiresAt === undefined ? {} : { leaseExpiresAt: input.leaseExpiresAt }),
      ...(input.workerId === undefined ? {} : { workerId: input.workerId }),
      status: input.status,
      updatedAt: new Date()
    })
    .where(eq(batchJobItem.id, id))
    .returning();

  return row ? mapItemRow(row) : null;
}

export async function incrementBatchJobProgress(
  id: string,
  input: { completed?: number; failed?: number }
): Promise<BatchJobRow | null> {
  const [row] = await db
    .update(batchJob)
    .set({
      completedItems:
        input.completed === undefined
          ? undefined
          : sql`${batchJob.completedItems} + ${input.completed}`,
      failedItems:
        input.failed === undefined ? undefined : sql`${batchJob.failedItems} + ${input.failed}`,
      updatedAt: new Date()
    })
    .where(eq(batchJob.id, id))
    .returning();

  return row ? mapJobRow(row) : null;
}

export async function cancelBatchJob(
  organizationId: string,
  id: string
): Promise<BatchJobRow | null> {
  const [row] = await db
    .update(batchJob)
    .set({
      status: "canceled",
      updatedAt: new Date()
    })
    .where(
      and(
        eq(batchJob.id, id),
        eq(batchJob.organizationId, organizationId),
        sql`${batchJob.status} IN ('pending', 'processing')`
      )
    )
    .returning();

  return row ? mapJobRow(row) : null;
}

export async function isBatchJobCanceled(batchJobId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: batchJob.status })
    .from(batchJob)
    .where(eq(batchJob.id, batchJobId))
    .limit(1);

  return row?.status === "canceled";
}
