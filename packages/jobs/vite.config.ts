import { defineConfig } from "vite-plus";

import { resolveUnitTestQueuePrefix, resolveUnitTestRedisUrl } from "#@/__tests__/test-env";

const unitTestRedisUrl = resolveUnitTestRedisUrl();
const unitTestQueuePrefix = resolveUnitTestQueuePrefix();

export default defineConfig({
  test: {
    env: {
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? "test-secret-at-least-32-characters-long",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://postgres:changeme@localhost:5432/saasweave",
      NODE_ENV: "development",
      QUEUE_PREFIX: unitTestQueuePrefix,
      SKIP_REDIS_UNIT_TESTS: process.env.SKIP_REDIS_UNIT_TESTS ?? "",
      VITE_SERVER_URL: process.env.VITE_SERVER_URL ?? "http://localhost:5000/server",
      VITE_WEB_URL: process.env.VITE_WEB_URL ?? "http://localhost:3000",
      ...(unitTestRedisUrl ? { REDIS_URL: unitTestRedisUrl } : {})
    },
    fileParallelism: false,
    include: ["**/__tests__/**/*.test.ts"]
  }
});
