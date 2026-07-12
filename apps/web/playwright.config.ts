import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const serverDir = resolve(rootDir, "../server");
const envFile = resolve(rootDir, "../../packages/env/.env");

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const serverURL = process.env.E2E_SERVER_URL ?? "http://127.0.0.1:5000/server";
const webPort = new URL(baseURL).port || "3000";
const serverPort = new URL(serverURL).port || "5000";
const webReadinessUrl = `${baseURL}/sign-in/`;
const serverReadinessUrl = `${serverURL}/health/ready`;

const sharedServerEnv: Record<string, string> = {
  NODE_ENV: "development",
  REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION ?? "false",
  VITE_SERVER_URL: serverURL,
  VITE_WEB_URL: baseURL
};

for (const key of ["BETTER_AUTH_SECRET", "DATABASE_URL", "QUEUE_PREFIX", "REDIS_URL"] as const) {
  const value = process.env[key];
  if (value) sharedServerEnv[key] = value;
}

export default defineConfig({
  testDir: "./__e2e__/playwright",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    video: process.env.CI ? "retain-on-failure" : "off"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--no-sandbox", "--disable-dev-shm-usage"] }
      }
    }
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : [
        {
          command: `pnpm dotenvx run -f ${envFile} -- node --import tsx src/index.ts`,
          cwd: serverDir,
          env: {
            ...sharedServerEnv,
            PORT: serverPort
          },
          gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
          reuseExistingServer: !process.env.CI,
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: serverReadinessUrl
        },
        {
          command: `pnpm dotenvx run -f ${envFile} -- vp dev --host 127.0.0.1 --port ${webPort} --strictPort`,
          cwd: rootDir,
          env: {
            ...sharedServerEnv,
            NODE_ENV: "development"
          },
          gracefulShutdown: { signal: "SIGTERM", timeout: 20_000 },
          reuseExistingServer: !process.env.CI,
          stderr: "pipe",
          stdout: "pipe",
          timeout: 180_000,
          url: webReadinessUrl
        }
      ]
});
