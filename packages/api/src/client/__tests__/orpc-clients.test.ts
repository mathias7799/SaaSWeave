import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    authGetSession: vi.fn(),
    browserClient: { transport: "browser" },
    createLogger: vi.fn(),
    createORPCClient: vi.fn(),
    createRouterClient: vi.fn(),
    createTanstackQueryUtils: vi.fn(),
    getRequestHeaders: vi.fn(),
    resolveClientIp: vi.fn(),
    rpcLinkOptions: undefined as { fetch: typeof fetch; url: string } | undefined,
    serverClient: { transport: "server" }
  };
});

vi.mock("@orpc/client", () => {
  return {
    createORPCClient: mocks.createORPCClient
  };
});

vi.mock("@orpc/client/fetch", () => {
  return {
    RPCLink: class RPCLink {
      constructor(options: { fetch: typeof fetch; url: string }) {
        mocks.rpcLinkOptions = options;
      }
    }
  };
});

vi.mock("@orpc/server", () => {
  return {
    createRouterClient: mocks.createRouterClient
  };
});

vi.mock("@orpc/tanstack-query", () => {
  return {
    createTanstackQueryUtils: mocks.createTanstackQueryUtils
  };
});

vi.mock("@tanstack/react-start", () => {
  return {
    createIsomorphicFn: () => {
      return {
        server(serverFactory: () => unknown) {
          return {
            client: (_clientFactory: () => unknown) => serverFactory
          };
        }
      };
    }
  };
});

vi.mock("@tanstack/react-start/server", () => {
  return {
    getRequestHeaders: mocks.getRequestHeaders
  };
});

vi.mock("@saasweave/auth/index", () => {
  return {
    auth: { api: { getSession: mocks.authGetSession } }
  };
});

vi.mock("@saasweave/cache", () => {
  return {
    resolveClientIp: mocks.resolveClientIp
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: { TRUST_PROXY_HEADERS: true }
  };
});

vi.mock("@saasweave/env/web/env.isomorphic", () => {
  return {
    ENV_WEB_ISOMORPHIC: { VITE_SERVER_URL: "https://api.example.test" }
  };
});

vi.mock("@saasweave/logger/server", () => {
  return {
    createLogger: mocks.createLogger
  };
});

vi.mock("#@/routers/index", () => {
  return {
    appRouter: { name: "app-router" }
  };
});

describe("oRPC clients", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.rpcLinkOptions = undefined;
    mocks.createORPCClient.mockReturnValue(mocks.browserClient);
    mocks.createRouterClient.mockReturnValue(mocks.serverClient);
  });

  it("creates the browser transport with cookies enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);

    const { client } = await import("#@/client/browser/orpc");
    const options = mocks.rpcLinkOptions;

    expect(client).toBe(mocks.browserClient);
    expect(options?.url).toBe("https://api.example.test/rpc");
    await options?.fetch("https://api.example.test/rpc", {
      method: "POST"
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/rpc", {
      credentials: "include",
      method: "POST"
    });
  });

  it("builds the server client context from the current request", async () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.8" });
    const logger = { info: vi.fn() };
    const session = { user: { id: "user-1" } };
    mocks.getRequestHeaders.mockReturnValue(headers);
    mocks.resolveClientIp.mockReturnValue("203.0.113.8");
    mocks.authGetSession.mockResolvedValue(session);
    mocks.createLogger.mockReturnValue(logger);

    const { appRouter, client } = await import("#@/client/server/orpc");
    const [, options] = mocks.createRouterClient.mock.calls[0] as [
      unknown,
      { context: () => Promise<unknown> }
    ];

    expect(client).toBe(mocks.serverClient);
    expect(appRouter).toEqual({ name: "app-router" });
    await expect(options.context()).resolves.toEqual({
      clientIp: "203.0.113.8",
      headers,
      logger,
      session
    });
    expect(mocks.resolveClientIp).toHaveBeenCalledWith(headers, {
      trustProxyHeaders: true
    });
    expect(mocks.authGetSession).toHaveBeenCalledWith({ headers });
  });

  it("exposes the isomorphic client through TanStack Query utilities", async () => {
    const queryUtils = { health: { queryOptions: vi.fn() } };
    mocks.createTanstackQueryUtils.mockReturnValue(queryUtils);

    const module = await import("#@/client/tanstack-start/orpc");

    expect(module.client).toBe(mocks.serverClient);
    expect(module.orpc).toBe(queryUtils);
    expect(mocks.createTanstackQueryUtils).toHaveBeenCalledWith(mocks.serverClient);
  });
});
