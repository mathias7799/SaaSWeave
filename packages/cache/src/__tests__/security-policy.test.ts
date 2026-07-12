import { afterEach, describe, expect, it, vi } from "vite-plus/test";

describe("resolveSecurityFailureMode", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@saasweave/env/server/env");
  });

  it.each([
    {
      name: "failClosed in production with Redis configured",
      env: {
        ALLOW_SINGLE_INSTANCE_FALLBACK: false,
        NODE_ENV: "production",
        REDIS_URL: "redis://localhost:6379"
      },
      expected: "failClosed"
    },
    {
      name: "failOpen with single-instance fallback",
      env: {
        ALLOW_SINGLE_INSTANCE_FALLBACK: true,
        NODE_ENV: "production",
        REDIS_URL: undefined
      },
      expected: "failOpen"
    },
    {
      name: "failOpen in development",
      env: {
        ALLOW_SINGLE_INSTANCE_FALLBACK: false,
        NODE_ENV: "development",
        REDIS_URL: "redis://localhost:6379"
      },
      expected: "failOpen"
    }
  ])("$name", async ({ env, expected }) => {
    vi.doMock("@saasweave/env/server/env", () => {
      return { ENV_SERVER: env };
    });

    const { resolveSecurityFailureMode } = await import("#@/security-policy");
    expect(resolveSecurityFailureMode()).toBe(expected);
  });
});
