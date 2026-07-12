import { isRedisEnabled } from "@saasweave/cache";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";

import { getQueue, QUEUE_NAMES, SCHEDULE_JOB_NAMES } from "#@/queues";

const log = createLogger({ operation: "server__jobs_schedules" });

/** Register BullMQ repeatable jobs. Safe to call on every worker startup. */
export async function registerRepeatableSchedules(): Promise<string[]> {
  if (!isRedisEnabled()) {
    log.info("Skipping schedule registration without Redis", {
      event: "schedules_skipped"
    });
    return [];
  }

  const queue = getQueue(QUEUE_NAMES.SCHEDULES);
  const invitationPattern = ENV_SERVER.WORKER_SCHEDULE_INVITATION_CRON;
  const mrrSnapshotPattern = ENV_SERVER.WORKER_SCHEDULE_MRR_SNAPSHOT_CRON;
  const storageCleanupPattern = ENV_SERVER.WORKER_SCHEDULE_STORAGE_CLEANUP_CRON;
  const dataRetentionPattern = ENV_SERVER.WORKER_SCHEDULE_DATA_RETENTION_CRON;
  const platformAnalyticsPattern = ENV_SERVER.WORKER_SCHEDULE_PLATFORM_ANALYTICS_CRON;

  await queue.upsertJobScheduler(
    SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS,
    { pattern: invitationPattern },
    {
      data: {},
      name: SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS,
      opts: {
        attempts: 2,
        backoff: { delay: 5_000, type: "exponential" }
      }
    }
  );

  await queue.upsertJobScheduler(
    SCHEDULE_JOB_NAMES.SNAPSHOT_MRR,
    { pattern: mrrSnapshotPattern },
    {
      data: {},
      name: SCHEDULE_JOB_NAMES.SNAPSHOT_MRR,
      opts: {
        attempts: 2,
        backoff: { delay: 5_000, type: "exponential" }
      }
    }
  );

  await queue.upsertJobScheduler(
    SCHEDULE_JOB_NAMES.CLEANUP_STORAGE,
    { pattern: storageCleanupPattern },
    {
      data: {},
      name: SCHEDULE_JOB_NAMES.CLEANUP_STORAGE,
      opts: {
        attempts: 2,
        backoff: { delay: 5_000, type: "exponential" }
      }
    }
  );

  await queue.upsertJobScheduler(
    SCHEDULE_JOB_NAMES.DATA_RETENTION,
    { pattern: dataRetentionPattern },
    {
      data: {},
      name: SCHEDULE_JOB_NAMES.DATA_RETENTION,
      opts: {
        attempts: 2,
        backoff: { delay: 5_000, type: "exponential" }
      }
    }
  );

  await queue.upsertJobScheduler(
    SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS,
    { pattern: platformAnalyticsPattern },
    {
      data: {},
      name: SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS,
      opts: {
        attempts: 2,
        backoff: { delay: 5_000, type: "exponential" }
      }
    }
  );

  log.info("Repeatable schedules registered", {
    event: "schedules_registered",
    jobs: [
      SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS,
      SCHEDULE_JOB_NAMES.SNAPSHOT_MRR,
      SCHEDULE_JOB_NAMES.CLEANUP_STORAGE,
      SCHEDULE_JOB_NAMES.DATA_RETENTION,
      SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS
    ],
    dataRetentionPattern,
    invitationPattern,
    mrrSnapshotPattern,
    platformAnalyticsPattern,
    storageCleanupPattern
  });

  return [
    SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS,
    SCHEDULE_JOB_NAMES.SNAPSHOT_MRR,
    SCHEDULE_JOB_NAMES.CLEANUP_STORAGE,
    SCHEDULE_JOB_NAMES.DATA_RETENTION,
    SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS
  ];
}
