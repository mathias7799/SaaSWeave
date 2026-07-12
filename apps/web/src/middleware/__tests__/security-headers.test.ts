import { describe, expect, it, vi } from "vite-plus/test";

const serverEnv = vi.hoisted(() => {
  return {
    NODE_ENV: "production",
    SECURITY_CSP_REPORT_ONLY: false,
    SECURITY_CSP_REPORT_URI: undefined as string | undefined,
    SECURITY_HEADERS_ENABLED: true
  };
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
  return { ENV_WEB_SERVER: serverEnv };
});

import { applySecurityHeaders, createRequestNonce } from "@/middleware/security-headers";

describe("applySecurityHeaders", () => {
  it("returns the original response when security headers are disabled", async () => {
    serverEnv.SECURITY_HEADERS_ENABLED = false;
    const response = new Response("ok");
    await expect(applySecurityHeaders(response)).resolves.toBe(response);
    serverEnv.SECURITY_HEADERS_ENABLED = true;
  });
  it("propagates nonce into HTML and CSP in production", async () => {
    const nonce = "fixed-nonce";
    const html = '<!doctype html><html><body><script src="/app.js"></script></body></html>';
    const response = new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" }
    });

    const secured = await applySecurityHeaders(response, nonce);
    const body = await secured.text();

    expect(body).toContain('nonce="fixed-nonce"');
    expect(secured.headers.get("content-security-policy")).toContain("'nonce-fixed-nonce'");
    expect(secured.headers.get("content-security-policy")).not.toMatch(
      /script-src[^;]*unsafe-inline/
    );
    expect(secured.headers.get("strict-transport-security")).toContain("max-age");
  });

  it("applies security headers to non-HTML responses", async () => {
    const response = new Response(null, {
      headers: { Location: "/sign-in" },
      status: 307
    });

    const secured = await applySecurityHeaders(response, createRequestNonce());

    expect(secured.status).toBe(307);
    expect(secured.headers.get("x-frame-options")).toBe("DENY");
    expect(secured.headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
  });
});
