import { and, inArray, isNotNull, isNull, lt, notInArray, notLike, or } from "drizzle-orm";

import {
  RETENTION_DAYS,
  RETENTION_PURGE_CHUNK_SIZE,
  RETENTION_SECURITY_AUDIT_ACTION_PREFIXES,
  type RetentionClass
} from "@saasweave/core/retention";

import { db } from "#@/connection";
import { auditLog } from "#@/schema/audit.schema";
import { batchJob, batchJobItem } from "#@/schema/batch-job.schema";
import { dataExportRequest } from "#@/schema/data-export-request.schema";
import { emailDelivery } from "#@/schema/email.schema";
import { mrrSnapshot } from "#@/schema/mrr-snapshot.schema";
import { notification } from "#@/schema/notification.schema";
import { processedEvent } from "#@/schema/processed-event.schema";
import { usageEvent } from "#@/schema/usage.schema";
import { webhookDelivery } from "#@/schema/webhook.schema";

export type RetentionPurgeOptions = {
  chunkSize?: number;
  deleteDataExportObject?: (fileKey: string) => Promise<void>;
  dryRun?: boolean;
  legalHoldOrgIds?: readonly string[];
  retentionDays?: Partial<Record<RetentionClass, number>>;
};

export type RetentionPurgeClassResult = {
  class: RetentionClass | "batch_job_item" | "data_export_request";
  deleted: number;
  dryRun: boolean;
};

export type RetentionPurgeSummary = {
  classes: RetentionPurgeClassResult[];
  dryRun: boolean;
  totalDeleted: number;
};

function cutoffDate(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function resolveDays(
  retentionClass: RetentionClass,
  overrides?: Partial<Record<RetentionClass, number>>
): number {
  const configured = overrides?.[retentionClass] ?? RETENTION_DAYS[retentionClass];
  if (retentionClass === "AUDIT_LOG") {
    return Math.max(configured, RETENTION_DAYS.AUDIT_LOG);
  }
  return configured;
}

export async function purgeNotifications(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("NOTIFICATION", options.retentionDays));
  const legalHold = options.legalHoldOrgIds ?? [];

  const rows = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        lt(notification.createdAt, cutoff),
        legalHold.length > 0
          ? or(
              isNull(notification.organizationId),
              notInArray(notification.organizationId, [...legalHold])
            )
          : undefined
      )
    )
    .orderBy(notification.createdAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "NOTIFICATION", deleted: ids.length, dryRun };
  }

  await db.delete(notification).where(inArray(notification.id, ids));
  return { class: "NOTIFICATION", deleted: ids.length, dryRun };
}

export async function purgeWebhookDeliveries(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("WEBHOOK_DELIVERY", options.retentionDays));

  const rows = await db
    .select({ id: webhookDelivery.id })
    .from(webhookDelivery)
    .where(lt(webhookDelivery.createdAt, cutoff))
    .orderBy(webhookDelivery.createdAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "WEBHOOK_DELIVERY", deleted: ids.length, dryRun };
  }

  await db.delete(webhookDelivery).where(inArray(webhookDelivery.id, ids));
  return { class: "WEBHOOK_DELIVERY", deleted: ids.length, dryRun };
}

export async function purgeProcessedEvents(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("PROCESSED_EVENT", options.retentionDays));

  const rows = await db
    .select({ id: processedEvent.id })
    .from(processedEvent)
    .where(lt(processedEvent.processedAt, cutoff))
    .orderBy(processedEvent.processedAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "PROCESSED_EVENT", deleted: ids.length, dryRun };
  }

  await db.delete(processedEvent).where(inArray(processedEvent.id, ids));
  return { class: "PROCESSED_EVENT", deleted: ids.length, dryRun };
}

export async function purgeEmailDeliveries(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("EMAIL_DELIVERY", options.retentionDays));
  const legalHold = options.legalHoldOrgIds ?? [];

  const rows = await db
    .select({ id: emailDelivery.id })
    .from(emailDelivery)
    .where(
      and(
        lt(emailDelivery.createdAt, cutoff),
        legalHold.length > 0
          ? or(
              isNull(emailDelivery.organizationId),
              notInArray(emailDelivery.organizationId, [...legalHold])
            )
          : undefined
      )
    )
    .orderBy(emailDelivery.createdAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "EMAIL_DELIVERY", deleted: ids.length, dryRun };
  }

  await db.delete(emailDelivery).where(inArray(emailDelivery.id, ids));
  return { class: "EMAIL_DELIVERY", deleted: ids.length, dryRun };
}

export async function purgeUsageEvents(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("USAGE_EVENT", options.retentionDays));
  const legalHold = options.legalHoldOrgIds ?? [];

  const rows = await db
    .select({ id: usageEvent.id })
    .from(usageEvent)
    .where(
      and(
        lt(usageEvent.createdAt, cutoff),
        legalHold.length > 0 ? notInArray(usageEvent.organizationId, [...legalHold]) : undefined
      )
    )
    .orderBy(usageEvent.createdAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "USAGE_EVENT", deleted: ids.length, dryRun };
  }

  await db.delete(usageEvent).where(inArray(usageEvent.id, ids));
  return { class: "USAGE_EVENT", deleted: ids.length, dryRun };
}

