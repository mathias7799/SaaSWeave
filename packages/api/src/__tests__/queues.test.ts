import { describe, expect, it } from "vite-plus/test";

import { QUEUE_NAMES, SCHEDULE_JOB_NAMES } from "@saasweave/jobs/queues";

describe("job queues", () => {
  it("registers all worker queues", () => {
    expect(QUEUE_NAMES.EMAIL).toBe("email");
    expect(QUEUE_NAMES.NOTIFICATIONS).toBe("notifications");
    expect(QUEUE_NAMES.STRIPE).toBe("stripe");
    expect(QUEUE_NAMES.WEBHOOKS).toBe("webhooks");
    expect(QUEUE_NAMES.SCHEDULES).toBe("schedules");
  });

  it("names repeatable maintenance jobs", () => {
    expect(SCHEDULE_JOB_NAMES.EXPIRE_INVITATIONS).toBe("expire-invitations");
  });
});
