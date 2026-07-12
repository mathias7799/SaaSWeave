import { describe, expect, it } from "vite-plus/test";

import { periodMonthLabel } from "@saasweave/app/billing/compute-current-mrr";

describe("compute-current-mrr helpers", () => {
  it("periodMonthLabel formats YYYY-MM months for charts", () => {
    expect(periodMonthLabel("2026-01")).toBe("Jan");
    expect(periodMonthLabel("2026-12")).toBe("Dec");
  });
});
