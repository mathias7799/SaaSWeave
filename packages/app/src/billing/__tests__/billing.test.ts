import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    cacheInvalidateTag: vi.fn(),
    cacheWrap: vi.fn(),
    insertValues: vi.fn(),
    organizationRows: [] as Array<Record<string, unknown>>,
    planRows: [] as Array<Record<string, unknown>>,
    settings: { currency: "EUR" }
  };
});

vi.mock("drizzle-orm", () => {
  return { asc: vi.fn((value) => value) };
});
vi.mock("@saasweave/cache", () => {
  return {
    cacheInvalidateTag: mocks.cacheInvalidateTag,
    cacheWrap: mocks.cacheWrap
  };
});
vi.mock("@saasweave/db/schema", () => {
  return {
    organization: { createdAt: {}, planId: {}, subscriptionStatus: {} },
    plan: { id: {}, sortOrder: {} }
  };
});
vi.mock("@saasweave/db", () => {
  return {
    db: {
      insert: () => {
        return {
          values: (rows: unknown) => {
            mocks.insertValues(rows);
            return { onConflictDoNothing: vi.fn(async () => undefined) };
          }
        };
      },
      select: (selection?: Record<string, unknown>) => {
        return {
          from: () => {
            if (selection?.subscriptionStatus) return Promise.resolve(mocks.organizationRows);
            if (selection?.id) return { limit: async () => [] };
            return { orderBy: async () => mocks.planRows };
          }
        };
      }
    },
    getPlatformSettings: vi.fn(async () => mocks.settings)
  };
});

import { computeCurrentMrr, periodMonthLabel } from "#@/billing/compute-current-mrr";
import {
  ensurePlansSeeded,
  getPlanCatalog,
  invalidatePlanCatalogCache,
  listPlans,
  planEntry,
  planName,
  planPrice,
  planSeats,
  resolvePlanEntry,
  toPlanTier
} from "#@/billing/plan-catalog";

const growthRow = {
  cta: "Start",
  highlights: ["One"],
  id: "growth",
  name: "Growth",
  popular: true,
  priceMonthly: 49,
  seatPrice: null,
  seatsIncluded: 10,
  sortOrder: 1,
  tagline: "Grow"
};

describe("billing application services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.planRows = [growthRow];
    mocks.organizationRows = [];
    mocks.cacheWrap.mockImplementation(async (_key, loader: () => Promise<unknown>) => loader());
  });

  it("maps, seeds, lists, caches, and invalidates plans", async () => {
    await ensurePlansSeeded();
    await ensurePlansSeeded();
    expect(mocks.insertValues).toHaveBeenCalledOnce();
    expect(toPlanTier(growthRow as never)).toEqual({ ...growthRow, seatPrice: undefined });
    await expect(listPlans()).resolves.toEqual([{ ...growthRow, seatPrice: undefined }]);

    const catalog = await getPlanCatalog();
    expect(catalog.get("growth")).toEqual({ name: "Growth", price: 49, seats: 10 });
    await invalidatePlanCatalogCache();
    expect(mocks.cacheInvalidateTag).toHaveBeenCalledWith("platform:plans");
  });

  it("resolves free and configured plan properties", async () => {
    const catalog = new Map([["growth", { name: "Growth", price: 49, seats: 10 }]]);
    expect(resolvePlanEntry(catalog, null)).toEqual({ name: "Free", price: 0, seats: 3 });
    expect(resolvePlanEntry(catalog, "missing")).toEqual({ name: "Free", price: 0, seats: 3 });
    expect(resolvePlanEntry(catalog, "growth")).toEqual({ name: "Growth", price: 49, seats: 10 });
    await expect(planEntry(null)).resolves.toEqual({ name: "Free", price: 0, seats: 3 });
    await expect(planPrice("growth")).resolves.toBe(49);
    await expect(planSeats("growth")).resolves.toBe(10);
    await expect(planName("growth")).resolves.toBe("Growth");
  });

  it("computes active and newly-created MRR for a UTC month", async () => {
    mocks.organizationRows = [
      {
        createdAt: new Date("2026-07-10T00:00:00Z"),
        planId: "growth",
        subscriptionStatus: "active"
      },
      {
        createdAt: new Date("2026-06-10T00:00:00Z"),
        planId: "growth",
        subscriptionStatus: "active"
      },
      {
        createdAt: new Date("2026-07-11T00:00:00Z"),
        planId: "growth",
        subscriptionStatus: "canceled"
      }
    ];

    await expect(computeCurrentMrr("2026-07")).resolves.toEqual({
      activeOrgs: 2,
      churnedMrr: null,
      currency: "EUR",
      mrr: 98,
      newMrr: 49
    });
    expect(periodMonthLabel("2026-07")).toBe("Jul");
  });
});
