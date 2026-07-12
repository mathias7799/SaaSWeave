import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    coverage: {
      // Paraglide output is generated from messages and tested by its generator/runtime upstream.
      exclude: ["src/paraglide/**"]
    },
    include: ["**/__tests__/**/*.test.ts"]
  }
});
