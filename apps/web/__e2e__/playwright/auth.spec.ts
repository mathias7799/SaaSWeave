import { type Page, expect, test } from "@playwright/test";

const password = "E2eTestPass1";

function uniqueEmail() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${suffix}@example.com`;
}

async function completeOnboarding(page: Page) {
  await expect(page.getByRole("heading", { name: "Name your workspace" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/app(?:\/|$|\?)/);
}

async function signOutFromConsole(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/app(?:\/|$|\?)/);
}

test.describe("authenticated auth flows", () => {
  test.describe.configure({ mode: "serial" });

  let email: string;

  test.beforeAll(() => {
    email = uniqueEmail();
  });

  test("signs up a new account and lands authenticated", async ({ page }) => {
    await page.goto("/create-an-account");

    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await page.getByLabel("Name").fill("E2E User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "Name your workspace" })).toBeVisible();

    await completeOnboarding(page);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("signs out and signs back in with the same credentials", async ({ page }) => {
    await signIn(page, email);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    await signOutFromConsole(page);
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

    await signIn(page, email);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("shows the authenticated workspace overview", async ({ page }) => {
    await signIn(page, email);
    await expect(page.getByRole("heading", { name: /Welcome back,/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Request volume", exact: true })).toBeVisible();
  });
});

test("redirects unauthenticated /app visitors to sign-in", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test.describe("deferred browser flows (T5 roadmap)", () => {
  // Needs inbox access to read the magic-link email.
  // Manual: request a link on /sign-in, open the email, click the link, confirm you land on /app.
  test.skip("magic-link sign-in consumes an emailed one-time link", async () => {});

  // Needs a TOTP secret from an authenticator enrollment step.
  // Manual: enable 2FA under /app/settings/security, enroll an authenticator app, sign out, sign in again, and enter the TOTP code.
  test.skip("2FA enrollment and login challenge", async () => {});

  // Needs a second mailbox or invite-token capture from email/API.
  // Manual: invite from /app/team, open the invite email in another session, accept, and confirm the member can reach /app.
  test.skip("invite member and accept invite in a second browser context", async () => {});

  // Cross-origin API-key HTTP calls are brittle in browser e2e without a stable test key fixture.
  // Manual: create a key in /app/settings/api-keys, call recordUsage with it, revoke, and confirm the call is rejected.
  test.skip("API key create, recordUsage call, revoke, and denied retry", async () => {});

  // Requires a seeded non-admin session and a known admin-only path.
  // Manual: sign in as a regular member and confirm /admin redirects or shows access denied.
  test.skip("admin route denied for non-admin users", async () => {});
});
