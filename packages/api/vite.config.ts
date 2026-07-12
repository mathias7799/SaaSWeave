import { defineConfig } from "vite-plus";

const integration = process.env.VITEST_INTEGRATION === "1";
const allTests = process.env.VITEST_ALL === "1";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/**/__tests__/**"],
      include: ["src/**/*.ts"]
    },
    exclude:
      integration || allTests
        ? ["**/node_modules/**"]
        : ["**/node_modules/**", "src/**/__tests__/**/*.integration.test.ts"],
    fileParallelism: allTests ? false : undefined,
    globalSetup:
      integration || allTests ? ["./src/__tests__/integration/global-setup.ts"] : undefined,
    include: integration
      ? ["src/**/__tests__/**/*.integration.test.ts"]
      : allTests
        ? ["src/**/__tests__/**/*.test.ts"]
        : ["src/**/__tests__/**/*.test.ts"]
  }
});
