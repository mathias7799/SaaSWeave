import { Worker, type ConnectionOptions, type Job } from "bullmq";

import { computeCurrentMrr } from "@saasweave/app/billing/compute-current-mrr";
import {
  runDataExportCleanup,
  runMediaLifecycleCleanup
} from "@saasweave/app/storage/media-cleanup";
import { cacheInvalidateTag } from "@saasweave/cache";
import { createRedisConnection } from "@saasweave/cache";
import { refreshPlatformAnalyticsDaily, upsertMrrSnapshot } from "@saasweave/db";
import { createLogger } from "@saasweave/logger/server";

import { expireStaleInvitations } from "#@/maintenance";
import { resolveQueuePrefix } from "#@/queue-prefix";
import { QUEUE_NAMES, SCHEDULE_JOB_NAMES } from "#@/queues";
import { runDataRetention } from "#@/retention/index";

const log = createLogger({ operation: "server__worker" });

function currentPeriodMonth(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export async function processScheduleJob(job: Job): Promise<unknown> {
  if (job.name === SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS) {
    const count = await expireStaleInvitations();
    log.info("Expired stale invitations", {
      count,
      event: "schedule_invitations_expired",
      jobId: job.id
    });
    return { count };
  }

  if (job.name === SCHEDULE_JOB_NAMES.SNAPSHOT_MRR) {
    const periodMonth = currentPeriodMonth();
    const logger = createLogger({ operation: "worker__mrr_snapshot", periodMonth });

    try {
      const snapshot = await computeCurrentMrr(periodMonth);
      await upsertMrrSnapshot({
        activeOrgs: snapshot.activeOrgs,
        churnedMrr: snapshot.churnedMrr,
        currency: snapshot.currency,
        mrr: snapshot.mrr,
        newMrr: snapshot.newMrr,
        periodMonth
      });

      logger.emit({
        activeOrgs: snapshot.activeOrgs,
        churnedMrr: snapshot.churnedMrr,
        currency: snapshot.currency,
        event: "mrr_snapshot_upserted",
        jobId: job.id,
        mrr: snapshot.mrr,
        newMrr: snapshot.newMrr,
        periodMonth
      });

      return { periodMonth, mrr: snapshot.mrr };
    } catch (error) {
      logger.error(error instanceof Error ? error : String(error), {
        event: "mrr_snapshot_failed",
        jobId: job.id
      });
      logger.emit({ _forceKeep: true });
      throw error;
    }
  }

  if (job.name === SCHEDULE_JOB_NAMES.CLEANUP_STORAGE) {
    const media = await runMediaLifecycleCleanup();
    const exports = await runDataExportCleanup();
    log.info("Storage cleanup completed", {
      event: "schedule_storage_cleanup_completed",
      exports,
      jobId: job.id,
      media
    });
    return { exports, media };
  }

  if (job.name === SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS) {
    const snapshot = await refreshPlatformAnalyticsDaily();
    await cacheInvalidateTag("platform-analytics");
    log.info("Platform analytics aggregates refreshed", {
      event: "schedule_platform_analytics_refreshed",
      jobId: job.id,
      statDate: snapshot.statDate,
      totalWorkspaces: snapshot.totalWorkspaces
    });
    return snapshot;
  }

  if (job.name === SCHEDULE_JOB_NAMES.DATA_RETENTION) {
    const result = await runDataRetention();
    log.info("Data retention completed", {
      event: "schedule_data_retention_completed",
      jobId: job.id,
      totalDeleted: result.summary.totalDeleted
    });
    return result;
  }

  throw new Error(`Unknown schedule job: ${job.name}`);
}

export function createScheduleWorker(): Worker {
  const connection = createRedisConnection("worker:schedules", {
    maxRetriesPerRequest: null
  });
  if (!connection) {
    throw new Error("Redis is required before workers can start. Set REDIS_URL.");
  }

  const worker = new Worker(QUEUE_NAMES.SCHEDULES, processScheduleJob, {
    concurrency: 1,
    connection: connection as unknown as ConnectionOptions,
    prefix: resolveQueuePrefix()
  });

  worker.on("failed", (job, error) => {
    log.error(error, {
      event: "job_failed",
      jobId: job?.id,
      name: job?.name,
      queue: job?.queueName
    });
  });

  return worker;
}
