import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@saasweave/cache", () => {
  return {
    checkRedisReady: vi.fn(async () => {
      return { configured: true, status: "healthy" };
    })
  };
});

vi.mock("@saasweave/db", () => {
  return {
    checkIsDbReady: vi.fn(async () => true)
  };
});

vi.mock("#@/queues", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getQueue: vi.fn(() => {
      return {
        getJobCounts: vi.fn(async () => {
          return { waiting: 0, active: 0 };
        })
      };
    })
  };
});

import { evaluateWorkerReadiness } from "#@/worker-readiness";

function buildWorker(running: boolean) {
  return { isRunning: () => running, name: "test-queue" } as never;
}

const registeredSchedules = [
  "expire-invitations",
  "snapshot-mrr",
  "cleanup-storage",
  "data-retention",
  "refresh-platform-analytics"
];

describe("evaluateWorkerReadiness", () => {
  it("returns unhealthy when draining traffic", async () => {
    const result = await evaluateWorkerReadiness({
      acceptingTraffic: false,
      heartbeatAt: Date.now(),
      registeredSchedules,
      workers: [buildWorker(true)]
    });

    expect(result.checks.acceptingTraffic.status).toBe("unhealthy");
    expect(result.status).toBe("unhealthy");
  });

  it("returns unhealthy when schedulers are missing", async () => {
    const result = await evaluateWorkerReadiness({
      acceptingTraffic: true,
      heartbeatAt: Date.now(),
      registeredSchedules: ["expire-invitations"],
      workers: [buildWorker(true)]
    });

    expect(result.checks.schedulers.status).toBe("unhealthy");
  });

  it("returns unhealthy when heartbeat is stale", async () => {
    const result = await evaluateWorkerReadiness({
      acceptingTraffic: true,
      heartbeatAt: Date.now() - 300_000,
      registeredSchedules,
      workers: [buildWorker(true)]
    });

    expect(result.checks.heartbeat.status).toBe("unhealthy");
  });

  it("returns healthy when all checks pass", async () => {
    const result = await evaluateWorkerReadiness({
      acceptingTraffic: true,
      heartbeatAt: Date.now(),
      registeredSchedules,
      workers: [buildWorker(true)]
    });

    expect(result.status).toBe("healthy");
    expect(result.checks.redis.status).toBe("healthy");
    expect(result.checks.database.status).toBe("healthy");
  });
});
