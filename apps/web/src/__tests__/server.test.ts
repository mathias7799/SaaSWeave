import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const stubs = vi.hoisted(() => {
  return {
    emit: vi.fn(),
    error: vi.fn(),
    fetch: vi.fn()
  };
});

vi.mock("@tanstack/react-start/server-entry", () => {
  return { default: { fetch: stubs.fetch } };
});

vi.mock("@saasweave/env/web/env.isomorphic", () => {
  return {
    ENV_WEB_ISOMORPHIC: {
      VITE_IMGPROXY_URL: "http://localhost:8080",
      VITE_SERVER_URL: "http://localhost:5000/server",
      VITE_WEB_URL: "http://localhost:3000"
    }
  };
});

vi.mock("@saasweave/env/web/env.server", () => {
  return {
    ENV_WEB_SERVER: {
      NODE_ENV: "production",
      SECURITY_CSP_REPORT_ONLY: false,
      SECURITY_CSP_REPORT_URI: undefined,
      SECURITY_HEADERS_ENABLED: true,
      SOURCE_COMMIT: "test"
    }
  };
});

vi.mock("@saasweave/i18n/server", () => {
  return {
    paraglideMiddleware: (_request: Request, next: () => Promise<Response>) => next()
  };
});

vi.mock("@saasweave/logger/server", () => {
  return {
    LOG_SERVICES: { WEB_SERVER: "web" },
    createRequestLogger: () => {
      return { emit: stubs.emit, error: stubs.error };
    },
    initLogger: vi.fn()
  };
});

const { default: server } = await import("@/server");

describe("web server error responses", () => {
  beforeEach(() => {
    stubs.emit.mockReset();
    stubs.error.mockReset();
    stubs.fetch.mockReset();
  });

  it("converts thrown handlers to secured 500 responses without leaking the error", async () => {
    stubs.fetch.mockRejectedValue(new Error("database password leaked"));

    const response = await server.fetch(new Request("http://localhost:3000/app"));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(response.headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(stubs.error).toHaveBeenCalledOnce();
    expect(stubs.emit).toHaveBeenCalledWith({ status: 500 });
  });

  it("emits the returned status and secures successful responses", async () => {
    stubs.fetch.mockResolvedValue(new Response("ok", { status: 201 }));

    const response = await server.fetch(new Request("http://localhost:3000/app"));

    expect(response.status).toBe(201);
    expect(await response.text()).toBe("ok");
    expect(stubs.emit).toHaveBeenCalledWith({ status: 201 });
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("normalizes non-Error thrown values before logging", async () => {
    stubs.fetch.mockRejectedValue("handler_failed");
    await server.fetch(new Request("http://localhost:3000/app"));
    expect(stubs.error).toHaveBeenCalledWith(expect.any(Error));
  });
});
