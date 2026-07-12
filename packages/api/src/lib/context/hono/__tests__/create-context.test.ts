import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    getSession: vi.fn(),
    resolveClientIp: vi.fn(() => "203.0.113.10"),
    verifyApiKey: vi.fn()
  };
});

vi.mock("@saasweave/auth/index", () => {
  return { auth: { api: { getSession: mocks.getSession } } };
});
vi.mock("@saasweave/cache", () => {
  return { resolveClientIp: mocks.resolveClientIp };
});
vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: { TRUST_PROXY_HEADERS: false }
  };
});
vi.mock("#@/lib/api-keys", () => {
  return { verifyApiKey: mocks.verifyApiKey };
});

import { createContext } from "#@/lib/context/hono/create-context";

function honoContext(authorization?: string) {
  const headers = new Headers(authorization ? { authorization } : {});
  return {
    req: {
      header: (name: string) => headers.get(name) ?? undefined,
      raw: { headers }
    }
  } as never;
}

describe("createContext", () => {
  const logger = {} as never;

  beforeEach(() => vi.clearAllMocks());

  it("uses a verified bearer API key without loading a session", async () => {
    const apiKey = { id: "key_1", organizationId: "org_1" };
    mocks.verifyApiKey.mockResolvedValue(apiKey);
    const result = await createContext({
      context: honoContext("Bearer swv_secret"),
      logger,
      socketAddress: "127.0.0.1"
    });
    expect(result).toMatchObject({ apiKey, clientIp: "203.0.113.10", session: null });
    expect(mocks.verifyApiKey).toHaveBeenCalledWith("swv_secret");
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it.each([undefined, "Basic token", "Bearer   ", "Bearer invalid"])(
    "falls back to the auth session for authorization %s",
    async (authorization) => {
      const session = { session: { id: "session_1" }, user: { id: "user_1" } };
      mocks.verifyApiKey.mockResolvedValue(null);
      mocks.getSession.mockResolvedValue(session);
      const result = await createContext({
        context: honoContext(authorization),
        logger,
        socketAddress: null
      });
      expect(result).toMatchObject({ clientIp: "203.0.113.10", session });
      expect(mocks.getSession).toHaveBeenCalled();
    }
  );
});
