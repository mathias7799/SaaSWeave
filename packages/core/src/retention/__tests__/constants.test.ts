import { describe, expect, it } from "vite-plus/test";

import { isRetentionProtectedAuditAction, RETENTION_DAYS } from "@saasweave/core/retention";

describe("retention constants", () => {
  it("keeps audit retention longer than notifications", () => {
    expect(RETENTION_DAYS.AUDIT_LOG).toBeGreaterThan(RETENTION_DAYS.NOTIFICATION);
    expect(RETENTION_DAYS.AUDIT_LOG).toBeGreaterThanOrEqual(365);
  });

  it.each(["auth.login", "security.2fa_enabled", "api_key.revoked", "sso.created", "billing.paid"])(
    "protects security-sensitive action %s from automated purge",
    (action) => {
      expect(isRetentionProtectedAuditAction(action)).toBe(true);
    }
  );

  it.each(["settings.updated", "member.joined", "notification.read", "authentication.failed"])(
    "does not protect ordinary action %s",
    (action) => {
      expect(isRetentionProtectedAuditAction(action)).toBe(false);
    }
  );
});
