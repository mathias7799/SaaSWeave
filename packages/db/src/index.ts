import "@tanstack/react-start/server-only";
import { sql } from "drizzle-orm";

import { db } from "#@/connection";

export * from "drizzle-orm/sql";
export { db } from "#@/connection";

export async function checkIsDbReady(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

export {
  recordAudit,
  getOrganizationActivity,
  getPlatformAuditLog,
  type AuditEntry
} from "#@/audit";

export {
  exportOrganizationAudit,
  formatAuditExport,
  queryOrganizationAudit,
  type AuditQueryInput,
  type AuditQueryResult
} from "#@/audit-query";

export { isFeatureGloballyEnabled } from "#@/features";

export {
  createOrganizationIpRule,
  deleteOrganizationIpRule,
  listOrganizationIpRules,
  type OrganizationIpRule
} from "#@/organization-ip-rules";

export {
  getEmailCopy,
  getEmailDeliveries,
  recordEmailDelivery,
  saveEmailCopy,
  type EmailCopyOverride,
  type EmailDeliveryEntry,
  type EmailDeliveryRecord,
  type EmailDeliveryStatus
} from "#@/email";

export { getMediaAssetByKey, type MediaAssetByKey } from "#@/media";

export {
  deleteDataExportRequest,
  deleteMediaAssetRow,
  listExpiredOrphanUploadAssetIds,
  listExpiredPendingUploadAssetIds,
  listExpiredReadyExportIds,
  listReplacedAvatarAssetIds,
  listStaleFailedExportIds,
  markOtherLinkedAvatarsReplaced,
  type DataExportCleanupResult,
  type MediaLifecycleCleanupResult
} from "#@/media-lifecycle";

export {
  countUnreadNotifications,
  createNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationAudience,
  type NotificationEntry,
  type NotificationInput
} from "#@/notification";

export {
  getPlatformSettings,
  getPublicPlatformSettings,
  type PlatformSettings,
  type PublicPlatformSettings
} from "#@/platform-settings";

export {
  getWebhookEndpoint,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  deliverWebhookHttp,
  getEnabledWebhookTargets,
  listWebhookDeliveries,
  listWebhookEndpoints,
  recordWebhookDelivery,
  setWebhookEndpointEnabled,
  signWebhookPayload,
  type WebhookDeliveryEntry,
  type WebhookEndpointSummary
} from "#@/webhooks";

export {
  getAiUsageByFeature,
  getAiUsageByModel,
  getAiUsageTokenTotals,
  UNATTRIBUTED_USAGE_LABEL,
  usageEventTokenSplit,
  type AiUsageByFeatureRow,
  type AiUsageByModelRow,
  type AiUsageTokenTotals
} from "#@/usage-query";

export {
  STRIPE_CUSTOMER_ADVISORY_LOCK_NAMESPACE,
  isStaleStripeEvent,
  stripeCustomerAdvisoryLockKeys
} from "#@/stripe-webhook-ordering";

export {
  acquireStripeCustomerAdvisoryXactLock,
  getLastStripeEventAtForCustomer,
  setLastStripeEventAtForCustomer
} from "#@/stripe-webhook";

export {
  listMrrSnapshots,
  upsertMrrSnapshot,
  type MrrSnapshotRow,
  type UpsertMrrSnapshotInput
} from "#@/mrr-snapshot";

export {
  createDataExportRequest,
  cancelDataExportRequest,
  getDataExportRequest,
  getDataExportRequestById,
  isDataExportCanceled,
  listDataExportRequests,
  updateDataExportRequestStatus,
  type DataExportRequestRow
} from "#@/data-export-request";

export type { DataExportCheckpoint } from "#@/schema/data-export-request.schema";

export {
  cancelBatchJob,
  claimBatchJobItems,
  createBatchJobWithItems,
  getBatchJob,
  getBatchJobById,
  getBatchJobWithItems,
  getBatchJobWithItemsById,
  incrementBatchJobProgress,
  isBatchJobCanceled,
  listBatchJobItems,
  listBatchJobs,
  releaseExpiredBatchJobLeases,
  updateBatchJobItemStatus,
  updateBatchJobStatus,
  type BatchJobItemRow,
  type BatchJobRow,
  type BatchJobWithItems
} from "#@/batch-job";

export {
  countOrganizations,
  explainPlatformAnalyticsQueries,
  getLatestPlatformAnalyticsMetric,
  getLatestPlatformAnalyticsSnapshot,
  getOrganizationPlanDistribution,
  listAdminWorkspacesPage,
  PLATFORM_ANALYTICS_METRICS,
  refreshPlatformAnalyticsDaily,
  sumPlatformAnalyticsMetricRange,
  upsertPlatformAnalyticsDaily,
  type AdminWorkspaceCursor,
  type OrganizationPlanCount
} from "#@/platform-analytics";

export { runDatabaseMigrations } from "#@/migrate";

export {
  runRetentionPurgePass,
  purgeAuditLogs,
  purgeBatchJobs,
  purgeDataExportRecords,
  purgeEmailDeliveries,
  purgeMrrSnapshots,
  purgeNotifications,
  purgeProcessedEvents,
  purgeUsageEvents,
  purgeWebhookDeliveries,
  type RetentionPurgeClassResult,
  type RetentionPurgeOptions,
  type RetentionPurgeSummary
} from "#@/retention-purge";
