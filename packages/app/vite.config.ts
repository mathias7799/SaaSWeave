import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts"],
      include: ["src/**/*.ts"]
    },
    include: ["**/__tests__/**/*.test.ts"]
  }
});
