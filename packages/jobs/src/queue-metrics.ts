import {
  queueJobsActive,
  queueJobsDelayed,
  queueJobsFailed,
  queueJobsWaiting,
  queueOldestJobAgeSeconds
} from "@saasweave/observability";

import { getQueue, QUEUE_NAMES } from "#@/queues";

export async function refreshQueueMetrics(): Promise<void> {
  for (const name of Object.values(QUEUE_NAMES)) {
    const queue = getQueue(name);
    const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
    queueJobsWaiting.set({ queue: name }, counts.waiting ?? 0);
    queueJobsActive.set({ queue: name }, counts.active ?? 0);
    queueJobsDelayed.set({ queue: name }, counts.delayed ?? 0);
    queueJobsFailed.set({ queue: name }, counts.failed ?? 0);

    const [oldestWaiting, oldestDelayed] = await Promise.all([
      queue.getJobs(["waiting"], 0, 0, true),
      queue.getJobs(["delayed"], 0, 0, true)
    ]);
    const candidates = [...oldestWaiting, ...oldestDelayed]
      .map((job) => job.timestamp)
      .filter((timestamp): timestamp is number => typeof timestamp === "number");
    const oldest = candidates.length > 0 ? Math.min(...candidates) : 0;
    const ageSeconds = oldest > 0 ? (Date.now() - oldest) / 1000 : 0;
    queueOldestJobAgeSeconds.set({ queue: name }, ageSeconds);
  }
}
