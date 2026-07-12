import { describe, expect, it } from "vite-plus/test";

import { canManageApiKeys, canManageBilling, canRecordUsage } from "#@/lib/console-access";

describe("console access helpers", () => {
  it.each([
    { fn: canManageBilling, role: "billing", expected: true },
    { fn: canManageBilling, role: "member", expected: false },
    { fn: canManageApiKeys, role: "developer", expected: true },
    { fn: canManageApiKeys, role: "analyst", expected: false },
    { fn: canRecordUsage, role: "developer", expected: true },
    { fn: canRecordUsage, role: "member", expected: false }
  ])("$fn.name($role) -> $expected", ({ fn, role, expected }) => {
    expect(fn(role)).toBe(expected);
  });
});