export async function purgeAuditLogs(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("AUDIT_LOG", options.retentionDays));
  const legalHold = options.legalHoldOrgIds ?? [];

  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        lt(auditLog.createdAt, cutoff),
        ...RETENTION_SECURITY_AUDIT_ACTION_PREFIXES.map((prefix) =>
          notLike(auditLog.action, `${prefix}%`)
        ),
        legalHold.length > 0
          ? or(isNull(auditLog.organizationId), notInArray(auditLog.organizationId, [...legalHold]))
          : undefined
      )
    )
    .orderBy(auditLog.createdAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "AUDIT_LOG", deleted: ids.length, dryRun };
  }

  await db.delete(auditLog).where(inArray(auditLog.id, ids));
  return { class: "AUDIT_LOG", deleted: ids.length, dryRun };
}

export async function purgeMrrSnapshots(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("MRR_SNAPSHOT", options.retentionDays));

  const rows = await db
    .select({ id: mrrSnapshot.id })
    .from(mrrSnapshot)
    .where(lt(mrrSnapshot.capturedAt, cutoff))
    .orderBy(mrrSnapshot.capturedAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "MRR_SNAPSHOT", deleted: ids.length, dryRun };
  }

  await db.delete(mrrSnapshot).where(inArray(mrrSnapshot.id, ids));
  return { class: "MRR_SNAPSHOT", deleted: ids.length, dryRun };
}

export async function purgeDataExportRecords(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const recordCutoff = cutoffDate(resolveDays("DATA_EXPORT_RECORD", options.retentionDays));
  const legalHold = options.legalHoldOrgIds ?? [];

  const rows = await db
    .select({ fileKey: dataExportRequest.fileKey, id: dataExportRequest.id })
    .from(dataExportRequest)
    .where(
      and(
        or(
          and(
            isNotNull(dataExportRequest.expiresAt),
            lt(dataExportRequest.expiresAt, recordCutoff)
          ),
          and(
            isNotNull(dataExportRequest.downloadRevokedAt),
            lt(dataExportRequest.downloadRevokedAt, recordCutoff)
          ),
          and(
            isNotNull(dataExportRequest.completedAt),
            lt(dataExportRequest.completedAt, recordCutoff),
            inArray(dataExportRequest.status, ["ready", "failed"])
          )
        ),
        legalHold.length > 0
          ? notInArray(dataExportRequest.organizationId, [...legalHold])
          : undefined
      )
    )
    .orderBy(dataExportRequest.createdAt)
    .limit(chunkSize);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0 || dryRun) {
    return { class: "data_export_request", deleted: ids.length, dryRun };
  }

  let deleted = 0;
  for (const row of rows) {
    if (row.fileKey) {
      if (!options.deleteDataExportObject) {
        throw new Error("data_export_object_deleter_required");
      }
      await options.deleteDataExportObject(row.fileKey);
    }
    await db.delete(dataExportRequest).where(inArray(dataExportRequest.id, [row.id]));
    deleted += 1;
  }
  return { class: "data_export_request", deleted, dryRun };
}

export async function purgeBatchJobs(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeClassResult[]> {
  const chunkSize = options.chunkSize ?? RETENTION_PURGE_CHUNK_SIZE;
  const dryRun = options.dryRun ?? false;
  const cutoff = cutoffDate(resolveDays("BATCH_JOB", options.retentionDays));
  const legalHold = options.legalHoldOrgIds ?? [];

  const jobs = await db
    .select({ id: batchJob.id })
    .from(batchJob)
    .where(
      and(
        lt(batchJob.updatedAt, cutoff),
        inArray(batchJob.status, ["completed", "canceled", "failed"]),
        legalHold.length > 0 ? notInArray(batchJob.organizationId, [...legalHold]) : undefined
      )
    )
    .orderBy(batchJob.updatedAt)
    .limit(chunkSize);

  const jobIds = jobs.map((row) => row.id);
  if (jobIds.length === 0) {
    return [
      { class: "batch_job_item", deleted: 0, dryRun },
      { class: "BATCH_JOB", deleted: 0, dryRun }
    ];
  }

  if (dryRun) {
    return [
      { class: "batch_job_item", deleted: jobIds.length, dryRun },
      { class: "BATCH_JOB", deleted: jobIds.length, dryRun }
    ];
  }

  await db.delete(batchJobItem).where(inArray(batchJobItem.batchJobId, jobIds));
  await db.delete(batchJob).where(inArray(batchJob.id, jobIds));

  return [
    { class: "batch_job_item", deleted: jobIds.length, dryRun },
    { class: "BATCH_JOB", deleted: jobIds.length, dryRun }
  ];
}

export async function runRetentionPurgePass(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeSummary> {
  const dryRun = options.dryRun ?? false;
  const classes: RetentionPurgeClassResult[] = [];

  classes.push(await purgeNotifications(options));
  classes.push(await purgeWebhookDeliveries(options));
  classes.push(await purgeProcessedEvents(options));
  classes.push(await purgeEmailDeliveries(options));
  classes.push(await purgeUsageEvents(options));
  classes.push(await purgeAuditLogs(options));
  classes.push(await purgeMrrSnapshots(options));
  classes.push(await purgeDataExportRecords(options));
  classes.push(...(await purgeBatchJobs(options)));

  const totalDeleted = classes.reduce((sum, entry) => sum + entry.deleted, 0);
  return { classes, dryRun, totalDeleted };
}
