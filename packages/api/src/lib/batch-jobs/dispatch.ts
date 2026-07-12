import { processBatchJob } from "@saasweave/app/batch-jobs/process";
import { isRedisEnabled } from "@saasweave/cache";
import { enqueueBatchJob } from "@saasweave/jobs/queues";
import { createLogger } from "@saasweave/logger/server";

const log = createLogger({ operation: "api__batch_jobs_dispatch" });

/** Enqueue or run inline a batch job processor. Never throws into the caller. */
export async function dispatchBatchJob(batchJobId: string): Promise<void> {
  try {
    if (isRedisEnabled()) {
      await enqueueBatchJob({ batchJobId });
      return;
    }
    await processBatchJob(batchJobId);
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      batchJobId,
      event: "job_dispatch_failed",
      job: "batch-jobs.process",
      mode: isRedisEnabled() ? "queue" : "inline"
    });
  }
}
