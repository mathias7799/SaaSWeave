import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    enqueueBatchJob: vi.fn(),
    enqueueDataExport: vi.fn(),
    isRedisEnabled: vi.fn(),
    logError: vi.fn(),
    processBatchJob: vi.fn(),
    runDataExportJob: vi.fn()
  };
});

vi.mock("@saasweave/app/batch-jobs/process", () => {
  return {
    processBatchJob: mocks.processBatchJob
  };
});

vi.mock("@saasweave/cache", () => {
  return {
    isRedisEnabled: mocks.isRedisEnabled
  };
});

vi.mock("@saasweave/jobs/data-export-job", () => {
  return {
    runDataExportJob: mocks.runDataExportJob
  };
});

vi.mock("@saasweave/jobs/queues", () => {
  return {
    enqueueBatchJob: mocks.enqueueBatchJob,
    enqueueDataExport: mocks.enqueueDataExport
  };
});

vi.mock("@saasweave/logger/server", () => {
  return {
    createLogger: () => {
      return { error: mocks.logError };
    }
  };
});

import { dispatchBatchJob } from "#@/lib/batch-jobs/dispatch";
import { dispatchDataExport } from "#@/lib/data-export/dispatch";

describe("job dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues jobs when Redis is enabled", async () => {
    mocks.isRedisEnabled.mockReturnValue(true);

    await dispatchBatchJob("batch-1");
    await dispatchDataExport("export-1");

    expect(mocks.enqueueBatchJob).toHaveBeenCalledWith({
      batchJobId: "batch-1"
    });
    expect(mocks.enqueueDataExport).toHaveBeenCalledWith({
      requestId: "export-1"
    });
    expect(mocks.processBatchJob).not.toHaveBeenCalled();
    expect(mocks.runDataExportJob).not.toHaveBeenCalled();
  });

  it("runs jobs inline when Redis is disabled", async () => {
    mocks.isRedisEnabled.mockReturnValue(false);

    await dispatchBatchJob("batch-2");
    await dispatchDataExport("export-2");

    expect(mocks.processBatchJob).toHaveBeenCalledWith("batch-2");
    expect(mocks.runDataExportJob).toHaveBeenCalledWith("export-2");
  });

  it("logs queue failures without throwing into callers", async () => {
    const batchError = new Error("queue unavailable");
    mocks.isRedisEnabled.mockReturnValue(true);
    mocks.enqueueBatchJob.mockRejectedValueOnce(batchError);
    mocks.enqueueDataExport.mockRejectedValueOnce("export queue unavailable");

    await expect(dispatchBatchJob("batch-3")).resolves.toBeUndefined();
    await expect(dispatchDataExport("export-3")).resolves.toBeUndefined();

    expect(mocks.logError).toHaveBeenNthCalledWith(1, batchError, {
      batchJobId: "batch-3",
      event: "job_dispatch_failed",
      job: "batch-jobs.process",
      mode: "queue"
    });
    expect(mocks.logError).toHaveBeenNthCalledWith(2, "export queue unavailable", {
      event: "job_dispatch_failed",
      job: "data-export.process",
      mode: "queue",
      requestId: "export-3"
    });
  });
});
