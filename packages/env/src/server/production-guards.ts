export type ProductionGuardEnv = {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  IS_BUILD: boolean;
  MAIL_PROVIDER: "console" | "resend" | "smtp";
  MINIO_ACCESS_KEY_ID: string;
  MINIO_BUCKET: string;
  MINIO_ENDPOINT: string;
  MINIO_PUBLIC_BASE_URL: string;
  MINIO_SECRET_ACCESS_KEY: string;
  NODE_ENV: "development" | "production";
  PLATFORM_ADMIN_EMAILS: string;
  REQUIRE_EMAIL_VERIFICATION: boolean;
  RESEND_API_KEY: string;
  SMTP_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
};

function isPartialCredentialGroup(values: string[]): boolean {
  const populated = values.filter((value) => value.length > 0).length;
  return populated > 0 && populated < values.length;
}

export function isValidSmtpUrl(value: string): boolean {
  return /^smtps?:\/\/.+/i.test(value);
}

export function isValidResendApiKey(value: string): boolean {
  return /^re_[A-Za-z0-9_-]+$/.test(value);
}

export function assertProductionMailConfig(env: ProductionGuardEnv): void {
  if (env.REQUIRE_EMAIL_VERIFICATION && env.MAIL_PROVIDER === "console") {
    throw new Error(
      "REQUIRE_EMAIL_VERIFICATION is enabled but MAIL_PROVIDER=console cannot deliver verification emails. Set MAIL_PROVIDER to resend or smtp with valid credentials."
    );
  }

  if (env.MAIL_PROVIDER === "resend" && !isValidResendApiKey(env.RESEND_API_KEY)) {
    throw new Error("MAIL_PROVIDER=resend requires a valid re_... RESEND_API_KEY in production.");
  }

  if (env.MAIL_PROVIDER === "smtp" && !isValidSmtpUrl(env.SMTP_URL)) {
    throw new Error(
      "MAIL_PROVIDER=smtp requires a valid SMTP_URL (for example smtp://user:pass@host:587) in production."
    );
  }
}

export function assertProductionCredentialGroups(env: ProductionGuardEnv): void {
  if (isPartialCredentialGroup([env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET])) {
    throw new Error(
      "Google OAuth is partially configured. Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or leave both empty."
    );
  }

  if (isPartialCredentialGroup([env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET])) {
    throw new Error(
      "GitHub OAuth is partially configured. Set both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET or leave both empty."
    );
  }

  const stripeFields = [env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET];
  if (isPartialCredentialGroup(stripeFields)) {
    throw new Error(
      "Stripe is partially configured. Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET or leave both empty to disable billing."
    );
  }

  const minioFields = [
    env.MINIO_ENDPOINT,
    env.MINIO_BUCKET,
    env.MINIO_ACCESS_KEY_ID,
    env.MINIO_SECRET_ACCESS_KEY,
    env.MINIO_PUBLIC_BASE_URL
  ];
  if (isPartialCredentialGroup(minioFields)) {
    throw new Error(
      "Object storage is partially configured. Set MINIO_ENDPOINT, MINIO_BUCKET, MINIO_ACCESS_KEY_ID, MINIO_SECRET_ACCESS_KEY, and MINIO_PUBLIC_BASE_URL together or leave all empty."
    );
  }
}

export function assertProductionAdminConfig(env: ProductionGuardEnv): void {
  const emails = env.PLATFORM_ADMIN_EMAILS.split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  if (emails.length === 0) {
    throw new Error(
      "PLATFORM_ADMIN_EMAILS must contain at least one administrator email in production."
    );
  }
}

/** Runtime production invariants. Build-time (IS_BUILD) may use placeholders. */
export function assertProductionRuntimeGuards(env: ProductionGuardEnv): void {
  if (env.IS_BUILD || env.NODE_ENV !== "production") return;

  assertProductionAdminConfig(env);
  assertProductionMailConfig(env);
  assertProductionCredentialGroups(env);
}
