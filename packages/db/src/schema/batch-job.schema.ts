import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { type BatchJobType } from "@saasweave/core/batch-jobs/types";

import { organization, user } from "#@/schema/auth.schema";

export const BATCH_JOB_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "canceled"
] as const;

export type BatchJobStatus = (typeof BATCH_JOB_STATUSES)[number];

export const BATCH_JOB_ITEM_STATUSES = ["pending", "processing", "completed", "failed"] as const;

export type BatchJobItemStatus = (typeof BATCH_JOB_ITEM_STATUSES)[number];

/** Async batch job for workspace-scoped bulk processing. */
export const batchJob = pgTable(
  "batch_job",
  {
    completedItems: integer("completed_items").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    error: text("error"),
    failedItems: integer("failed_items").notNull().default(0),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status").$type<BatchJobStatus>().notNull().default("pending"),
    totalItems: integer("total_items").notNull(),
    type: text("type").$type<BatchJobType>().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (table) => [
    index("batch_job_org_created_idx").on(table.organizationId, table.createdAt),
    index("batch_job_org_status_idx").on(table.organizationId, table.status),
    index("batch_job_status_updated_idx").on(table.status, table.updatedAt),
    check(
      "batch_job_status_check",
      sql`${table.status} IN ('pending', 'processing', 'completed', 'failed', 'canceled')`
    ),
    check("batch_job_type_check", sql`${table.type} IN ('uppercase')`)
  ]
);

/** Individual item within a batch job. */
export const batchJobItem = pgTable(
  "batch_job_item",
  {
    attempts: integer("attempts").notNull().default(0),
    batchJobId: text("batch_job_id")
      .notNull()
      .references(() => batchJob.id, { onDelete: "cascade" }),
    claimedAt: timestamp("claimed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    error: text("error"),
    id: text("id").primaryKey(),
    input: jsonb("input").$type<unknown>().notNull(),
    leaseExpiresAt: timestamp("lease_expires_at"),
    output: jsonb("output").$type<unknown>(),
    status: text("status").$type<BatchJobItemStatus>().notNull().default("pending"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    workerId: text("worker_id")
  },
  (table) => [
    index("batch_job_item_job_status_idx").on(table.batchJobId, table.status),
    index("batch_job_item_job_created_idx").on(table.batchJobId, table.createdAt),
    index("batch_job_item_claimable_idx").on(
      table.batchJobId,
      table.status,
      table.leaseExpiresAt,
      table.createdAt
    ),
    check(
      "batch_job_item_status_check",
      sql`${table.status} IN ('pending', 'processing', 'completed', 'failed')`
    )
  ]
);
