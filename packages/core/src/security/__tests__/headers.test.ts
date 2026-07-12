import { describe, expect, it } from "vite-plus/test";

import {
  buildApiContentSecurityPolicy,
  buildWebContentSecurityPolicy,
  parseDeploymentOrigins
} from "#@/security/csp";
import {
  apiSecurityResponseHeaders,
  applySecurityHeadersToResponse,
  buildSecurityResponseHeaders,
  webSecurityResponseHeaders
} from "#@/security/headers";

const origins = parseDeploymentOrigins({
  serverUrl: "http://localhost:5000/server",
  webUrl: "http://localhost:3000"
});

const API_CSP = buildApiContentSecurityPolicy();
const WEB_PROD_CSP = buildWebContentSecurityPolicy({
  nodeEnv: "production",
  nonce: "test-nonce",
  origins
});
const WEB_DEV_CSP = buildWebContentSecurityPolicy({
  nodeEnv: "development",
  origins
});

const BASELINE_HEADERS = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
} as const;

const HSTS = "max-age=31536000; includeSubDomains";

describe("buildSecurityResponseHeaders", () => {
  it.each([
    {
      profile: "api" as const,
      nodeEnv: "development" as const,
      csp: API_CSP,
      expectedCsp: API_CSP,
      includesHsts: false
    },
    {
      profile: "api" as const,
      nodeEnv: "production" as const,
      csp: API_CSP,
      expectedCsp: API_CSP,
      includesHsts: true
    },
    {
      profile: "web" as const,
      nodeEnv: "development" as const,
      csp: WEB_DEV_CSP,
      expectedCsp: WEB_DEV_CSP,
      includesHsts: false
    },
    {
      profile: "web" as const,
      nodeEnv: "production" as const,
      csp: WEB_PROD_CSP,
      expectedCsp: WEB_PROD_CSP,
      includesHsts: true
    }
  ])(
    "builds $profile headers in $nodeEnv with concrete CSP and HSTS only in production",
    ({ profile, nodeEnv, csp, expectedCsp, includesHsts }) => {
      const headers = buildSecurityResponseHeaders({ csp, nodeEnv, profile });

      expect(headers).toEqual({
        "Content-Security-Policy": expectedCsp,
        ...BASELINE_HEADERS,
        ...(includesHsts ? { "Strict-Transport-Security": HSTS } : {})
      });
    }
  );

  it("emits report-only CSP when requested", () => {
    const headers = buildSecurityResponseHeaders({
      csp: WEB_PROD_CSP,
      cspReportOnly: true,
      nodeEnv: "production",
      profile: "web"
    });

    expect(headers["Content-Security-Policy-Report-Only"]).toBe(WEB_PROD_CSP);
    expect(headers).not.toHaveProperty("Content-Security-Policy");
  });
});

describe("apiSecurityResponseHeaders", () => {
  it("returns API-oriented CSP without inline scripts", () => {
    const headers = apiSecurityResponseHeaders("development", { csp: API_CSP });

    expect(headers["Content-Security-Policy"]).toBe(API_CSP);
    expect(headers).toMatchObject(BASELINE_HEADERS);
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });
});

describe("webSecurityResponseHeaders", () => {
  it("returns production CSP with nonce and no HSTS in development", () => {
    const headers = webSecurityResponseHeaders("development", { csp: WEB_DEV_CSP });

    expect(headers["Content-Security-Policy"]).toBe(WEB_DEV_CSP);
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });
});

describe("applySecurityHeadersToResponse", () => {
  it("applies headers to redirect and error responses", () => {
    const response = applySecurityHeadersToResponse(
      new Response(null, { status: 307, headers: { Location: "/sign-in" } }),
      apiSecurityResponseHeaders("production", { csp: API_CSP })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("content-security-policy")).toBe(API_CSP);
    expect(response.headers.get("strict-transport-security")).toContain("max-age");
  });
});
