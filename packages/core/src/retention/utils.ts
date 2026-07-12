import { RETENTION_SECURITY_AUDIT_ACTION_PREFIXES } from "#@/retention/constants";

/** Return whether an audit action must be excluded from automated retention purges. */
export function isRetentionProtectedAuditAction(action: string): boolean {
  return RETENTION_SECURITY_AUDIT_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}
