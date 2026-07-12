import { defineConfig } from "vite-plus";

const integration = process.env.VITEST_INTEGRATION === "1";

export default defineConfig({
  test: {
    exclude: integration
      ? ["**/node_modules/**"]
      : ["**/node_modules/**", "src/**/__tests__/**/*.integration.test.ts"],
    fileParallelism: integration ? false : undefined,
    globalSetup: integration ? ["./src/__tests__/integration/global-setup.ts"] : undefined,
    include: integration
      ? ["src/**/__tests__/**/*.integration.test.ts"]
      : ["src/**/__tests__/**/*.test.ts"]
  }
});
