import { deleteDataExportObject } from "@saasweave/app/storage/media-cleanup";
import { BULLMQ_HISTORY_RETENTION_DAYS } from "@saasweave/core/retention";
import { runRetentionPurgePass, type RetentionPurgeOptions } from "@saasweave/db";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";
import { retentionPurgedRowsTotal } from "@saasweave/observability";

import { getQueue, QUEUE_NAMES, type QueueName } from "#@/queues";

const log = createLogger({ operation: "server__retention" });

function parseLegalHoldOrgIds(): string[] {
  const raw = ENV_SERVER.RETENTION_LEGAL_HOLD_ORG_IDS.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function trimBullMqHistory(
  retentionDays = BULLMQ_HISTORY_RETENTION_DAYS
): Promise<Record<QueueName, { completed: number; failed: number }>> {
  const graceMs = retentionDays * 24 * 60 * 60 * 1000;
  const results = {} as Record<QueueName, { completed: number; failed: number }>;

  for (const name of Object.values(QUEUE_NAMES)) {
    const queue = getQueue(name);
    const completed = await queue.clean(graceMs, 1_000, "completed");
    const failed = await queue.clean(graceMs, 1_000, "failed");
    results[name] = { completed: completed.length, failed: failed.length };
  }

  return results;
}

export async function runDataRetention(options: RetentionPurgeOptions = {}) {
  const legalHoldOrgIds = options.legalHoldOrgIds ?? parseLegalHoldOrgIds();
  const dryRun = options.dryRun ?? ENV_SERVER.RETENTION_PURGE_DRY_RUN;
  const summary = await runRetentionPurgePass({
    ...options,
    deleteDataExportObject: options.deleteDataExportObject ?? deleteDataExportObject,
    dryRun,
    legalHoldOrgIds
  });

  for (const entry of summary.classes) {
    if (entry.deleted > 0) {
      retentionPurgedRowsTotal.inc(
        { class: entry.class, dry_run: String(entry.dryRun) },
        entry.deleted
      );
    }
  }

  const bullmq = await trimBullMqHistory();

  log.info("Data retention pass completed", {
    bullmq,
    dryRun,
    event: "retention_purge_completed",
    totalDeleted: summary.totalDeleted
  });

  return { bullmq, summary };
}
