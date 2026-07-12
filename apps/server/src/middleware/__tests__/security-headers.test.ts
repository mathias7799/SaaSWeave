import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const env = vi.hoisted(() => {
  return {
    NODE_ENV: "production",
    SECURITY_CSP_REPORT_ONLY: false,
    SECURITY_CSP_REPORT_URI: undefined,
    SECURITY_HEADERS_ENABLED: true,
    VITE_SERVER_URL: "http://localhost/server"
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: env
  };
});

import {
  applySecurityHeadersToHonoResponse,
  docsContentSecurityPolicy,
  securityHeadersMiddleware,
  securityResponseHeaders
} from "#@/middleware/security-headers";

describe("securityResponseHeaders", () => {
  it("includes HSTS only in production", () => {
    expect(securityResponseHeaders("development")["Strict-Transport-Security"]).toBeUndefined();
    expect(securityResponseHeaders("production")["Strict-Transport-Security"]).toContain("max-age");
  });

  it("sets baseline API security headers", () => {
    const headers = securityResponseHeaders("production");

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain("form-action 'none'");
  });
});

describe("applySecurityHeadersToHonoResponse", () => {
  afterEach(() => {
    env.SECURITY_HEADERS_ENABLED = true;
    vi.clearAllMocks();
  });

  it("applies headers to redirect responses", () => {
    const response = applySecurityHeadersToHonoResponse(
      new Response(null, { headers: { Location: "/docs" }, status: 301 }),
      "production"
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("strict-transport-security")).toContain("max-age");
  });

  it("supports a docs-only CSP without changing other security headers", () => {
    const response = applySecurityHeadersToHonoResponse(
      new Response("docs"),
      "production",
      docsContentSecurityPolicy
    );

    expect(response.headers.get("content-security-policy")).toContain(
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("returns responses unchanged when headers are disabled", () => {
    env.SECURITY_HEADERS_ENABLED = false;
    const response = new Response("ok");
    expect(applySecurityHeadersToHonoResponse(response)).toBe(response);
  });

  it("secures downstream middleware responses", async () => {
    const app = new Hono();
    app.use(securityHeadersMiddleware);
    app.get("/", (c) => c.text("ok"));
    const response = await app.request("http://localhost/");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("uses the Scalar-compatible CSP only for docs routes", async () => {
    const app = new Hono();
    app.use(securityHeadersMiddleware);
    app.get("/server/docs", (c) => c.html("docs"));
    app.get("/server/rpc", (c) => c.text("rpc"));

    const docs = await app.request("http://localhost/server/docs");
    const rpc = await app.request("http://localhost/server/rpc");

    expect(docs.headers.get("content-security-policy")).toContain("cdn.jsdelivr.net");
    expect(rpc.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(rpc.headers.get("content-security-policy")).not.toContain("cdn.jsdelivr.net");
  });

  it("leaves downstream middleware responses untouched when disabled", async () => {
    env.SECURITY_HEADERS_ENABLED = false;
    const app = new Hono();
    app.use(securityHeadersMiddleware);
    app.get("/", (c) => c.text("ok"));
    const response = await app.request("http://localhost/");
    expect(response.headers.get("x-frame-options")).toBeNull();
  });
});
