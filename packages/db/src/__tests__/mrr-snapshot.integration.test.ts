import { beforeEach, describe, expect, it } from "vite-plus/test";

import { listMrrSnapshots, upsertMrrSnapshot } from "@saasweave/db";

import { resetDb } from "./db-harness";

describe.sequential("mrr-snapshot", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("upserts monthly snapshots and lists them newest first", async () => {
    await upsertMrrSnapshot({
      activeOrgs: 10,
      churnedMrr: 100,
      currency: "USD",
      mrr: 5_000,
      newMrr: 500,
      periodMonth: "2026-05"
    });
    await upsertMrrSnapshot({
      activeOrgs: 12,
      churnedMrr: 50,
      currency: "USD",
      mrr: 5_500,
      newMrr: 600,
      periodMonth: "2026-06"
    });
    await upsertMrrSnapshot({
      activeOrgs: 15,
      churnedMrr: null,
      currency: "USD",
      mrr: 6_000,
      newMrr: 700,
      periodMonth: "2026-06"
    });

    const snapshots = await listMrrSnapshots(5);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.periodMonth).toBe("2026-06");
    expect(snapshots[0]?.mrr).toBe(6_000);
    expect(snapshots[0]?.activeOrgs).toBe(15);
    expect(snapshots[1]?.periodMonth).toBe("2026-05");
  });
});
