import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  setIsProductionMode,
  stubDevelopmentWebEnv,
  stubProductionEnv
} from "#@/__tests__/fixtures/env-fixtures";

describe("ENV_WEB_ISOMORPHIC", () => {
  afterEach(() => {
    setIsProductionMode(false);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("parses required VITE_ vars in development with defaults", async () => {
    setIsProductionMode(false);
    stubDevelopmentWebEnv({
      VITE_IMGPROXY_SIGNATURE: undefined,
      VITE_SERVER_URL: undefined,
      VITE_WEB_URL: undefined
    });

    const { ENV_WEB_ISOMORPHIC } = await import("#@/web/env.isomorphic");

    expect(ENV_WEB_ISOMORPHIC.VITE_SERVER_URL).toBe("http://localhost:5000/server");
    expect(ENV_WEB_ISOMORPHIC.VITE_WEB_URL).toBe("http://localhost:3000");
    expect(ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_SIGNATURE).toBe("_");
  });

  it("parses optional imgproxy settings when provided", async () => {
    setIsProductionMode(false);
    stubDevelopmentWebEnv({
      VITE_IMGPROXY_SIGNATURE: "signed",
      VITE_IMGPROXY_SOURCE_WEB_URL: "http://web:3000",
      VITE_IMGPROXY_URL: "http://imgproxy:8080"
    });

    const { ENV_WEB_ISOMORPHIC } = await import("#@/web/env.isomorphic");

    expect(ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_URL).toBe("http://imgproxy:8080");
    expect(ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_SOURCE_WEB_URL).toBe("http://web:3000");
    expect(ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_SIGNATURE).toBe("signed");
  });

  it("requires explicit VITE_ URLs in production", async () => {
    setIsProductionMode(true);
    stubProductionEnv({
      VITE_SERVER_URL: "https://api.example.com/server",
      VITE_WEB_URL: "https://example.com"
    });

    const { ENV_WEB_ISOMORPHIC } = await import("#@/web/env.isomorphic");

    expect(ENV_WEB_ISOMORPHIC.VITE_SERVER_URL).toBe("https://api.example.com/server");
    expect(ENV_WEB_ISOMORPHIC.VITE_WEB_URL).toBe("https://example.com");
  });

  it("rejects missing production VITE_ URLs", async () => {
    setIsProductionMode(true);
    stubProductionEnv({
      VITE_SERVER_URL: undefined,
      VITE_WEB_URL: undefined
    });

    await expect(import("#@/web/env.isomorphic")).rejects.toThrow(
      /Invalid environment variables|ZodError/
    );
  });

  it("rejects invalid VITE_ URL values", async () => {
    setIsProductionMode(false);
    stubDevelopmentWebEnv({
      VITE_SERVER_URL: "not-a-valid-url"
    });

    await expect(import("#@/web/env.isomorphic")).rejects.toThrow(
      /Invalid environment variables|ZodError/
    );
  });
});
