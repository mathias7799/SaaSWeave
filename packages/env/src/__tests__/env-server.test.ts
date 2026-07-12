import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { stubProductionEnv } from "#@/__tests__/fixtures/env-fixtures";

describe("ENV_SERVER validation branches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when required server env values fail schema validation", async () => {
    stubProductionEnv({ DATABASE_URL: "" });

    await expect(import("#@/server/env")).rejects.toThrow("Invalid environment variables");
  });

  it("throws when BETTER_AUTH_SECRET is weak in production", async () => {
    stubProductionEnv({
      BETTER_AUTH_SECRET: "replace-with-at-least-32-characters-generated-locally"
    });

    await expect(import("#@/server/env")).rejects.toThrow(
      "BETTER_AUTH_SECRET is a known placeholder or too weak for production. Run `vp run auth:secret` and set a unique value."
    );
  });

  it("skips production secret and Redis guards while IS_BUILD is true", async () => {
    stubProductionEnv({
      ALLOW_SINGLE_INSTANCE_FALLBACK: "false",
      BETTER_AUTH_SECRET: "replace-with-at-least-32-characters-generated-locally",
      IS_BUILD: "true",
      REDIS_URL: undefined
    });

    const { ENV_SERVER } = await import("#@/server/env");

    expect(ENV_SERVER.IS_BUILD).toBe(true);
    expect(ENV_SERVER.REDIS_URL).toBeUndefined();
  });

  it("logs when ALLOW_SINGLE_INSTANCE_FALLBACK is enabled without REDIS_URL", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    stubProductionEnv({
      ALLOW_SINGLE_INSTANCE_FALLBACK: "true",
      REDIS_URL: undefined
    });

    await import("#@/server/env");

    expect(debugSpy).toHaveBeenCalledWith(
      "[ENV_SERVER] ALLOW_SINGLE_INSTANCE_FALLBACK is enabled without REDIS_URL — cache and rate limits are per-process only and will not be shared across replicas."
    );

    debugSpy.mockRestore();
  });

  it.each([
    {
      name: "console mail with required verification",
      overrides: {
        MAIL_PROVIDER: "console",
        REDIS_URL: "redis://localhost:6379",
        REQUIRE_EMAIL_VERIFICATION: "true"
      },
      message: "MAIL_PROVIDER=console cannot deliver verification emails"
    },
    {
      name: "resend without API key",
      overrides: {
        MAIL_PROVIDER: "resend",
        REDIS_URL: "redis://localhost:6379",
        REQUIRE_EMAIL_VERIFICATION: "false",
        RESEND_API_KEY: ""
      },
      message: "MAIL_PROVIDER=resend requires a valid re_... RESEND_API_KEY"
    },
    {
      name: "partial Stripe credentials",
      overrides: {
        MAIL_PROVIDER: "resend",
        REDIS_URL: "redis://localhost:6379",
        REQUIRE_EMAIL_VERIFICATION: "false",
        RESEND_API_KEY: "re_test",
        STRIPE_SECRET_KEY: "sk_test",
        STRIPE_WEBHOOK_SECRET: ""
      },
      message: "Stripe is partially configured"
    },
    {
      name: "partial Google OAuth",
      overrides: {
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "",
        MAIL_PROVIDER: "resend",
        REDIS_URL: "redis://localhost:6379",
        REQUIRE_EMAIL_VERIFICATION: "false",
        RESEND_API_KEY: "re_test"
      },
      message: "Google OAuth is partially configured"
    }
  ])("throws at runtime for $name", async ({ overrides, message }) => {
    stubProductionEnv(overrides);

    await expect(import("#@/server/env")).rejects.toThrow(message);
  });

  it("allows build-time placeholders while IS_BUILD is true", async () => {
    stubProductionEnv({
      IS_BUILD: "true",
      MAIL_PROVIDER: "console",
      REDIS_URL: undefined,
      REQUIRE_EMAIL_VERIFICATION: "true"
    });

    await expect(import("#@/server/env")).resolves.toBeDefined();
  });
});
