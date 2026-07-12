import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_PLANS, PlanTierSchema, type PlanTierType } from "#@/plans/types";

function findPlanById(id: string): PlanTierType | undefined {
  return DEFAULT_PLANS.find((plan) => plan.id === id);
}

describe("DEFAULT_PLANS", () => {
  it("ships the starter, growth, scale, and enterprise catalog entries", () => {
    expect(DEFAULT_PLANS.map((plan) => plan.id)).toEqual([
      "starter",
      "growth",
      "scale",
      "enterprise"
    ]);
  });

  it.each([
    { id: "starter", name: "Starter", priceMonthly: 49, seatPrice: 12, seatsIncluded: 3 },
    { id: "growth", name: "Growth", priceMonthly: 199, seatPrice: 19, seatsIncluded: 10 },
    { id: "scale", name: "Scale", priceMonthly: 499, seatPrice: 29, seatsIncluded: 25 }
  ])(
    "resolves known plan $id with pricing metadata",
    ({ id, name, priceMonthly, seatPrice, seatsIncluded }) => {
      const plan = findPlanById(id);

      expect(plan?.name).toBe(name);
      expect(plan?.priceMonthly).toBe(priceMonthly);
      expect(plan?.seatPrice).toBe(seatPrice);
      expect(plan?.seatsIncluded).toBe(seatsIncluded);
    }
  );

  it("marks growth as the popular plan", () => {
    expect(findPlanById("growth")?.popular).toBe(true);
    expect(DEFAULT_PLANS.filter((plan) => plan.popular)).toHaveLength(1);
  });

  it("uses custom pricing for enterprise", () => {
    const enterprise = findPlanById("enterprise");

    expect(enterprise?.priceMonthly).toBeNull();
    expect(enterprise?.seatPrice).toBeNull();
    expect(enterprise?.cta).toBe("Contact sales");
  });

  it("returns undefined for unknown plan ids", () => {
    expect(findPlanById("unknown")).toBeUndefined();
  });

  it("preserves ascending sortOrder across the catalog", () => {
    const sortOrders = DEFAULT_PLANS.map((plan) => plan.sortOrder);
    expect(sortOrders).toEqual([0, 1, 2, 3]);
  });
});

describe("PlanTierSchema", () => {
  it("accepts a valid plan tier payload", () => {
    const starter = findPlanById("starter");
    expect(starter).toBeDefined();
    expect(PlanTierSchema.safeParse(starter).success).toBe(true);
  });

  it("rejects plans with empty ids or negative prices", () => {
    expect(
      PlanTierSchema.safeParse({
        id: "",
        name: "Broken",
        tagline: "Invalid",
        priceMonthly: -1,
        seatsIncluded: 1,
        highlights: [],
        cta: "Nope"
      }).success
    ).toBe(false);
  });

  it("allows nullable monthly pricing for bespoke tiers", () => {
    expect(
      PlanTierSchema.safeParse({
        id: "custom",
        name: "Custom",
        tagline: "Talk to sales",
        priceMonthly: null,
        seatsIncluded: 0,
        highlights: ["Dedicated support"],
        cta: "Contact sales"
      }).success
    ).toBe(true);
  });
});
