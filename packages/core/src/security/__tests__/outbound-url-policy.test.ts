import { describe, expect, it } from "vite-plus/test";

import {
  OUTBOUND_HTTP_LIMITS,
  assertOutboundAddressesAllowed,
  isBlockedOutboundAddress,
  outboundOriginsMatch,
  parseOutboundUrl
} from "#@/security/outbound-url-policy";

describe("OUTBOUND_HTTP_LIMITS", () => {
  it("documents stable outbound defaults", () => {
    expect(OUTBOUND_HTTP_LIMITS).toEqual({
      ALLOWED_PORTS: [80, 443],
      BODY_IDLE_TIMEOUT_MS: 10_000,
      CONNECT_TIMEOUT_MS: 5_000,
      HEADERS_TIMEOUT_MS: 10_000,
      MAX_REDIRECTS: 3,
      MAX_REQUEST_BODY_BYTES: 262_144,
      MAX_RESPONSE_BODY_BYTES: 2_000,
      TOTAL_TIMEOUT_MS: 30_000
    });
  });
});

describe("isBlockedOutboundAddress", () => {
  it.each([
    { ip: "0.0.0.0", blocked: true },
    { ip: "10.0.0.1", blocked: true },
    { ip: "100.64.0.1", blocked: true },
    { ip: "127.0.0.1", blocked: true },
    { ip: "169.254.169.254", blocked: true },
    { ip: "172.16.0.1", blocked: true },
    { ip: "192.0.0.1", blocked: true },
    { ip: "192.0.2.1", blocked: true },
    { ip: "192.168.1.1", blocked: true },
    { ip: "198.18.0.1", blocked: true },
    { ip: "198.51.100.1", blocked: true },
    { ip: "203.0.113.1", blocked: true },
    { ip: "224.0.0.1", blocked: true },
    { ip: "240.0.0.1", blocked: true },
    { ip: "255.255.255.255", blocked: true },
    { ip: "::", blocked: true },
    { ip: "::1", blocked: true },
    { ip: "fe80::1", blocked: true },
    { ip: "fc00::1", blocked: true },
    { ip: "2001:db8::1", blocked: true },
    { ip: "ff02::1", blocked: true },
    { ip: "::ffff:127.0.0.1", blocked: true },
    { ip: "::ffff:10.0.0.1", blocked: true },
    { ip: "::ffff:192.0.2.1", blocked: true },
    { ip: "93.184.216.34", blocked: false },
    { ip: "8.8.8.8", blocked: false },
    { ip: "2001:4860:4860::8888", blocked: false }
  ])("blocks $ip as $blocked", ({ ip, blocked }) => {
    expect(isBlockedOutboundAddress(ip)).toBe(blocked);
  });
});

describe("parseOutboundUrl", () => {
  it.each([
    { error: "invalid_webhook_url", url: "not-a-url" },
    { error: "invalid_webhook_url", url: "ftp://example.com/hook" },
    { error: "invalid_webhook_url", url: "http://user:pass@example.com/hook" },
    { error: "invalid_webhook_url", url: "http://example.com:8080/hook" },
    { error: "invalid_webhook_url", url: "https://example.com:8443/hook" },
    { error: "blocked_webhook_url", url: "http://127.0.0.1/hook" },
    { error: "blocked_webhook_url", url: "http://localhost/hook" },
    { error: "blocked_webhook_url", url: "http://[::1]/hook" },
    { error: "blocked_webhook_url", url: "http://169.254.169.254/latest/meta-data/" }
  ])("rejects $url", ({ url, error }) => {
    const result = parseOutboundUrl(url);
    expect(result).toEqual({ ok: false, error });
  });

  it("accepts public HTTP and HTTPS URLs on allowed ports", () => {
    expect(parseOutboundUrl("https://example.com/hook").ok).toBe(true);
    expect(parseOutboundUrl("http://93.184.216.34/hook").ok).toBe(true);
    expect(parseOutboundUrl("https://example.com:443/hook").ok).toBe(true);
  });
});

describe("assertOutboundAddressesAllowed", () => {
  it("rejects when any resolved address is blocked", () => {
    expect(assertOutboundAddressesAllowed(["8.8.8.8", "10.0.0.1"])).toBe("blocked_webhook_url");
    expect(assertOutboundAddressesAllowed(["8.8.8.8", "1.1.1.1"])).toBeNull();
  });
});

describe("outboundOriginsMatch", () => {
  it("treats protocol and host changes as different origins", () => {
    expect(outboundOriginsMatch("https://example.com/a", "https://example.com/b")).toBe(true);
    expect(outboundOriginsMatch("https://example.com/a", "http://example.com/a")).toBe(false);
    expect(outboundOriginsMatch("https://example.com/a", "https://other.example/a")).toBe(false);
  });
});
