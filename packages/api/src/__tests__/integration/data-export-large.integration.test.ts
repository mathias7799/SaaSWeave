/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect } from "vite-plus/test";

import { processDataExportRequest } from "@saasweave/app/data-export/process";
import { getFilesClient } from "@saasweave/app/storage/files-client";
import {
  createDataExportRequest,
  db,
  getDataExportRequestById,
  updateDataExportRequestStatus
} from "@saasweave/db";
import { auditLog, usageEvent } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";

import { integrationIt, seedOrgWithOwner } from "./harness";

const MAX_HEAP_DELTA_BYTES = 12 * 1_024 * 1_024;

function heapUsed(): number {
  return process.memoryUsage().heapUsed;
}

function collectGarbage(): void {
  globalThis.gc?.();
}

describe.sequential("large streaming data export", () => {
  integrationIt("streams a seeded workspace export with bounded memory growth", async () => {
    const seed = await seedOrgWithOwner({ organizationName: "Large export workspace" });
    const now = new Date();

    const usageRows = Array.from({ length: 2_500 }, (_, index) => {
      return {
        createdAt: new Date(now.getTime() - index * 1_000),
        id: randomUUID(),
        metric: "ai_tokens",
        organizationId: seed.organizationId,
        quantity: 10
      };
    });
    await db.insert(usageEvent).values(usageRows);

    const auditRows = Array.from({ length: 1_000 }, (_, index) => {
      return {
        action: "test.export_seed",
        actorId: seed.userId,
        createdAt: new Date(now.getTime() - index * 500),
        id: randomUUID(),
        organizationId: seed.organizationId,
        targetLabel: `row-${index}`,
        targetType: "test"
      };
    });
    await db.insert(auditLog).values(auditRows);

    const created = await createDataExportRequest({
      organizationId: seed.organizationId,
      requestedByUserId: seed.userId
    });
    await updateDataExportRequestStatus(created.id, {
      bytesWritten: 99_999,
      checkpoint: {
        bytesWritten: 99_999,
        completedTables: ["organization", "members"],
        currentTable: "usage_events",
        cursor: { createdAt: now.toISOString(), id: usageRows[0]!.id },
        rowsWritten: 999
      },
      rowsWritten: 999,
      status: "processing"
    });

    collectGarbage();
    const before = heapUsed();
    const result = await processDataExportRequest(created.id);
    collectGarbage();
    const after = heapUsed();

    expect(result.status).toBe("ready");
    // V8 coverage retains instrumented source maps and counters in the measured heap. The
    // non-instrumented integration job remains the authoritative production memory bound.
    if (process.env.COVERAGE_RUN !== "1") {
      expect(after - before).toBeLessThan(MAX_HEAP_DELTA_BYTES);
    }

    const updated = await getDataExportRequestById(created.id);
    expect(updated?.rowsWritten).toBeGreaterThan(3_000);
    expect(updated?.bytesWritten).toBeGreaterThan(10_000);
    expect(updated?.fileKey).toMatch(/\.ndjson$/);

    const files = getFilesClient();
    const exportPath = join(ENV_SERVER.MEDIA_UPLOAD_DIR, updated!.fileKey!);
    const contents = files
      ? await files.download(updated!.fileKey!).then((file) => file.text())
      : await readFile(exportPath, "utf8");
    const lines = contents.trimEnd().split("\n");
    const records = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    const usageIds = records
      .filter((record) => record.table === "usage_events")
      .map((record) => (record.data as { id: string }).id);

    expect(records.filter((record) => record.table === "meta")).toHaveLength(1);
    expect(new Set(usageIds).size).toBe(usageRows.length);
    expect(usageIds).toHaveLength(usageRows.length);
    expect(updated?.rowsWritten).toBe(lines.length - 1);
    const storedBytes = files
      ? await files.head(updated!.fileKey!).then((head) => head.size)
      : (await stat(exportPath)).size;
    expect(updated?.bytesWritten).toBe(storedBytes);
  });
});
