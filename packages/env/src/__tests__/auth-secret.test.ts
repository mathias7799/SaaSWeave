import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { stubProductionEnv } from "#@/__tests__/fixtures/env-fixtures";
import { isWeakAuthSecret } from "#@/server/auth-secret";

describe("isWeakAuthSecret", () => {
  it("rejects short secrets", () => {
    expect(isWeakAuthSecret("too-short")).toBe(true);
  });

  it("rejects known placeholder markers", () => {
    expect(isWeakAuthSecret("replace-with-at-least-32-characters-generated-locally")).toBe(true);
    expect(isWeakAuthSecret("replace_me_run_pnpm_auth_secret_to_generate_a_real_value_here")).toBe(
      true
    );
  });

  it("accepts a unique secret of sufficient length", () => {
    expect(isWeakAuthSecret("a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0")).toBe(false);
  });
});

describe("ENV_SERVER production Redis", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects production boot without REDIS_URL when the escape hatch is off", async () => {
    stubProductionEnv({ REDIS_URL: undefined });

    await expect(import("#@/server/env")).rejects.toThrow(
      "REDIS_URL is required in production for shared cache and rate limits across replicas."
    );
  });

  it("allows production boot without REDIS_URL when ALLOW_SINGLE_INSTANCE_FALLBACK is true", async () => {
    stubProductionEnv({
      ALLOW_SINGLE_INSTANCE_FALLBACK: "true",
      REDIS_URL: undefined
    });

    const { ENV_SERVER } = await import("#@/server/env");

    expect(ENV_SERVER.ALLOW_SINGLE_INSTANCE_FALLBACK).toBe(true);
    expect(ENV_SERVER.REDIS_URL).toBeUndefined();
  });
});
