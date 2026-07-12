import { type Worker } from "bullmq";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";

import {
  createFlushClient,
  describeRedis,
  shutdownJobQueues
} from "#@/__tests__/redis-test-helpers";
import { enqueueTemplateEmail, getQueue, QUEUE_NAMES } from "#@/queues";
import {
  closeWorkers,
  createEmailWorker,
  createNotificationWorker,
  createWorkers
} from "#@/worker";

const runTemplateEmail = vi.fn();
const createNotifications = vi.fn();

vi.mock("#@/template-email", () => {
  return {
    runTemplateEmail: (...args: unknown[]) => runTemplateEmail(...args)
  };
});

vi.mock("@saasweave/db", () => {
  return {
    createNotifications: (...args: unknown[]) => createNotifications(...args)
  };
});

async function waitForJobState(
  jobId: string,
  queueName: (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES],
  state: "completed" | "failed"
): Promise<void> {
  const queue = getQueue(queueName);

  await vi.waitFor(
    async () => {
      const job = await queue.getJob(jobId);
      expect(job).not.toBeNull();
      await expect(job?.getState()).resolves.toBe(state);
    },
    { interval: 50, timeout: 10_000 }
  );
}

describeRedis("workers with Redis", () => {
  let flushClient: ReturnType<typeof createFlushClient>;
  const activeWorkers: Worker[] = [];

  beforeAll(async () => {
    flushClient = createFlushClient();
    await flushClient.ping();
  });

  beforeEach(async () => {
    await closeWorkers(activeWorkers);
    activeWorkers.length = 0;
    await shutdownJobQueues();
    await flushClient.flushdb();
    runTemplateEmail.mockReset();
    createNotifications.mockReset();
    runTemplateEmail.mockResolvedValue(undefined);
    createNotifications.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await closeWorkers(activeWorkers);
    activeWorkers.length = 0;
    await shutdownJobQueues();
  });

  afterAll(async () => {
    await flushClient.quit();
  });

  it("creates email and notification workers", () => {
    const workers = createWorkers();
    expect(workers).toHaveLength(2);
    expect(workers.map((worker) => worker.name)).toEqual([
      QUEUE_NAMES.EMAIL,
      QUEUE_NAMES.NOTIFICATIONS
    ]);
  });

  it("processes enqueued template email jobs end to end", async () => {
    const worker = createEmailWorker();
    activeWorkers.push(worker);

    const job = await enqueueTemplateEmail({
      key: "welcome",
      meta: { organizationId: "org_1" },
      to: "user@example.com",
      values: { name: "Ada" }
    });

    await waitForJobState(job.id!, QUEUE_NAMES.EMAIL, "completed");
    expect(runTemplateEmail).toHaveBeenCalledWith(
      "welcome",
      "user@example.com",
      { name: "Ada" },
      { organizationId: "org_1" }
    );
  });

  it("fails unknown email job names so BullMQ can surface the error", async () => {
    const worker = createEmailWorker();
    activeWorkers.push(worker);
    const queue = getQueue(QUEUE_NAMES.EMAIL);
    const job = await queue.add(
      "unknown-email-job",
      { key: "welcome", to: "user@example.com" },
      { attempts: 1 }
    );

    await waitForJobState(job.id!, QUEUE_NAMES.EMAIL, "failed");
    expect(runTemplateEmail).not.toHaveBeenCalled();

    const failedJob = await queue.getJob(job.id!);
    expect(failedJob?.failedReason).toContain("Unknown email job: unknown-email-job");
  }, 15_000);

  it("processes enqueued notification jobs through createNotifications", async () => {
    const worker = createNotificationWorker();
    activeWorkers.push(worker);
    const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
    const data = {
      audience: { kind: "user" as const, userId: "user_1" },
      organizationId: "org_1",
      title: "Hello",
      type: "info"
    };

    const job = await queue.add("create", data);
    await waitForJobState(job.id!, QUEUE_NAMES.NOTIFICATIONS, "completed");
    expect(createNotifications).toHaveBeenCalledWith(data);
  });

  it("fails unknown notification job names", async () => {
    const worker = createNotificationWorker();
    activeWorkers.push(worker);
    const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
    const job = await queue.add(
      "unknown-notification-job",
      {
        audience: { kind: "user", userId: "user_1" },
        organizationId: "org_1",
        title: "Hello",
        type: "info"
      },
      { attempts: 1 }
    );

    await waitForJobState(job.id!, QUEUE_NAMES.NOTIFICATIONS, "failed");

    const failedJob = await queue.getJob(job.id!);
    expect(failedJob?.failedReason).toContain("Unknown notification job: unknown-notification-job");
  }, 15_000);
});
