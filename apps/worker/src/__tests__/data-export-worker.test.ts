import { type Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDataExportWorker, processDataExportQueueJob } from "@saasweave/jobs/domain-workers";
import { QUEUE_NAMES, type DataExportJobData } from "@saasweave/jobs/queues";

const runDataExportJob = vi.fn();

vi.mock("@saasweave/jobs/data-export-job", () => {
  return {
    runDataExportJob: (...args: unknown[]) => runDataExportJob(...args)
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

function buildDataExportJob(): Job<DataExportJobData> {
  return {
    data: { requestId: "export_1" },
    id: "job_export_1",
    name: "process",
    queueName: QUEUE_NAMES.DATA_EXPORT
  } as Job<DataExportJobData>;
}

describe("processDataExportQueueJob", () => {
  beforeEach(() => {
    runDataExportJob.mockReset();
    runDataExportJob.mockResolvedValue(undefined);
  });

  it("rejects unknown job names", async () => {
    const job = Object.assign(buildDataExportJob(), { name: "replay" }) as Job<DataExportJobData>;
    await expect(processDataExportQueueJob(job)).rejects.toThrow("Unknown data export job: replay");
  });

  it("delegates to the data export orchestrator", async () => {
    await processDataExportQueueJob(buildDataExportJob());
    expect(runDataExportJob).toHaveBeenCalledWith("export_1");
  });
});

describe("createDataExportWorker", () => {
  it("registers a BullMQ worker on the data-export queue", () => {
    const worker = createDataExportWorker();
    expect(worker.name).toBe(QUEUE_NAMES.DATA_EXPORT);
  });
});
