import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.fn();
const getRequest = vi.fn();
const setResponseHeader = vi.fn();

vi.mock("#@/index", () => {
  return {
    auth: {
      api: {
        getSession: (...args: unknown[]) => getSession(...args)
      }
    }
  };
});

vi.mock("@tanstack/react-start/server", () => {
  return {
    getRequest: () => getRequest(),
    setResponseHeader: (...args: unknown[]) => setResponseHeader(...args)
  };
});

import { _getAuthState, _getUser } from "#@/react/tanstack-start/functions";

describe("tanstack auth server functions", () => {
  beforeEach(() => {
    getSession.mockReset();
    setResponseHeader.mockReset();
    getRequest.mockReturnValue({ headers: new Headers({ cookie: "session=test" }) });
  });

  it("returns auth state and forwards refreshed cookies", async () => {
    getSession.mockResolvedValue({
      headers: {
        getSetCookie: () => ["session=refreshed; Path=/"]
      },
      response: {
        session: { impersonatedBy: "admin-1" },
        user: { id: "user-1", name: "Ada" }
      }
    });

    await expect(_getAuthState()).resolves.toEqual({
      impersonatedBy: "admin-1",
      user: { id: "user-1", name: "Ada" }
    });
    expect(getSession).toHaveBeenCalledWith({
      headers: getRequest().headers,
      query: undefined,
      returnHeaders: true
    });
    expect(setResponseHeader).toHaveBeenCalledWith("Set-Cookie", ["session=refreshed; Path=/"]);
  });

  it("returns null user when no session exists", async () => {
    getSession.mockResolvedValue({
      headers: { getSetCookie: () => [] },
      response: { session: null, user: null }
    });

    await expect(_getAuthState()).resolves.toEqual({
      impersonatedBy: null,
      user: null
    });
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it("passes cache-bypass query params through to Better Auth", async () => {
    getSession.mockResolvedValue({
      headers: { getSetCookie: () => [] },
      response: { session: {}, user: { id: "user-1" } }
    });

    await _getAuthState({ disableCookieCache: true, disableRefresh: true });

    expect(getSession).toHaveBeenCalledWith({
      headers: getRequest().headers,
      query: { disableCookieCache: true, disableRefresh: true },
      returnHeaders: true
    });
  });

  it("_getUser returns only the user from auth state", async () => {
    getSession.mockResolvedValue({
      headers: { getSetCookie: () => [] },
      response: {
        session: { impersonatedBy: null },
        user: { id: "user-2", email: "ada@example.com" }
      }
    });

    await expect(_getUser()).resolves.toEqual({ id: "user-2", email: "ada@example.com" });
  });
});
