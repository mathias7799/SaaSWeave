import { describe, expect, it } from "vite-plus/test";

import { canManageApiKeys, canManageBilling, canRecordUsage } from "#@/lib/console-access";

describe("console access roles", () => {
  it("allows billing managers to manage billing", () => {
    expect(canManageBilling("owner")).toBe(true);
    expect(canManageBilling("billing")).toBe(true);
    expect(canManageBilling("member")).toBe(false);
  });

  it("allows developer roles to manage API keys and record usage", () => {
    expect(canManageApiKeys("developer")).toBe(true);
    expect(canManageApiKeys("member")).toBe(false);
    expect(canRecordUsage("developer")).toBe(true);
    expect(canRecordUsage("member")).toBe(false);
  });
});
