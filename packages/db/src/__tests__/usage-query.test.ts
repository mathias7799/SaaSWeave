import { describe, expect, it } from "vite-plus/test";

import { UNATTRIBUTED_USAGE_LABEL, usageEventTokenSplit } from "#@/usage-attribution";

describe("usageEventTokenSplit", () => {
  it("treats quantity as input tokens when split columns are absent", () => {
    expect(usageEventTokenSplit(null, null, 1_500)).toEqual({
      inputTokens: 1_500,
      outputTokens: 0,
      totalTokens: 1_500
    });
  });

  it("uses explicit input and output token columns when provided", () => {
    expect(usageEventTokenSplit(800, 200, 1_500)).toEqual({
      inputTokens: 800,
      outputTokens: 200,
      totalTokens: 1_000
    });
  });

  it("treats output-only rows as output tokens", () => {
    expect(usageEventTokenSplit(null, 250, 1_500)).toEqual({
      inputTokens: 0,
      outputTokens: 250,
      totalTokens: 250
    });
  });
});

describe("UNATTRIBUTED_USAGE_LABEL", () => {
  it("uses a stable unattributed bucket label", () => {
    expect(UNATTRIBUTED_USAGE_LABEL).toBe("Unattributed");
  });
});
