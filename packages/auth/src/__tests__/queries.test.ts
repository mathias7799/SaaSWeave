import { describe, expect, it, vi } from "vite-plus/test";

const getAuthState = vi.fn();

vi.mock("#@/react/tanstack-start/functions", () => {
  return {
    $getAuthState: (...args: unknown[]) => getAuthState(...args)
  };
});

import {
  authQueryKeys,
  ensureAuthState,
  getAuthStateQueryOptions,
  getAuthUserQueryOptions,
  type AuthQueryResult
} from "#@/react/tanstack-start/queries";

describe("auth query options", () => {
  it("defines stable auth query keys", () => {
    expect(authQueryKeys.state).toEqual(["auth", "state"]);
  });

  it("configures auth state query caching and retries", () => {
    const options = getAuthStateQueryOptions();
    const retryDelay = options.retryDelay as ((attemptIndex: number) => number) | undefined;

    expect(options.queryKey).toEqual(["auth", "state"]);
    expect(options.staleTime).toBe(1000 * 60 * 5);
    expect(options.gcTime).toBe(1000 * 60 * 10);
    expect(options.refetchOnWindowFocus).toBe("always");
    expect(options.retry).toBe(3);
    expect(retryDelay?.(2)).toBe(3000);
    expect(retryDelay?.(0)).toBe(1000);
  });

  it("selects the user from auth state", () => {
    const options = getAuthUserQueryOptions();
    const state = {
      impersonatedBy: null,
      user: { id: "user-1", name: "Ada" }
    } as AuthQueryResult;

    expect(options.select?.(state)).toEqual(state.user);
  });

  it("ensureAuthState uses preload vs revalidate options", async () => {
    getAuthState.mockResolvedValue({ impersonatedBy: null, user: { id: "user-1" } });
    const queryClient = {
      ensureQueryData: vi.fn(async (options: { revalidateIfStale?: boolean }) => {
        expect(options.revalidateIfStale).toBeUndefined();
        return { impersonatedBy: null, user: { id: "user-1" } };
      })
    };

    await expect(ensureAuthState(queryClient as never, { preload: true })).resolves.toEqual({
      impersonatedBy: null,
      user: { id: "user-1" }
    });

    const revalidateClient = {
      ensureQueryData: vi.fn(async (options: { revalidateIfStale?: boolean }) => {
        expect(options.revalidateIfStale).toBe(true);
        return { impersonatedBy: "admin-1", user: { id: "user-2" } };
      })
    };

    await expect(ensureAuthState(revalidateClient as never)).resolves.toEqual({
      impersonatedBy: "admin-1",
      user: { id: "user-2" }
    });
  });
});
