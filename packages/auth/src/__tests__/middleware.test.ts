import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getUser = vi.fn();
const setResponseStatus = vi.fn();

vi.mock("#@/react/tanstack-start/functions", () => {
  return {
    _getUser: (...args: unknown[]) => getUser(...args)
  };
});

vi.mock("@tanstack/react-start/server", () => {
  return {
    setResponseStatus: (...args: unknown[]) => setResponseStatus(...args)
  };
});

import { runServerMiddleware } from "#@/__tests__/helpers/middleware-runner";
import { authMiddleware, freshAuthMiddleware } from "#@/react/tanstack-start/middleware";

describe("auth middleware", () => {
  beforeEach(() => {
    getUser.mockReset();
    setResponseStatus.mockReset();
  });

  it("authMiddleware adds the user to context when authenticated", async () => {
    getUser.mockResolvedValue({ id: "user-1", name: "Ada" });

    const result = await runServerMiddleware(authMiddleware, {
      handler: async ({ context }) => {
        return { context };
      }
    });

    expect(result.context.user).toEqual({ id: "user-1", name: "Ada" });
    expect(setResponseStatus).not.toHaveBeenCalled();
  });

  it("authMiddleware returns 401 when unauthenticated", async () => {
    getUser.mockResolvedValue(null);

    await expect(
      runServerMiddleware(authMiddleware, {
        handler: async ({ context }) => {
          return { context };
        }
      })
    ).rejects.toThrow("Unauthorized");
    expect(setResponseStatus).toHaveBeenCalledWith(401);
  });

  it("freshAuthMiddleware bypasses cookie cache", async () => {
    getUser.mockResolvedValue({ id: "user-1" });

    await runServerMiddleware(freshAuthMiddleware, {
      handler: async ({ context }) => {
        return { context };
      }
    });

    expect(getUser).toHaveBeenCalledWith({ disableCookieCache: true });
  });

  it("freshAuthMiddleware returns 401 when unauthenticated", async () => {
    getUser.mockResolvedValue(null);

    await expect(
      runServerMiddleware(freshAuthMiddleware, {
        handler: async ({ context }) => {
          return { context };
        }
      })
    ).rejects.toThrow("Unauthorized");
    expect(setResponseStatus).toHaveBeenCalledWith(401);
  });
});
