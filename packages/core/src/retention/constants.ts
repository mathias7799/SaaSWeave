/** Default retention windows (days). Security audit data uses the longest window. */
export const RETENTION_DAYS = {
  /** Security and billing audit trail — never use the notification default. */
  AUDIT_LOG: 730,
  NOTIFICATION: 90,
  WEBHOOK_DELIVERY: 30,
  PROCESSED_EVENT: 90,
  /** Completed/failed export rows after file expiry or revocation. */
  DATA_EXPORT_RECORD: 30,
  /** Billing/analytics usage events (~13 months). */
  USAGE_EVENT: 395,
  EMAIL_DELIVERY: 90,
  MRR_SNAPSHOT: 1_825,
  /** Completed/cancelled batch job headers and items. */
  BATCH_JOB: 90
} as const;

export type RetentionClass = keyof typeof RETENTION_DAYS;

/** Rows deleted per purge iteration to bound lock time and memory. */
export const RETENTION_PURGE_CHUNK_SIZE = 500;

/** BullMQ completed/failed job age trimmed by the retention schedule (days). */
export const BULLMQ_HISTORY_RETENTION_DAYS = 14;

/** Audit action prefixes that retention must never delete automatically. */
export const RETENTION_SECURITY_AUDIT_ACTION_PREFIXES = [
  "auth.",
  "security.",
  "api_key.",
  "sso.",
  "billing."
] as const;
