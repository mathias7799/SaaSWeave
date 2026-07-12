import { DATA_EXPORT_FILE_RETENTION_DAYS } from "@saasweave/core/data-export/constants";

export function buildDataExportObjectKey(organizationId: string, requestId: string): string {
  return `exports/${organizationId}/${requestId}.json`;
}

export function computeDataExportExpiresAt(from = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + DATA_EXPORT_FILE_RETENTION_DAYS);
  return expiresAt;
}
