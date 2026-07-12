import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  setIsProductionMode,
  stubDevelopmentWebEnv,
  stubProductionEnv
} from "#@/__tests__/fixtures/env-fixtures";

describe("ENV_WEB_SERVER", () => {
  afterEach(() => {
    setIsProductionMode(false);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("parses development defaults with security headers disabled", async () => {
    setIsProductionMode(false);
    stubDevelopmentWebEnv({
      IS_BUILD: "false",
      NODE_ENV: "development",
      SECURITY_HEADERS_ENABLED: "false"
    });

    const { ENV_WEB_SERVER } = await import("#@/web/env.server");

    expect(ENV_WEB_SERVER.NODE_ENV).toBe("development");
    expect(ENV_WEB_SERVER.SECURITY_HEADERS_ENABLED).toBe(false);
    expect(ENV_WEB_SERVER.SOURCE_COMMIT).toBe("unknown");
    expect(ENV_WEB_SERVER.IS_BUILD).toBe(false);
  });

  it("defaults SECURITY_HEADERS_ENABLED to true in production", async () => {
    setIsProductionMode(true);
    stubProductionEnv({
      BETTER_AUTH_SECRET: undefined,
      DATABASE_URL: undefined
    });

    const { ENV_WEB_SERVER } = await import("#@/web/env.server");

    expect(ENV_WEB_SERVER.NODE_ENV).toBe("production");
    expect(ENV_WEB_SERVER.SECURITY_HEADERS_ENABLED).toBe(true);
  });

  it("accepts explicit SECURITY_HEADERS_ENABLED overrides", async () => {
    setIsProductionMode(false);
    stubDevelopmentWebEnv({
      SECURITY_HEADERS_ENABLED: "true"
    });

    const { ENV_WEB_SERVER } = await import("#@/web/env.server");

    expect(ENV_WEB_SERVER.SECURITY_HEADERS_ENABLED).toBe(true);
  });
});
