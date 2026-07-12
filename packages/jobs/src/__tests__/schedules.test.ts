import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vite-plus/test";

import {
  createFlushClient,
  describeRedis,
  shutdownJobQueues
} from "#@/__tests__/redis-test-helpers";
import { getQueue, QUEUE_NAMES, SCHEDULE_JOB_NAMES } from "#@/queues";
import { registerRepeatableSchedules } from "#@/schedules";

describe("schedule job names", () => {
  it("defines invitation expiry schedule", async () => {
    const { SCHEDULE_JOB_NAMES: names } = await import("#@/queues");
    expect(names.EXPIRE_INVITATIONS).toBe("expire-invitations");
  });

  it("defines MRR snapshot schedule", async () => {
    const { SCHEDULE_JOB_NAMES: names } = await import("#@/queues");
    expect(names.SNAPSHOT_MRR).toBe("snapshot-mrr");
  });
});

describe("registerRepeatableSchedules without Redis", () => {
  beforeEach(() => {
    vi.stubEnv("REDIS_URL", "");
    vi.resetModules();
  });

  it("skips schedule registration when Redis is not configured", async () => {
    const { registerRepeatableSchedules: register } = await import("#@/schedules");
    await expect(register()).resolves.toEqual([]);
  });
});

describeRedis("registerRepeatableSchedules with Redis", () => {
  let flushClient: ReturnType<typeof createFlushClient>;

  beforeAll(async () => {
    flushClient = createFlushClient();
    await flushClient.ping();
  });

  beforeEach(async () => {
    await shutdownJobQueues();
    await flushClient.flushdb();
  });

  afterEach(async () => {
    await shutdownJobQueues();
  });

  afterAll(async () => {
    await flushClient.quit();
  });

  it("upserts repeatable schedulers for maintenance jobs", async () => {
    const registered = await registerRepeatableSchedules();

    expect(registered).toEqual([
      SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS,
      SCHEDULE_JOB_NAMES.SNAPSHOT_MRR,
      SCHEDULE_JOB_NAMES.CLEANUP_STORAGE,
      SCHEDULE_JOB_NAMES.DATA_RETENTION,
      SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS
    ]);

    const schedulers = await getQueue(QUEUE_NAMES.SCHEDULES).getJobSchedulers();
    const schedulerNames = schedulers.map((entry) => entry.name);
    // eslint-disable-next-line unicorn/no-array-sort -- toSorted needs es2023 lib not configured here
    expect([...schedulerNames].sort()).toEqual([
      SCHEDULE_JOB_NAMES.CLEANUP_STORAGE,
      SCHEDULE_JOB_NAMES.DATA_RETENTION,
      SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS,
      SCHEDULE_JOB_NAMES.REFRESH_PLATFORM_ANALYTICS,
      SCHEDULE_JOB_NAMES.SNAPSHOT_MRR
    ]);
  });

  it("is safe to call repeatedly on worker startup", async () => {
    const first = await registerRepeatableSchedules();
    const second = await registerRepeatableSchedules();

    expect(second).toEqual(first);

    const schedulers = await getQueue(QUEUE_NAMES.SCHEDULES).getJobSchedulers();
    expect(schedulers).toHaveLength(5);
  });
});
