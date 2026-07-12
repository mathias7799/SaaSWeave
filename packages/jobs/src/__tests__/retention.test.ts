import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const runRetentionPurgePass = vi.fn();
const clean = vi.fn();
const retentionInc = vi.fn();

vi.mock("@saasweave/db", () => {
  return { runRetentionPurgePass: (...args: unknown[]) => runRetentionPurgePass(...args) };
});

vi.mock("@saasweave/observability", () => {
  return {
    retentionPurgedRowsTotal: { inc: (...args: unknown[]) => retentionInc(...args) }
  };
});

vi.mock("#@/queues", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getQueue: () => {
      return { clean };
    }
  };
});

const { runDataRetention, trimBullMqHistory } = await import("#@/retention/index");

describe("BullMQ history retention", () => {
  beforeEach(() => {
    clean.mockReset();
    clean.mockResolvedValue([]);
  });

  it("cleans completed and failed history for every queue with the requested grace period", async () => {
    clean.mockImplementation(async (_grace, _limit, state) =>
      state === "completed" ? ["one", "two"] : ["failed"]
    );

    const result = await trimBullMqHistory(2);

    expect(clean).toHaveBeenCalledTimes(Object.keys(result).length * 2);
    expect(clean).toHaveBeenCalledWith(2 * 24 * 60 * 60 * 1_000, 1_000, "completed");
    expect(
      Object.values(result).every((entry) => entry.completed === 2 && entry.failed === 1)
    ).toBe(true);
  });
});

describe("data retention orchestration", () => {
  beforeEach(() => {
    clean.mockReset();
    clean.mockResolvedValue([]);
    retentionInc.mockReset();
    runRetentionPurgePass.mockReset();
  });

  it("passes explicit policy, records deleted-class metrics, and returns queue cleanup", async () => {
    runRetentionPurgePass.mockResolvedValue({
      classes: [
        { class: "audit", deleted: 3, dryRun: false },
        { class: "notifications", deleted: 0, dryRun: false }
      ],
      totalDeleted: 3
    });
    const deleteDataExportObject = vi.fn();

    const result = await runDataRetention({
      deleteDataExportObject,
      dryRun: false,
      legalHoldOrgIds: ["org_hold"]
    });

    expect(runRetentionPurgePass).toHaveBeenCalledWith(
      expect.objectContaining({
        deleteDataExportObject,
        dryRun: false,
        legalHoldOrgIds: ["org_hold"]
      })
    );
    expect(retentionInc).toHaveBeenCalledWith({ class: "audit", dry_run: "false" }, 3);
    expect(retentionInc).toHaveBeenCalledTimes(1);
    expect(result.summary.totalDeleted).toBe(3);
  });

  it("uses environment defaults and parses legal-hold organization ids", async () => {
    runRetentionPurgePass.mockResolvedValue({ classes: [], totalDeleted: 0 });

    await runDataRetention();

    expect(runRetentionPurgePass).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: expect.any(Boolean), legalHoldOrgIds: expect.any(Array) })
    );
  });
});
