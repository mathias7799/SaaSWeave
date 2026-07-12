import { type Worker } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { type WorkerRuntime } from "#@/index";

const closeAllWorkers = vi.fn();
const closeQueues = vi.fn();
const closeRedis = vi.fn();
const refreshQueueMetrics = vi.fn();
const runtimeWorkerHandlers = new Map<string, () => void>();
const runtimeWorker = {
  name: "runtime-worker",
  on: vi.fn((event: string, handler: () => void) => runtimeWorkerHandlers.set(event, handler))
};

vi.mock("@saasweave/jobs/worker", () => {
  return {
    closeAllWorkers: (...args: unknown[]) => closeAllWorkers(...args),
    createAllWorkers: vi.fn(() => [runtimeWorker])
  };
});
vi.mock("@saasweave/jobs/queues", () => {
  return {
    closeQueues: (...args: unknown[]) => closeQueues(...args)
  };
});
vi.mock("@saasweave/jobs/queue-metrics", () => {
  return { refreshQueueMetrics: (...args: unknown[]) => refreshQueueMetrics(...args) };
});
vi.mock("@saasweave/cache", () => {
  return {
    closeRedis: (...args: unknown[]) => closeRedis(...args)
  };
});
vi.mock("#@/schedules", () => {
  return {
    registerSchedules: vi.fn().mockResolvedValue([])
  };
});
vi.mock("#@/health-server", () => {
  return {
    closeWorkerHealthServer: vi.fn().mockResolvedValue(undefined),
    createWorkerHealthServer: vi.fn(() => {
      return { close: vi.fn() };
    })
  };
});

const {
  getWorkerReadinessInput,
  resetWorkerShutdownState,
  runShutdownWorkerRuntime,
  setWorkerAcceptingTraffic,
  shutdownWorkerRuntime
} = await import("#@/index");

function buildRuntime(): WorkerRuntime {
  return {
    registeredSchedules: [],
    workers: [{ close: vi.fn() } as unknown as Worker]
  };
}

describe("shutdownWorkerRuntime", () => {
  beforeEach(() => {
    resetWorkerShutdownState();
    closeAllWorkers.mockReset();
    closeQueues.mockReset();
    closeRedis.mockReset();
    closeAllWorkers.mockResolvedValue(undefined);
    closeQueues.mockResolvedValue(undefined);
    closeRedis.mockResolvedValue(undefined);
    refreshQueueMetrics.mockResolvedValue(undefined);
  });

  it("closes all workers, queues, and redis once", async () => {
    const runtime = buildRuntime();

    await shutdownWorkerRuntime(runtime, "SIGTERM");

    expect(closeAllWorkers).toHaveBeenCalledWith(runtime.workers);
    expect(closeQueues).toHaveBeenCalledOnce();
    expect(closeRedis).toHaveBeenCalledOnce();
  });

  it("ignores duplicate shutdown attempts", async () => {
    const runtime = buildRuntime();

    await shutdownWorkerRuntime(runtime, "SIGINT");
    await shutdownWorkerRuntime(runtime, "SIGINT");

    expect(closeAllWorkers).toHaveBeenCalledOnce();
    expect(closeQueues).toHaveBeenCalledOnce();
  });

  it("reports traffic state and refreshes heartbeat from worker outcomes", () => {
    setWorkerAcceptingTraffic(true);
    const before = getWorkerReadinessInput();

    runtimeWorkerHandlers.get("completed")?.();
    runtimeWorkerHandlers.get("failed")?.();
    const after = getWorkerReadinessInput();

    expect(before.acceptingTraffic).toBe(true);
    expect(after.workers).toContain(runtimeWorker);
    expect(after.heartbeatAt).toBeGreaterThanOrEqual(before.heartbeatAt);
  });
});

describe("runShutdownWorkerRuntime", () => {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  beforeEach(() => {
    resetWorkerShutdownState();
    exitSpy.mockClear();
    closeAllWorkers.mockReset();
    closeQueues.mockReset();
    closeRedis.mockReset();
    closeAllWorkers.mockResolvedValue(undefined);
    closeQueues.mockResolvedValue(undefined);
    closeRedis.mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exits with code 0 after a successful shutdown", async () => {
    const runtime = buildRuntime();
    const runPromise = runShutdownWorkerRuntime(runtime, "SIGTERM");
    await vi.runAllTimersAsync();
    await runPromise;

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("exits with code 1 when shutdown exceeds the timeout", async () => {
    const runtime = buildRuntime();
    closeAllWorkers.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );

    const runPromise = runShutdownWorkerRuntime(runtime, "SIGTERM");
    await vi.advanceTimersByTimeAsync(15_000);
    await runPromise;

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
