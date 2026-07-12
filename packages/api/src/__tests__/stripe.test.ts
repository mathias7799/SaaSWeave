import { describe, expect, it } from "vite-plus/test";

import { priceFor } from "#@/lib/stripe";

describe("stripe helpers", () => {
  it("priceFor returns undefined for unknown plans", () => {
    expect(priceFor("missing-plan-id", "monthly")).toBeUndefined();
    expect(priceFor("missing-plan-id", "annual")).toBeUndefined();
  });

  it("priceFor returns undefined for invalid STRIPE_PRICES JSON without throwing", () => {
    expect(() => priceFor("growth", "monthly")).not.toThrow();
  });
});
