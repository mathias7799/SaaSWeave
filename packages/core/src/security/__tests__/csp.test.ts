import { describe, expect, it } from "vite-plus/test";

import {
  buildApiContentSecurityPolicy,
  buildWebContentSecurityPolicy,
  injectScriptNonces,
  parseDeploymentOrigins
} from "#@/security/csp";

const origins = parseDeploymentOrigins({
  imgproxyUrl: "http://localhost:8080",
  serverUrl: "http://localhost:5000/server",
  webUrl: "http://localhost:3000"
});

describe("buildWebContentSecurityPolicy", () => {
  it("uses a development profile with inline and websocket allowances", () => {
    const csp = buildWebContentSecurityPolicy({
      nodeEnv: "development",
      origins
    });

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("ws://localhost:*");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("uses nonce-based script-src and enumerated origins in production", () => {
    const csp = buildWebContentSecurityPolicy({
      nodeEnv: "production",
      nonce: "abc123",
      origins
    });

    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("connect-src 'self' http://localhost:3000 http://localhost:5000");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("supports report-only collectors", () => {
    const csp = buildWebContentSecurityPolicy({
      nodeEnv: "production",
      nonce: "abc123",
      origins,
      reportUri: "https://collector.example/csp"
    });

    expect(csp).toContain("report-uri https://collector.example/csp");
  });
});

describe("buildApiContentSecurityPolicy", () => {
  it("locks down API responses", () => {
    expect(buildApiContentSecurityPolicy()).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'"
    );
  });
});

describe("injectScriptNonces", () => {
  it("adds a nonce attribute to script tags", () => {
    const html = '<html><body><script type="module" src="/app.js"></script></body></html>';

    expect(injectScriptNonces(html, "nonce-value")).toContain('<script nonce="nonce-value"');
  });
});
