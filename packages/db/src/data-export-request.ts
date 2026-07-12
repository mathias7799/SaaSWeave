import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "#@/connection";
import {
  dataExportRequest,
  type DataExportCheckpoint,
  type DataExportStatus
} from "#@/schema/data-export-request.schema";

export type DataExportRequestRow = {
  bytesWritten: number;
  canceledAt: string | null;
  checkpoint: DataExportCheckpoint | null;
  completedAt: string | null;
  createdAt: string;
  downloadRevokedAt: string | null;
  error: string | null;
  expiresAt: string | null;
  fileKey: string | null;
  format: string;
  id: string;
  organizationId: string;
  requestedByUserId: string;
  rowsWritten: number;
  status: DataExportStatus;
};

function mapRow(row: typeof dataExportRequest.$inferSelect): DataExportRequestRow {
  return {
    bytesWritten: row.bytesWritten,
    canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
    checkpoint: row.checkpoint ?? null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    downloadRevokedAt: row.downloadRevokedAt ? row.downloadRevokedAt.toISOString() : null,
    error: row.error,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    fileKey: row.fileKey,
    format: row.format,
    id: row.id,
    organizationId: row.organizationId,
    requestedByUserId: row.requestedByUserId,
    rowsWritten: row.rowsWritten,
    status: row.status
  };
}

export async function createDataExportRequest(input: {
  organizationId: string;
  requestedByUserId: string;
}): Promise<DataExportRequestRow> {
  const id = randomUUID();
  const now = new Date();
  const [row] = await db
    .insert(dataExportRequest)
    .values({
      createdAt: now,
      id,
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      status: "pending"
    })
    .returning();

  return mapRow(row!);
}

export async function getDataExportRequest(
  organizationId: string,
  id: string
): Promise<DataExportRequestRow | null> {
  const [row] = await db
    .select()
    .from(dataExportRequest)
    .where(and(eq(dataExportRequest.id, id), eq(dataExportRequest.organizationId, organizationId)))
    .limit(1);

  return row ? mapRow(row) : null;
}

export async function getDataExportRequestById(id: string): Promise<DataExportRequestRow | null> {
  const [row] = await db
    .select()
    .from(dataExportRequest)
    .where(eq(dataExportRequest.id, id))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function listDataExportRequests(
  organizationId: string,
  limit = 20
): Promise<DataExportRequestRow[]> {
  const rows = await db
    .select()
    .from(dataExportRequest)
    .where(eq(dataExportRequest.organizationId, organizationId))
    .orderBy(desc(dataExportRequest.createdAt))
    .limit(limit);

  return rows.map(mapRow);
}

export async function updateDataExportRequestStatus(
  id: string,
  input: {
    status: DataExportStatus;
    bytesWritten?: number;
    canceledAt?: Date | null;
    checkpoint?: DataExportCheckpoint | null;
    downloadRevokedAt?: Date | null;
    expiresAt?: Date | null;
    fileKey?: string | null;
    error?: string | null;
    completedAt?: Date | null;
    rowsWritten?: number;
  }
): Promise<DataExportRequestRow | null> {
  const [row] = await db
    .update(dataExportRequest)
    .set({
      ...(input.bytesWritten === undefined ? {} : { bytesWritten: input.bytesWritten }),
      ...(input.canceledAt === undefined ? {} : { canceledAt: input.canceledAt }),
      ...(input.checkpoint === undefined ? {} : { checkpoint: input.checkpoint }),
      ...(input.completedAt === undefined ? {} : { completedAt: input.completedAt }),
      ...(input.downloadRevokedAt === undefined
        ? {}
        : { downloadRevokedAt: input.downloadRevokedAt }),
      ...(input.error === undefined ? {} : { error: input.error }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
      ...(input.fileKey === undefined ? {} : { fileKey: input.fileKey }),
      ...(input.rowsWritten === undefined ? {} : { rowsWritten: input.rowsWritten }),
      status: input.status
    })
    .where(eq(dataExportRequest.id, id))
    .returning();

  return row ? mapRow(row) : null;
}

export async function cancelDataExportRequest(
  organizationId: string,
  id: string
): Promise<DataExportRequestRow | null> {
  const [row] = await db
    .update(dataExportRequest)
    .set({
      canceledAt: new Date(),
      status: "canceled"
    })
    .where(
      and(
        eq(dataExportRequest.id, id),
        eq(dataExportRequest.organizationId, organizationId),
        eq(dataExportRequest.status, "processing")
      )
    )
    .returning();

  return row ? mapRow(row) : null;
}

export async function isDataExportCanceled(id: string): Promise<boolean> {
  const [row] = await db
    .select({ canceledAt: dataExportRequest.canceledAt, status: dataExportRequest.status })
    .from(dataExportRequest)
    .where(eq(dataExportRequest.id, id))
    .limit(1);

  if (!row) return true;
  return row.status === "canceled" || row.canceledAt !== null;
}
