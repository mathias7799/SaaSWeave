import { describe, expect, it } from "vite-plus/test";

import {
  assertProductionCredentialGroups,
  assertProductionMailConfig,
  assertProductionRuntimeGuards,
  isValidSmtpUrl,
  type ProductionGuardEnv
} from "#@/server/production-guards";

const productionBase: ProductionGuardEnv = {
  GITHUB_CLIENT_ID: "",
  GITHUB_CLIENT_SECRET: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  IS_BUILD: false,
  MAIL_PROVIDER: "resend",
  MINIO_ACCESS_KEY_ID: "",
  MINIO_BUCKET: "",
  MINIO_ENDPOINT: "",
  MINIO_SECRET_ACCESS_KEY: "",
  NODE_ENV: "production",
  REQUIRE_EMAIL_VERIFICATION: true,
  RESEND_API_KEY: "re_test_key",
  SMTP_URL: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: ""
};

describe("isValidSmtpUrl", () => {
  it.each([
    { value: "smtp://user:pass@host:587", expected: true },
    { value: "smtps://user:pass@host:465", expected: true },
    { value: "http://host", expected: false },
    { value: "", expected: false }
  ])("validates $value as $expected", ({ value, expected }) => {
    expect(isValidSmtpUrl(value)).toBe(expected);
  });
});

describe("assertProductionMailConfig", () => {
  it.each([
    {
      name: "rejects console mail when verification is required",
      env: { ...productionBase, MAIL_PROVIDER: "console" as const, RESEND_API_KEY: "" },
      message: "MAIL_PROVIDER=console cannot deliver verification emails"
    },
    {
      name: "rejects resend without API key",
      env: { ...productionBase, MAIL_PROVIDER: "resend" as const, RESEND_API_KEY: "" },
      message: "MAIL_PROVIDER=resend requires a valid re_... RESEND_API_KEY"
    },
    {
      name: "rejects smtp without valid URL",
      env: {
        ...productionBase,
        MAIL_PROVIDER: "smtp" as const,
        REQUIRE_EMAIL_VERIFICATION: false,
        RESEND_API_KEY: "",
        SMTP_URL: "not-a-url"
      },
      message: "MAIL_PROVIDER=smtp requires a valid SMTP_URL"
    }
  ])("$name", ({ env, message }) => {
    expect(() => assertProductionMailConfig(env)).toThrow(message);
  });

  it("accepts a complete resend configuration", () => {
    expect(() => assertProductionMailConfig(productionBase)).not.toThrow();
  });
});

describe("assertProductionCredentialGroups", () => {
  it.each([
    {
      name: "rejects partial Google OAuth",
      env: { ...productionBase, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "" },
      message: "Google OAuth is partially configured"
    },
    {
      name: "rejects partial GitHub OAuth",
      env: { ...productionBase, GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "" },
      message: "GitHub OAuth is partially configured"
    },
    {
      name: "rejects partial Stripe",
      env: { ...productionBase, STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "" },
      message: "Stripe is partially configured"
    },
    {
      name: "rejects partial MinIO",
      env: {
        ...productionBase,
        MINIO_ACCESS_KEY_ID: "key",
        MINIO_BUCKET: "bucket",
        MINIO_ENDPOINT: "http://minio:9000",
        MINIO_SECRET_ACCESS_KEY: ""
      },
      message: "Object storage is partially configured"
    }
  ])("$name", ({ env, message }) => {
    expect(() => assertProductionCredentialGroups(env)).toThrow(message);
  });

  it("accepts fully disabled optional integrations", () => {
    expect(() => assertProductionCredentialGroups(productionBase)).not.toThrow();
  });

  it("accepts complete optional integration groups", () => {
    expect(() =>
      assertProductionCredentialGroups({
        ...productionBase,
        GITHUB_CLIENT_ID: "gh",
        GITHUB_CLIENT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google",
        GOOGLE_CLIENT_SECRET: "secret",
        MINIO_ACCESS_KEY_ID: "key",
        MINIO_BUCKET: "bucket",
        MINIO_ENDPOINT: "http://minio:9000",
        MINIO_SECRET_ACCESS_KEY: "secret",
        STRIPE_SECRET_KEY: "sk_test",
        STRIPE_WEBHOOK_SECRET: "whsec_test"
      })
    ).not.toThrow();
  });
});

describe("assertProductionRuntimeGuards", () => {
  it("skips runtime guards during build", () => {
    expect(() =>
      assertProductionRuntimeGuards({
        ...productionBase,
        IS_BUILD: true,
        MAIL_PROVIDER: "console",
        RESEND_API_KEY: ""
      })
    ).not.toThrow();
  });

  it("skips runtime guards outside production", () => {
    expect(() =>
      assertProductionRuntimeGuards({
        ...productionBase,
        MAIL_PROVIDER: "console",
        NODE_ENV: "development",
        RESEND_API_KEY: ""
      })
    ).not.toThrow();
  });
});
