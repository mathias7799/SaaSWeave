import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  exportOrganizationAudit,
  formatAuditExport,
  getOrganizationActivity,
  getPlatformAuditLog,
  queryOrganizationAudit,
  recordAudit,
  type AuditEntry
} from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("audit", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("records audit entries and lists organization activity", async () => {
    const seed = await seedOrgWithOwner();

    await recordAudit({
      action: "member.invited",
      actorId: seed.userId,
      actorName: seed.name,
      metadata: { email: "guest@example.com" },
      organizationId: seed.organizationId,
      targetLabel: "guest@example.com",
      targetType: "invitation"
    });

    const activity = await getOrganizationActivity(seed.organizationId, 5);
    expect(activity).toHaveLength(1);
    expect(activity[0]?.action).toBe("member.invited");
    expect(activity[0]?.actorName).toBe(seed.name);
    expect(activity[0]?.metadata).toEqual({ email: "guest@example.com" });
  });

  it("queries organization audit with action filter and cursor pagination", async () => {
    const seed = await seedOrgWithOwner();

    await recordAudit({
      action: "settings.updated",
      actorName: "Owner",
      organizationId: seed.organizationId,
      targetType: "settings"
    });
    await recordAudit({
      action: "api_key.created",
      actorName: "Owner",
      organizationId: seed.organizationId,
      targetType: "api_key"
    });
    await recordAudit({
      action: "api_key.revoked",
      actorName: "Owner",
      organizationId: seed.organizationId,
      targetType: "api_key"
    });

    const filtered = await queryOrganizationAudit({
      action: "api_key.created",
      organizationId: seed.organizationId
    });
    expect(filtered.entries).toHaveLength(1);
    expect(filtered.entries[0]?.action).toBe("api_key.created");
    expect(filtered.nextCursor).toBeNull();

    const firstPage = await queryOrganizationAudit({
      limit: 2,
      organizationId: seed.organizationId
    });
    expect(firstPage.entries).toHaveLength(2);
    expect(firstPage.nextCursor).toBeTypeOf("string");

    const secondPage = await queryOrganizationAudit({
      cursor: firstPage.nextCursor ?? undefined,
      limit: 2,
      organizationId: seed.organizationId
    });
    expect(secondPage.entries.length).toBeGreaterThanOrEqual(1);
  });

  it("exports organization audit as JSON and CSV", async () => {
    const seed = await seedOrgWithOwner();
    await recordAudit({
      action: 'note,with"quotes"',
      actorName: "Owner",
      organizationId: seed.organizationId,
      targetLabel: "line\nbreak",
      targetType: "note"
    });

    const jsonExport = await exportOrganizationAudit({
      format: "json",
      organizationId: seed.organizationId
    });
    expect(jsonExport.contentType).toBe("application/json");
    expect(jsonExport.rowCount).toBe(1);
    expect(jsonExport.filename).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.json$/);

    const csvExport = await exportOrganizationAudit({
      format: "csv",
      organizationId: seed.organizationId
    });
    expect(csvExport.contentType).toBe("text/csv");
    expect(csvExport.content).toContain('"note,with""quotes"""');

    const entries: AuditEntry[] = [
      {
        action: "test.action",
        actorName: "Actor",
        createdAt: new Date().toISOString(),
        id: randomUUID(),
        metadata: null,
        targetLabel: null,
        targetType: null
      }
    ];
    const formatted = formatAuditExport(entries, "json");
    expect(formatted.content).toContain("test.action");
  });

  it("returns platform-wide audit entries filtered by action", async () => {
    const seed = await seedOrgWithOwner();
    await recordAudit({
      action: "platform.maintenance",
      organizationId: seed.organizationId,
      targetType: "platform"
    });
    await recordAudit({
      action: "platform.signups",
      organizationId: seed.organizationId,
      targetType: "platform"
    });

    const all = await getPlatformAuditLog({ limit: 10 });
    expect(all.length).toBeGreaterThanOrEqual(2);

    const filtered = await getPlatformAuditLog({ action: "platform.maintenance", limit: 5 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.action).toBe("platform.maintenance");
  });
});
