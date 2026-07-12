import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_FEATURES } from "#@/features/types";

describe("DEFAULT_FEATURES", () => {
  it("enables SSO for scale and enterprise plans", () => {
    const sso = DEFAULT_FEATURES.find((feature) => feature.key === "sso");
    expect(sso?.enabled).toBe(true);
    expect(sso?.availableOn).toContain("enterprise");
  });

  it("includes shipped workspace capabilities", () => {
    expect(DEFAULT_FEATURES.some((feature) => feature.key === "api_keys")).toBe(true);
    expect(DEFAULT_FEATURES.some((feature) => feature.key === "webhooks")).toBe(true);
    expect(DEFAULT_FEATURES.some((feature) => feature.key === "audit_logs")).toBe(true);
  });

  it("ships batch_jobs as an opt-in capability", () => {
    const batchJobs = DEFAULT_FEATURES.find((feature) => feature.key === "batch_jobs");
    expect(batchJobs?.enabled).toBe(false);
    expect(batchJobs?.category).toBe("AI");
  });

  it("does not include roadmap-only capabilities", () => {
    expect(DEFAULT_FEATURES.some((feature) => feature.key === "invoicing")).toBe(false);
  });
});
