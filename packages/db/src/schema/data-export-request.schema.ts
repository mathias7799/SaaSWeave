import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { type DataExportFormat } from "@saasweave/core/data-export";

import { organization, user } from "#@/schema/auth.schema";

export const DATA_EXPORT_STATUSES = [
  "pending",
  "processing",
  "ready",
  "failed",
  "canceled"
] as const;

export type DataExportStatus = (typeof DATA_EXPORT_STATUSES)[number];

export type DataExportCheckpoint = {
  bytesWritten: number;
  completedTables: string[];
  currentTable: string | null;
  cursor: { createdAt: string; id: string } | null;
  rowsWritten: number;
};

/** Async GDPR-style workspace data export request. */
export const dataExportRequest = pgTable(
  "data_export_request",
  {
    bytesWritten: integer("bytes_written").notNull().default(0),
    canceledAt: timestamp("canceled_at"),
    checkpoint: jsonb("checkpoint").$type<DataExportCheckpoint>(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    downloadRevokedAt: timestamp("download_revoked_at"),
    error: text("error"),
    expiresAt: timestamp("expires_at"),
    fileKey: text("file_key"),
    format: text("format").$type<DataExportFormat>().notNull().default("ndjson"),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rowsWritten: integer("rows_written").notNull().default(0),
    status: text("status").$type<DataExportStatus>().notNull().default("pending")
  },
  (table) => [
    index("data_export_request_org_created_idx").on(table.organizationId, table.createdAt),
    index("data_export_request_org_status_idx").on(table.organizationId, table.status),
    index("data_export_request_expires_at_idx").on(table.expiresAt),
    check(
      "data_export_request_status_check",
      sql`${table.status} IN ('pending', 'processing', 'ready', 'failed', 'canceled')`
    ),
    check("data_export_request_format_check", sql`${table.format} IN ('ndjson')`)
  ]
);
