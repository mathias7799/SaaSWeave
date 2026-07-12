import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const db = vi.hoisted(() => {
  return {
    claim: vi.fn(),
    getJob: vi.fn(),
    increment: vi.fn(),
    isCanceled: vi.fn(),
    release: vi.fn(),
    updateItem: vi.fn(),
    updateJob: vi.fn()
  };
});

vi.mock("@saasweave/db", () => {
  return {
    claimBatchJobItems: db.claim,
    getBatchJobById: db.getJob,
    incrementBatchJobProgress: db.increment,
    isBatchJobCanceled: db.isCanceled,
    releaseExpiredBatchJobLeases: db.release,
    updateBatchJobItemStatus: db.updateItem,
    updateBatchJobStatus: db.updateJob
  };
});

vi.mock("@saasweave/logger/server", () => {
  return {
    createLogger: () => {
      return { info: vi.fn(), warn: vi.fn() };
    }
  };
});

import { processBatchItem } from "#@/batch-jobs/handlers";
import { processBatchJob } from "#@/batch-jobs/process";

const baseJob = {
  completedItems: 0,
  failedItems: 0,
  id: "job-1",
  status: "pending",
  type: "uppercase"
};

describe("batch application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.claim.mockResolvedValue([]);
    db.increment.mockResolvedValue(undefined);
    db.isCanceled.mockResolvedValue(false);
    db.release.mockResolvedValue(0);
    db.updateItem.mockResolvedValue(undefined);
    db.updateJob.mockResolvedValue(undefined);
  });

  it("validates and processes supported item types", () => {
    expect(processBatchItem("uppercase", { text: "Hello" })).toEqual({ text: "HELLO" });
    expect(() => processBatchItem("uppercase", { text: 1 })).toThrow(/expected string/i);
    expect(() => processBatchItem("unsupported" as "uppercase", {})).toThrow(
      "Unsupported batch job type"
    );
  });

  it("returns for missing and terminal jobs", async () => {
    db.getJob.mockResolvedValueOnce(null);
    await expect(processBatchJob("missing")).resolves.toBeUndefined();
    expect(db.updateJob).not.toHaveBeenCalled();

    for (const status of ["completed", "failed", "canceled"]) {
      db.getJob.mockResolvedValueOnce({ ...baseJob, status });
      await expect(processBatchJob(`job-${status}`)).resolves.toBeUndefined();
    }
  });

  it("claims, completes, and counts a valid chunk", async () => {
    db.getJob
      .mockResolvedValueOnce(baseJob)
      .mockResolvedValueOnce({ ...baseJob, completedItems: 1, status: "processing" });
    db.claim
      .mockResolvedValueOnce([{ id: "item-1", input: { text: "hello" } }])
      .mockResolvedValueOnce([]);

    await processBatchJob("job-1");

    expect(db.updateItem).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ output: { text: "HELLO" }, status: "completed" })
    );
    expect(db.increment).toHaveBeenCalledWith("job-1", { completed: 1 });
    expect(db.updateJob).toHaveBeenLastCalledWith("job-1", {
      error: null,
      status: "completed"
    });
  });

  it("retries invalid items three times and fails an all-failed job", async () => {
    db.getJob
      .mockResolvedValueOnce(baseJob)
      .mockResolvedValueOnce({ ...baseJob, failedItems: 1, status: "processing" });
    db.claim.mockResolvedValueOnce([{ id: "item-1", input: {} }]).mockResolvedValueOnce([]);

    await processBatchJob("job-1");

    expect(db.updateItem).toHaveBeenCalledTimes(4);
    expect(db.increment).toHaveBeenCalledWith("job-1", { failed: 1 });
    expect(db.updateJob).toHaveBeenLastCalledWith("job-1", {
      error: "All batch items failed",
      status: "failed"
    });
  });

  it("completes an empty job and stops promptly when canceled", async () => {
    db.getJob.mockResolvedValueOnce(baseJob).mockResolvedValueOnce(baseJob);
    await processBatchJob("job-1");
    expect(db.updateJob).toHaveBeenLastCalledWith("job-1", {
      error: null,
      status: "completed"
    });

    vi.clearAllMocks();
    db.getJob.mockResolvedValueOnce(baseJob);
    db.isCanceled.mockResolvedValueOnce(true);
    await processBatchJob("job-canceled");
    expect(db.claim).not.toHaveBeenCalled();
  });
});
