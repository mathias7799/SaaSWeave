import { describe, expect, it } from "vite-plus/test";

const webUrl = process.env.VITE_WEB_URL ?? "http://localhost:3000";
const serverUrl = process.env.VITE_SERVER_URL ?? "http://localhost:5000/server";

const securityHeadersEnabled =
  process.env.SECURITY_HEADERS_ENABLED === "true" ||
  (process.env.SECURITY_HEADERS_ENABLED !== "false" && process.env.NODE_ENV === "production");

describe("public routes", () => {
  it.each(["/", "/pricing", "/sign-in", "/create-an-account", "/status"])(
    "serves %s",
    async (path) => {
      const response = await fetch(`${webUrl}${path}`);
      expect(response.status).toBeLessThan(500);
    }
  );
});

describe("api health", () => {
  it("reports live health", async () => {
    const response = await fetch(`${serverUrl}/health/live`);
    expect(response.ok).toBe(true);
  });

  it("reports ready health", async () => {
    const response = await fetch(`${serverUrl}/health/ready`);
    expect(response.status).toBeLessThan(500);
  });

  it("lists auth providers", async () => {
    const response = await fetch(`${serverUrl}/auth/providers`);
    expect(response.ok).toBe(true);
    const body = (await response.json()) as {
      github: boolean;
      google: boolean;
      magicLink: boolean;
    };
    expect(typeof body.github).toBe("boolean");
    expect(typeof body.google).toBe("boolean");
    expect(typeof body.magicLink).toBe("boolean");
  });
});

describe("security headers", () => {
  it.skipIf(!securityHeadersEnabled)("sets baseline headers on HTML responses", async () => {
    const response = await fetch(`${webUrl}/`);

    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it.skipIf(process.env.NODE_ENV === "production")(
    "allows unsafe-inline in development CSP",
    async () => {
      const response = await fetch(`${webUrl}/`);
      const csp = response.headers.get("content-security-policy") ?? "";
      expect(csp).toContain("unsafe-inline");
    }
  );

  it.skipIf(process.env.NODE_ENV !== "production")(
    "omits unsafe-inline from production CSP",
    async () => {
      const response = await fetch(`${webUrl}/`);
      const csp = response.headers.get("content-security-policy") ?? "";
      expect(csp).not.toContain("unsafe-inline");
    }
  );

  it.skipIf(!securityHeadersEnabled)("sets API security headers on server responses", async () => {
    const response = await fetch(`${serverUrl}/health/live`);
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(csp).toContain("default-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("guest console access", () => {
  it("redirects unauthenticated /app requests away from the console", async () => {
    const response = await fetch(`${webUrl}/app`, { redirect: "manual" });
    expect([301, 302, 303, 307, 308, 401, 403]).toContain(response.status);
  });
});
