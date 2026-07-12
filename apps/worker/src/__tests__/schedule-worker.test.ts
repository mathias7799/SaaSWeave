import { type Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { SCHEDULE_JOB_NAMES } from "@saasweave/jobs/queues";
import { createScheduleWorker, processScheduleJob } from "@saasweave/jobs/schedule-worker";

const computeCurrentMrr = vi.fn();
const runMediaLifecycleCleanup = vi.fn();
const runDataExportCleanup = vi.fn();
const expireStaleInvitations = vi.fn();
const runDataRetention = vi.fn();

vi.mock("@saasweave/app/billing/compute-current-mrr", () => {
  return {
    computeCurrentMrr: (...args: unknown[]) => computeCurrentMrr(...args)
  };
});

vi.mock("@saasweave/app/storage/media-cleanup", () => {
  return {
    runDataExportCleanup: (...args: unknown[]) => runDataExportCleanup(...args),
    runMediaLifecycleCleanup: (...args: unknown[]) => runMediaLifecycleCleanup(...args)
  };
});

vi.mock("@saasweave/jobs/maintenance", () => {
  return {
    expireStaleInvitations: (...args: unknown[]) => expireStaleInvitations(...args)
  };
});

vi.mock("@saasweave/jobs/retention", () => {
  return {
    runDataRetention: (...args: unknown[]) => runDataRetention(...args)
  };
});

vi.mock("@saasweave/db", () => {
  return {
    upsertMrrSnapshot: vi.fn()
  };
});

vi.mock("@saasweave/cache", () => {
  return {
    createRedisConnection: vi.fn(() => {
      return {
        quit: vi.fn()
      };
    })
  };
});

vi.mock("bullmq", () => {
  class Worker {
    name: string;
    on = vi.fn();
    close = vi.fn();
    constructor(name: string) {
      this.name = name;
    }
  }
  return { Worker };
});

function buildScheduleJob(name: string): Job {
  return {
    id: "job_schedule_1",
    name,
    queueName: "schedules"
  } as Job;
}

describe("processScheduleJob", () => {
  beforeEach(() => {
    computeCurrentMrr.mockReset();
    runMediaLifecycleCleanup.mockReset();
    runDataExportCleanup.mockReset();
    expireStaleInvitations.mockReset();
    runDataRetention.mockReset();
    expireStaleInvitations.mockResolvedValue(2);
    runMediaLifecycleCleanup.mockResolvedValue({ expiredPendingUploads: 1 });
    runDataExportCleanup.mockResolvedValue({ expiredExports: 1 });
    computeCurrentMrr.mockResolvedValue({
      activeOrgs: 1,
      churnedMrr: null,
      currency: "usd",
      mrr: 100,
      newMrr: 10
    });
    runDataRetention.mockResolvedValue({ summary: { totalDeleted: 3 } });
  });

  it("expires stale invitations", async () => {
    const result = await processScheduleJob(
      buildScheduleJob(SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS)
    );
    expect(result).toEqual({ count: 2 });
  });

  it("rejects unknown schedule jobs", async () => {
    await expect(processScheduleJob(buildScheduleJob("unknown"))).rejects.toThrow(
      "Unknown schedule job: unknown"
    );
  });
});

describe("createScheduleWorker", () => {
  it("creates a schedules worker", () => {
    const worker = createScheduleWorker();
    expect(worker.name).toBe("schedules");
  });
});
