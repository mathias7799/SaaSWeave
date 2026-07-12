import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const createRedisConnection = vi.fn();
const observe = vi.fn();
const retriesInc = vi.fn();
const logger = { error: vi.fn(), info: vi.fn() };

vi.mock("@saasweave/cache", () => {
  return { createRedisConnection: (...args: unknown[]) => createRedisConnection(...args) };
});
vi.mock("@saasweave/logger/server", () => {
  return { createLogger: () => logger };
});
vi.mock("@saasweave/observability", () => {
  return {
    jobDurationSeconds: { observe: (...args: unknown[]) => observe(...args) },
    jobRetriesTotal: { inc: (...args: unknown[]) => retriesInc(...args) }
  };
});

const { attachWorkerLogging, closeNamedWorker, createWorkerConnection, workerConnections } =
  await import("#@/worker-lifecycle");

function buildWorker() {
  const handlers = new Map<string, (...args: never[]) => void>();
  return {
    close: vi.fn().mockResolvedValue(undefined),
    handlers,
    on: vi.fn((name: string, handler: (...args: never[]) => void) => handlers.set(name, handler)),
    opts: {} as { connection?: unknown }
  };
}

describe("worker lifecycle logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records completed and failed durations, retries, and structured outcomes", () => {
    const worker = buildWorker();
    attachWorkerLogging(worker as never);
    const job = {
      attemptsMade: 2,
      id: "job_1",
      name: "deliver",
      processedOn: Date.now() - 500,
      queueName: "webhooks",
      timestamp: Date.now() - 1_000
    };

    worker.handlers.get("completed")?.(job as never);
    worker.handlers.get("failed")?.(job as never, new Error("failed") as never);
    worker.handlers.get("failed")?.(undefined as never, new Error("worker failed") as never);

    expect(observe).toHaveBeenCalledTimes(2);
    expect(retriesInc).toHaveBeenCalledWith({ name: "deliver", queue: "webhooks" });
    expect(logger.info).toHaveBeenCalledWith(
      "Background job completed",
      expect.objectContaining({ jobId: "job_1" })
    );
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});

describe("worker connections", () => {
  beforeEach(() => {
    createRedisConnection.mockReset();
  });

  it("creates the required Redis connection and rejects missing Redis", () => {
    const redis = { quit: vi.fn() };
    createRedisConnection.mockReturnValueOnce(redis).mockReturnValueOnce(null);

    expect(createWorkerConnection("worker:test")).toBe(redis);
    expect(() => createWorkerConnection("worker:test")).toThrow("Redis is required");
  });

  it("closes mapped and option-provided connections", async () => {
    const mapped = { quit: vi.fn().mockResolvedValue(undefined) };
    const mappedWorker = buildWorker();
    workerConnections.set(mappedWorker as never, mapped as never);
    await closeNamedWorker(mappedWorker as never);
    expect(mapped.quit).toHaveBeenCalledOnce();

    const fallback = { quit: vi.fn().mockResolvedValue(undefined) };
    const fallbackWorker = buildWorker();
    fallbackWorker.opts.connection = fallback;
    await closeNamedWorker(fallbackWorker as never);
    expect(fallback.quit).toHaveBeenCalledOnce();
  });
});
