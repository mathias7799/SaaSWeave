import { describe, expect, it } from "vite-plus/test";

import { isInRollout, resolveFeatureEnabled, rolloutBucket } from "#@/lib/feature-rollout";

describe("feature rollout", () => {
  it("returns a stable bucket for the same org and feature", () => {
    const first = rolloutBucket("org-1", "ai_assistant");
    const second = rolloutBucket("org-1", "ai_assistant");
    expect(first).toBe(second);
  });

  it("includes all orgs at 100% rollout", () => {
    expect(isInRollout("org-1", "api_keys", 100)).toBe(true);
    expect(isInRollout("org-2", "api_keys", 0)).toBe(false);
  });

  it("respects explicit overrides and plan eligibility", () => {
    expect(
      resolveFeatureEnabled({
        featureKey: "webhooks",
        globalEnabled: true,
        organizationId: "org-1",
        override: false,
        planEligible: true,
        rollout: 100
      })
    ).toBe(false);

    expect(
      resolveFeatureEnabled({
        featureKey: "webhooks",
        globalEnabled: true,
        organizationId: "org-1",
        override: undefined,
        planEligible: false,
        rollout: 100
      })
    ).toBe(false);
  });
});
