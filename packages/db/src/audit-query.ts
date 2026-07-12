import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";

import {
  AUDIT_EXPORT_CSV_COLUMNS,
  AUDIT_EXPORT_MAX_ROWS,
  type AuditExportFormat
} from "@saasweave/core/audit";

import { type AuditEntry } from "#@/audit";
import { db } from "#@/connection";
import { auditLog } from "#@/schema/index";

export type AuditQueryInput = {
  organizationId: string;
  since?: Date;
  until?: Date;
  action?: string;
  cursor?: string;
  limit?: number;
};

export type AuditQueryResult = {
  entries: AuditEntry[];
  nextCursor: string | null;
};

function mapRow(row: typeof auditLog.$inferSelect): AuditEntry {
  return {
    action: row.action,
    actorName: row.actorName,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    targetLabel: row.targetLabel,
    targetType: row.targetType
  };
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt: string;
      id: string;
    };
    if (!parsed.id || !parsed.createdAt) return null;
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(entry: AuditEntry): string {
  return Buffer.from(JSON.stringify({ createdAt: entry.createdAt, id: entry.id }), "utf8").toString(
    "base64url"
  );
}

export async function queryOrganizationAudit(input: AuditQueryInput): Promise<AuditQueryResult> {
  const limit = Math.min(input.limit ?? 100, AUDIT_EXPORT_MAX_ROWS);
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;

  const conditions = [eq(auditLog.organizationId, input.organizationId)];
  if (input.since) conditions.push(gte(auditLog.createdAt, input.since));
  if (input.until) conditions.push(lte(auditLog.createdAt, input.until));
  if (input.action) conditions.push(eq(auditLog.action, input.action));
  if (cursor) {
    conditions.push(
      or(
        lt(auditLog.createdAt, cursor.createdAt),
        and(eq(auditLog.createdAt, cursor.createdAt), lt(auditLog.id, cursor.id))
      )!
    );
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const entries = slice.map(mapRow);

  return {
    entries,
    nextCursor: hasMore && entries.length > 0 ? encodeCursor(entries.at(-1)!) : null
  };
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function formatAuditExport(
  entries: AuditEntry[],
  format: AuditExportFormat
): { content: string; contentType: string; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return {
      content: JSON.stringify(entries, null, 2),
      contentType: "application/json",
      filename: `audit-log-${stamp}.json`
    };
  }

  const header = AUDIT_EXPORT_CSV_COLUMNS.join(",");
  const lines = entries.map((entry) =>
    AUDIT_EXPORT_CSV_COLUMNS.map((column) => {
      const raw = entry[column];
      return csvEscape(raw == null ? "" : String(raw));
    }).join(",")
  );

  return {
    content: [header, ...lines].join("\n"),
    contentType: "text/csv",
    filename: `audit-log-${stamp}.csv`
  };
}

export async function exportOrganizationAudit(input: {
  organizationId: string;
  format: AuditExportFormat;
  since?: Date;
  until?: Date;
}): Promise<{ content: string; contentType: string; filename: string; rowCount: number }> {
  const { entries } = await queryOrganizationAudit({
    ...input,
    limit: AUDIT_EXPORT_MAX_ROWS
  });
  const formatted = formatAuditExport(entries, input.format);
  return { ...formatted, rowCount: entries.length };
}
