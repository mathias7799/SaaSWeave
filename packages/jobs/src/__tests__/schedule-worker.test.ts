import { type Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { SCHEDULE_JOB_NAMES } from "#@/queues";

const computeCurrentMrr = vi.fn();
const upsertMrrSnapshot = vi.fn();
const refreshPlatformAnalyticsDaily = vi.fn();
const cacheInvalidateTag = vi.fn();
const runMediaLifecycleCleanup = vi.fn();
const runDataExportCleanup = vi.fn();
const expireStaleInvitations = vi.fn();
const runDataRetention = vi.fn();
const createRedisConnection = vi.fn();
const logger = { emit: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock("@saasweave/app/billing/compute-current-mrr", () => {
  return { computeCurrentMrr: (...args: unknown[]) => computeCurrentMrr(...args) };
});
vi.mock("@saasweave/app/storage/media-cleanup", () => {
  return {
    runDataExportCleanup: (...args: unknown[]) => runDataExportCleanup(...args),
    runMediaLifecycleCleanup: (...args: unknown[]) => runMediaLifecycleCleanup(...args)
  };
});
vi.mock("@saasweave/cache", () => {
  return {
    cacheInvalidateTag: (...args: unknown[]) => cacheInvalidateTag(...args),
    createRedisConnection: (...args: unknown[]) => createRedisConnection(...args)
  };
});
vi.mock("@saasweave/db", () => {
  return {
    refreshPlatformAnalyticsDaily: (...args: unknown[]) => refreshPlatformAnalyticsDaily(...args),
    upsertMrrSnapshot: (...args: unknown[]) => upsertMrrSnapshot(...args)
  };
});
vi.mock("@saasweave/logger/server", () => {
  return { createLogger: () => logger };
});
vi.mock("#@/maintenance", () => {
  return { expireStaleInvitations: (...args: unknown[]) => expireStaleInvitations(...args) };
});
vi.mock("#@/retention/index", () => {
  return { runDataRetention: (...args: unknown[]) => runDataRetention(...args) };
});
vi.mock("bullmq", () => {
  class Worker {
    name: string;
    on = vi.fn();
    constructor(name: string) {
      this.name = name;
    }
  }
  return { Worker };
});

const { createScheduleWorker, processScheduleJob } = await import("#@/schedule-worker");

function job(name: string): Job {
  return { id: "schedule_1", name, queueName: "schedules" } as Job;
}

describe("schedule job processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expireStaleInvitations.mockResolvedValue(2);
    computeCurrentMrr.mockResolvedValue({
      activeOrgs: 4,
      churnedMrr: 5,
      currency: "usd",
      mrr: 100,
      newMrr: 10
    });
    runMediaLifecycleCleanup.mockResolvedValue({ orphanedUploads: 1 });
    runDataExportCleanup.mockResolvedValue({ expiredExports: 1 });
    refreshPlatformAnalyticsDaily.mockResolvedValue({
      statDate: "2026-07-12",
      totalWorkspaces: 12
    });
    runDataRetention.mockResolvedValue({ summary: { totalDeleted: 7 } });
  });

  it("processes invitation expiry and storage cleanup", async () => {
    await expect(processScheduleJob(job(SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS))).resolves.toEqual({
      count: 2
    });
    await expect(processScheduleJob(job(SCHEDULE_JOB_NAMES.CLEANUP_STORAGE))).resolves.toEqual({
      exports: { expiredExports: 1 },
      media: { orphanedUploads: 1 }
    });
  });

  it("computes and persists the monthly MRR snapshot", async () => {
    const result = await processScheduleJob(job(SCHEDULE_JOB_NAMES.SNAPSHOT_MRR));

    expect(computeCurrentMrr).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/));
    expect(upsertMrrSnapshot).toHaveBeenCalledWith(expect.objectContaining({ mrr: 100 }));
    expect(result).toEqual(expect.objectContaining({ mrr: 100 }));
    expect(logger.emit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "mrr_snapshot_upserted" })
    );
  });

  it("logs and rethrows MRR snapshot failures", async () => {
    computeCurrentMrr.mockRejectedValue(new Error("billing unavailable"));

    await expect(processScheduleJob(job(SCHEDULE_JOB_NAMES.SNAPSHOT_MRR))).rejects.toThrow(
      "billing unavailable"
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ event: "mrr_snapshot_failed" })
    );
    expect(logger.emit).toHaveBeenCalledWith({ _forceKeep: true });
  });

  it("refreshes analytics and invalidates its cache tag", async () => {
    const result = await processScheduleJob(job(SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS));

    expect(cacheInvalidateTag).toHaveBeenCalledWith("platform-analytics");
    expect(result).toEqual(expect.objectContaining({ totalWorkspaces: 12 }));
  });

  it("runs data retention and rejects unknown schedule jobs", async () => {
    await expect(processScheduleJob(job(SCHEDULE_JOB_NAMES.DATA_RETENTION))).resolves.toEqual({
      summary: { totalDeleted: 7 }
    });
    await expect(processScheduleJob(job("unexpected"))).rejects.toThrow(
      "Unknown schedule job: unexpected"
    );
  });
});

describe("schedule worker creation", () => {
  beforeEach(() => {
    createRedisConnection.mockReset();
  });

  it("requires Redis", () => {
    createRedisConnection.mockReturnValue(null);
    expect(() => createScheduleWorker()).toThrow("Redis is required before workers can start");
  });

  it("registers a single-concurrency schedules worker and failure listener", () => {
    createRedisConnection.mockReturnValue({ quit: vi.fn() });
    const worker = createScheduleWorker() as unknown as {
      name: string;
      on: ReturnType<typeof vi.fn>;
    };

    expect(worker.name).toBe("schedules");
    expect(worker.on).toHaveBeenCalledWith("failed", expect.any(Function));
  });
});
