import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const react = vi.hoisted(() => {
  return {
    cleanup: undefined as (() => void) | undefined,
    setIsClient: vi.fn()
  };
});

vi.mock("react", () => {
  return {
    useEffect: (effect: () => void | (() => void)) => {
      react.cleanup = effect() ?? undefined;
    },
    useState: () => [false, react.setIsClient]
  };
});

import { useIsClient } from "@saasweave/ui/hooks/use-is-client.hook";

describe("useIsClient hydration lifecycle", () => {
  beforeEach(() => {
    react.cleanup = undefined;
    react.setIsClient.mockReset();
  });

  it("becomes true in a microtask while mounted", async () => {
    expect(useIsClient()).toBe(false);
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(react.setIsClient).toHaveBeenCalledWith(true);
  });

  it("does not update state after cleanup", async () => {
    useIsClient();
    react.cleanup?.();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(react.setIsClient).not.toHaveBeenCalled();
  });
});
