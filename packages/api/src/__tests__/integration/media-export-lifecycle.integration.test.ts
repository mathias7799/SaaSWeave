/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { describe, expect } from "vite-plus/test";

import { buildDataExportObjectKey } from "@saasweave/app/data-export/storage";
import { isObjectStorageEnabled } from "@saasweave/app/storage/files-client";
import {
  runDataExportCleanup,
  runMediaLifecycleCleanup
} from "@saasweave/app/storage/media-cleanup";
import { canServePublicMediaAsset } from "@saasweave/core/media-asset";
import { db, markOtherLinkedAvatarsReplaced } from "@saasweave/db";
import { dataExportRequest, mediaAsset } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";

import { resolveAuthorizedDataExportDownload } from "#@/lib/data-export/download";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

describe.sequential("media and export lifecycle", () => {
  integrationIt("member cannot authorize export download (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner({ role: "member" });
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { data_export: true });

    const exportId = crypto.randomUUID();
    const fileKey = buildDataExportObjectKey(seed.organizationId, exportId);
    await db.insert(dataExportRequest).values({
      completedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      fileKey,
      id: exportId,
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId,
      status: "ready"
    });

    const caller = await createCallerFor({ seed, role: "member" });
    await expectOrpcError(() => caller.console.dataExport.download({ id: exportId }), "FORBIDDEN");
  });

  integrationIt("cross-tenant export download is denied (EXPORT_NOT_FOUND)", async () => {
    const ownerA = await seedOrgWithOwner({ organizationName: "Workspace A" });
    const ownerB = await seedOrgWithOwner({ organizationName: "Workspace B" });
    await seedOrganizationPlan(ownerA.organizationId);
    await seedOrganizationPlan(ownerB.organizationId);
    await seedOrganizationFeatureFlags(ownerA.organizationId, { data_export: true });
    await seedOrganizationFeatureFlags(ownerB.organizationId, { data_export: true });

    const exportId = crypto.randomUUID();
    await db.insert(dataExportRequest).values({
      completedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      fileKey: buildDataExportObjectKey(ownerA.organizationId, exportId),
      id: exportId,
      organizationId: ownerA.organizationId,
      requestedByUserId: ownerA.userId,
      status: "ready"
    });

    const callerB = await createCallerFor({ seed: ownerB });
    await expectOrpcError(
      () => callerB.console.dataExport.download({ id: exportId }),
      "EXPORT_NOT_FOUND"
    );
  });

  integrationIt("expired and not-ready exports cannot be downloaded", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { data_export: true });
    const caller = await createCallerFor({ seed });

    const pendingId = crypto.randomUUID();
    await db.insert(dataExportRequest).values({
      createdAt: new Date(),
      id: pendingId,
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId,
      status: "pending"
    });
    await expectOrpcError(
      () => caller.console.dataExport.download({ id: pendingId }),
      "EXPORT_NOT_READY"
    );

    const expiredId = crypto.randomUUID();
    await db.insert(dataExportRequest).values({
      completedAt: new Date(Date.now() - 86_400_000),
      createdAt: new Date(Date.now() - 172_800_000),
      expiresAt: new Date(Date.now() - 1_000),
      fileKey: buildDataExportObjectKey(seed.organizationId, expiredId),
      id: expiredId,
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId,
      status: "ready"
    });
    await expectOrpcError(
      () => caller.console.dataExport.download({ id: expiredId }),
      "EXPORT_EXPIRED"
    );
  });

  integrationIt("owner receives a session download URL for local exports", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { data_export: true });

    const exportId = crypto.randomUUID();
    const fileKey = buildDataExportObjectKey(seed.organizationId, exportId);
    const absolutePath = join(ENV_SERVER.MEDIA_UPLOAD_DIR, fileKey);
    await mkdir(join(ENV_SERVER.MEDIA_UPLOAD_DIR, "exports", seed.organizationId), {
      recursive: true
    });
    await writeFile(absolutePath, JSON.stringify({ ok: true }));

    await db.insert(dataExportRequest).values({
      completedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      fileKey,
      id: exportId,
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId,
      status: "ready"
    });

    const resolved = await resolveAuthorizedDataExportDownload(
      {
        organizationId: seed.organizationId,
        role: "owner",
        userId: seed.userId
      },
      exportId
    );

    if (isObjectStorageEnabled()) {
      expect(resolved.mode).toBe("signed");
      expect(resolved.url).toContain("http");
    } else {
      expect(resolved.mode).toBe("session");
      expect(resolved.url).toContain(`/exports/${exportId}/download`);
    }
  });

  integrationIt("orphan and private-purpose assets are not publicly servable", async () => {
    expect(
      canServePublicMediaAsset({
        purpose: "avatar",
        replacedAt: null,
        status: "orphan"
      })
    ).toBe(false);

    expect(
      canServePublicMediaAsset({
        purpose: "attachment",
        replacedAt: null,
        status: "linked"
      })
    ).toBe(false);
  });

  integrationIt("storage cleanup jobs are idempotent", async () => {
    const seed = await seedOrgWithOwner();
    const stalePendingId = crypto.randomUUID();
    await db.insert(mediaAsset).values({
      contentType: "image/png",
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      id: stalePendingId,
      key: `avatar/${seed.userId}/stale.png`,
      ownerId: seed.userId,
      purpose: "avatar",
      size: 128,
      status: "pending"
    });

    const first = await runMediaLifecycleCleanup();
    const second = await runMediaLifecycleCleanup();

    expect(first.expiredPendingUploads).toBe(1);
    expect(second.expiredPendingUploads).toBe(0);

    const rows = await db.select().from(mediaAsset).where(eq(mediaAsset.id, stalePendingId));
    expect(rows).toHaveLength(0);

    const exportCleanupFirst = await runDataExportCleanup();
    const exportCleanupSecond = await runDataExportCleanup();
    expect(exportCleanupFirst.failedExports).toBe(0);
    expect(exportCleanupSecond.failedExports).toBe(0);
  });

  integrationIt("avatar replacement marks the previous linked avatar for cleanup", async () => {
    const seed = await seedOrgWithOwner();
    const oldAssetId = crypto.randomUUID();
    const newAssetId = crypto.randomUUID();

    await db.insert(mediaAsset).values([
      {
        contentType: "image/png",
        createdAt: new Date(),
        id: oldAssetId,
        key: `avatar/${seed.userId}/old.png`,
        linkedAt: new Date(),
        ownerId: seed.userId,
        purpose: "avatar",
        size: 128,
        status: "linked",
        uploadedAt: new Date()
      },
      {
        contentType: "image/png",
        createdAt: new Date(),
        id: newAssetId,
        key: `avatar/${seed.userId}/new.png`,
        ownerId: seed.userId,
        purpose: "avatar",
        size: 128,
        status: "orphan",
        uploadedAt: new Date()
      }
    ]);

    await db
      .update(mediaAsset)
      .set({ linkedAt: new Date(), status: "linked" })
      .where(eq(mediaAsset.id, newAssetId));
    await markOtherLinkedAvatarsReplaced(seed.userId, newAssetId);

    const [oldRow] = await db.select().from(mediaAsset).where(eq(mediaAsset.id, oldAssetId));
    expect(oldRow?.replacedAt).not.toBeNull();
    expect(
      canServePublicMediaAsset({
        purpose: oldRow!.purpose,
        replacedAt: oldRow!.replacedAt,
        status: oldRow!.status
      })
    ).toBe(false);
  });
});
