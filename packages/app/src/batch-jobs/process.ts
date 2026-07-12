import { randomUUID } from "node:crypto";

import {
  BATCH_JOB_CHUNK_SIZE,
  BATCH_JOB_LEASE_SECONDS
} from "@saasweave/core/batch-jobs/constants";
import { type BatchJobType } from "@saasweave/core/batch-jobs/types";
import {
  claimBatchJobItems,
  getBatchJobById,
  incrementBatchJobProgress,
  isBatchJobCanceled,
  releaseExpiredBatchJobLeases,
  updateBatchJobItemStatus,
  updateBatchJobStatus
} from "@saasweave/db";
import { createLogger } from "@saasweave/logger/server";

import { ITEM_PROCESS_MAX_ATTEMPTS, processBatchItem } from "#@/batch-jobs/handlers";

const log = createLogger({ operation: "app__batch_jobs" });

export async function processBatchJob(batchJobId: string): Promise<void> {
  const job = await getBatchJobById(batchJobId);
  if (!job) {
    log.warn("Batch job not found", { batchJobId, event: "batch_job_missing" });
    return;
  }

  if (job.status === "completed" || job.status === "failed" || job.status === "canceled") {
    return;
  }

  await updateBatchJobStatus(batchJobId, { status: "processing" });

  const workerId = randomUUID();
  let claimedTotal = 0;

  while (true) {
    if (await isBatchJobCanceled(batchJobId)) {
      log.info("Batch job canceled; stopping chunk claims", {
        batchJobId,
        event: "batch_job_canceled"
      });
      return;
    }

    await releaseExpiredBatchJobLeases(batchJobId);

    const chunk = await claimBatchJobItems({
      batchJobId,
      chunkSize: BATCH_JOB_CHUNK_SIZE,
      leaseSeconds: BATCH_JOB_LEASE_SECONDS,
      workerId
    });

    if (chunk.length === 0) {
      break;
    }

    claimedTotal += chunk.length;
    let completedInChunk = 0;
    let failedInChunk = 0;

    for (const item of chunk) {
      let succeeded = false;
      let lastError: string | null = null;

      for (let attempt = 1; attempt <= ITEM_PROCESS_MAX_ATTEMPTS && !succeeded; attempt += 1) {
        await updateBatchJobItemStatus(item.id, {
          attempts: attempt,
          status: "processing"
        });

        try {
          const output = processBatchItem(job.type as BatchJobType, item.input);
          await updateBatchJobItemStatus(item.id, {
            attempts: attempt,
            claimedAt: null,
            error: null,
            leaseExpiresAt: null,
            output,
            status: "completed",
            workerId: null
          });
          succeeded = true;
          completedInChunk += 1;
        } catch (error) {
          lastError = error instanceof Error ? error.message : "item_processing_failed";
        }
      }

      if (!succeeded) {
        await updateBatchJobItemStatus(item.id, {
          error: lastError,
          claimedAt: null,
          leaseExpiresAt: null,
          status: "failed",
          workerId: null
        });
        failedInChunk += 1;
      }
    }

    if (completedInChunk > 0) {
      await incrementBatchJobProgress(batchJobId, { completed: completedInChunk });
    }
    if (failedInChunk > 0) {
      await incrementBatchJobProgress(batchJobId, { failed: failedInChunk });
    }
  }

  if (await isBatchJobCanceled(batchJobId)) {
    return;
  }

  const finalJob = await getBatchJobById(batchJobId);
  if (!finalJob || finalJob.status === "canceled") {
    return;
  }

  if (claimedTotal === 0 && finalJob.completedItems === 0 && finalJob.failedItems === 0) {
    await updateBatchJobStatus(batchJobId, { error: null, status: "completed" });
    return;
  }

  if (finalJob.failedItems > 0 && finalJob.completedItems === 0) {
    await updateBatchJobStatus(batchJobId, {
      error: "All batch items failed",
      status: "failed"
    });
    return;
  }

  await updateBatchJobStatus(batchJobId, { error: null, status: "completed" });
}
