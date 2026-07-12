import { describe, expect, it } from "vite-plus/test";

import { HEALTH_STATUS_LABELS } from "#@/health/constants";
import { formatHealthStatus } from "#@/health/utils";

describe("HEALTH_STATUS_LABELS", () => {
  it("maps rollup statuses to UI labels", () => {
    expect(HEALTH_STATUS_LABELS).toEqual({
      healthy: "Healthy",
      unhealthy: "Unhealthy"
    });
  });
});

describe("formatHealthStatus", () => {
  it.each([
    { status: "healthy" as const, label: "Healthy" },
    { status: "unhealthy" as const, label: "Unhealthy" }
  ])("formats $status as $label", ({ status, label }) => {
    expect(formatHealthStatus(status)).toBe(label);
  });
});
