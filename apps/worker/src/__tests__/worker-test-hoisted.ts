import { vi } from "vite-plus/test";

export type MockWorkerInstance = {
  close: ReturnType<typeof vi.fn>;
  name: string;
  on: ReturnType<typeof vi.fn>;
  opts: Record<string, unknown>;
  processor: (job: unknown) => Promise<unknown>;
};

const workerMocks = vi.hoisted(() => {
  const instances: MockWorkerInstance[] = [];
  const redisConnection = {
    quit: vi.fn().mockResolvedValue(undefined)
  };

  function resetMocks(): void {
    instances.length = 0;
    redisConnection.quit.mockReset();
    redisConnection.quit.mockResolvedValue(undefined);
  }

  return {
    mockRedisConnection: redisConnection,
    mockWorkerInstances: instances,
    resetWorkerTestMocks: resetMocks
  };
});

export const { mockRedisConnection, mockWorkerInstances, resetWorkerTestMocks } = workerMocks;

vi.mock("bullmq", () => {
  class MockWorker {
    close = vi.fn().mockResolvedValue(undefined);
    name: string;
    on = vi.fn();
    opts: Record<string, unknown>;
    processor: (job: unknown) => Promise<unknown>;

    constructor(
      queueName: string,
      processor: (job: unknown) => Promise<unknown>,
      opts: Record<string, unknown>
    ) {
      this.name = queueName;
      this.processor = processor;
      this.opts = opts;
      workerMocks.mockWorkerInstances.push(this as MockWorkerInstance);
    }
  }

  return { Worker: MockWorker };
});

vi.mock("@saasweave/cache", () => {
  return {
    closeRedis: vi.fn().mockResolvedValue(undefined),
    createRedisConnection: vi.fn(() => workerMocks.mockRedisConnection),
    isRedisEnabled: vi.fn(() => true)
  };
});
