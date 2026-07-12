import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { db, purgeAuditLogs, purgeDataExportRecords } from "@saasweave/db";
import { auditLog, dataExportRequest } from "@saasweave/db/schema";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("retention purge", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("never purges protected security audit actions", async () => {
    const seed = await seedOrgWithOwner();
    const old = new Date();
    old.setUTCDate(old.getUTCDate() - 800);

    await db.insert(auditLog).values([
      {
        action: "auth.login",
        createdAt: old,
        id: randomUUID(),
        organizationId: seed.organizationId
      },
      {
        action: "settings.updated",
        createdAt: old,
        id: randomUUID(),
        organizationId: seed.organizationId
      },
      {
        action: "settings.updated",
        createdAt: new Date(),
        id: randomUUID(),
        organizationId: seed.organizationId
      }
    ]);

    const result = await purgeAuditLogs({ chunkSize: 10 });
    expect(result.deleted).toBe(1);

    const remaining = await db
      .select({ action: auditLog.action, createdAt: auditLog.createdAt })
      .from(auditLog)
      .orderBy(asc(auditLog.createdAt));
    expect(remaining.map((row) => row.action)).toEqual(["auth.login", "settings.updated"]);
  });

  it("deletes export objects before rows and remains idempotent", async () => {
    const seed = await seedOrgWithOwner();
    const id = randomUUID();
    const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000);
    const fileKey = `exports/${seed.organizationId}/${id}.ndjson`;
    await db.insert(dataExportRequest).values({
      completedAt: old,
      createdAt: old,
      expiresAt: old,
      fileKey,
      id,
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId,
      status: "ready"
    });

    const deletedObjects: string[] = [];
    const first = await purgeDataExportRecords({
      deleteDataExportObject: async (key) => {
        const rows = await db
          .select({ id: dataExportRequest.id })
          .from(dataExportRequest)
          .where(eq(dataExportRequest.id, id));
        expect(rows).toHaveLength(1);
        deletedObjects.push(key);
      },
      retentionDays: { DATA_EXPORT_RECORD: 30 }
    });
    const second = await purgeDataExportRecords({
      deleteDataExportObject: async (key) => {
        deletedObjects.push(key);
      },
      retentionDays: { DATA_EXPORT_RECORD: 30 }
    });

    expect(first.deleted).toBe(1);
    expect(second.deleted).toBe(0);
    expect(deletedObjects).toEqual([fileKey]);
    expect(
      await db.select().from(dataExportRequest).where(eq(dataExportRequest.id, id))
    ).toHaveLength(0);
  });

  it("keeps export rows on legal hold or storage deletion failure", async () => {
    const seed = await seedOrgWithOwner();
    const id = randomUUID();
    const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000);
    await db.insert(dataExportRequest).values({
      completedAt: old,
      createdAt: old,
      expiresAt: old,
      fileKey: `exports/${seed.organizationId}/${id}.ndjson`,
      id,
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId,
      status: "ready"
    });

    const held = await purgeDataExportRecords({
      deleteDataExportObject: async () => {
        throw new Error("must_not_run");
      },
      legalHoldOrgIds: [seed.organizationId],
      retentionDays: { DATA_EXPORT_RECORD: 30 }
    });
    expect(held.deleted).toBe(0);

    await expect(
      purgeDataExportRecords({
        deleteDataExportObject: async () => {
          throw new Error("storage_unavailable");
        },
        retentionDays: { DATA_EXPORT_RECORD: 30 }
      })
    ).rejects.toThrow("storage_unavailable");
    expect(
      await db.select().from(dataExportRequest).where(eq(dataExportRequest.id, id))
    ).toHaveLength(1);
  });
});
