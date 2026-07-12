import { describe, expect, it } from "vite-plus/test";

import { resolveClientIp } from "#@/client-ip";

describe("resolveClientIp", () => {
  it("ignores forwarded headers when proxy trust is disabled", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.1, 198.51.100.2",
      "x-real-ip": "198.51.100.9"
    });

    expect(resolveClientIp(headers, { trustProxyHeaders: false })).toBe("unknown");
  });

  it("prefers the first forwarded-for address when proxy trust is enabled", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.1, 198.51.100.2",
      "x-real-ip": "198.51.100.9"
    });

    expect(resolveClientIp(headers, { trustProxyHeaders: true })).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip and then unknown", () => {
    expect(
      resolveClientIp(new Headers({ "x-real-ip": "10.0.0.5" }), { trustProxyHeaders: true })
    ).toBe("10.0.0.5");
    expect(resolveClientIp(new Headers(), { trustProxyHeaders: true })).toBe("unknown");
  });

  it("falls back to socketAddress when proxy trust is disabled", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.1",
      "x-real-ip": "198.51.100.9"
    });

    expect(
      resolveClientIp(headers, { trustProxyHeaders: false, socketAddress: "192.0.2.10" })
    ).toBe("192.0.2.10");
  });

  it("prefers x-forwarded-for over socketAddress when proxy trust is enabled", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.1" });

    expect(resolveClientIp(headers, { trustProxyHeaders: true, socketAddress: "192.0.2.10" })).toBe(
      "203.0.113.1"
    );
  });

  it("returns unknown when neither trusted header nor socketAddress is present", () => {
    expect(resolveClientIp(new Headers(), { trustProxyHeaders: false })).toBe("unknown");
    expect(
      resolveClientIp(new Headers({ "x-forwarded-for": "203.0.113.1" }), {
        trustProxyHeaders: false
      })
    ).toBe("unknown");
  });
});
