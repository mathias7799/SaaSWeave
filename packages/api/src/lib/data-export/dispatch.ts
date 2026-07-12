import { isRedisEnabled } from "@saasweave/cache";
import { runDataExportJob } from "@saasweave/jobs/data-export-job";
import { enqueueDataExport } from "@saasweave/jobs/queues";
import { createLogger } from "@saasweave/logger/server";

const log = createLogger({ operation: "api__data_export_dispatch" });

/** Enqueue or run inline a workspace data export job. Never throws into the caller. */
export async function dispatchDataExport(requestId: string): Promise<void> {
  try {
    if (isRedisEnabled()) {
      await enqueueDataExport({ requestId });
      return;
    }
    await runDataExportJob(requestId);
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      event: "job_dispatch_failed",
      job: "data-export.process",
      mode: isRedisEnabled() ? "queue" : "inline",
      requestId
    });
  }
}
