export const AUDIT_EXPORT_FORMATS = ["csv", "json"] as const;
export type AuditExportFormat = (typeof AUDIT_EXPORT_FORMATS)[number];

export const AUDIT_EXPORT_MAX_ROWS = 10_000;

export const AUDIT_EXPORT_CSV_COLUMNS = [
  "id",
  "createdAt",
  "action",
  "actorName",
  "targetType",
  "targetLabel"
] as const;
