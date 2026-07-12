import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const registerRepeatableSchedules = vi.fn();

vi.mock("@saasweave/jobs/schedules", () => {
  return {
    registerRepeatableSchedules: (...args: unknown[]) => registerRepeatableSchedules(...args)
  };
});

const { registerSchedules } = await import("#@/schedules");

describe("registerSchedules", () => {
  beforeEach(() => {
    registerRepeatableSchedules.mockReset();
  });

  it("returns registered repeatable schedule job names", async () => {
    registerRepeatableSchedules.mockResolvedValue(["expire-invitations", "snapshot-mrr"]);

    await expect(registerSchedules()).resolves.toEqual(["expire-invitations", "snapshot-mrr"]);
    expect(registerRepeatableSchedules).toHaveBeenCalledOnce();
  });

  it("returns an empty list when no schedules are registered", async () => {
    registerRepeatableSchedules.mockResolvedValue([]);

    await expect(registerSchedules()).resolves.toEqual([]);
  });
});
