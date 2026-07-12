import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    env: {
      BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
      DATABASE_URL: "postgresql://postgres:changeme@localhost:5432/saasweave",
      NODE_ENV: "development",
      VITE_SERVER_URL: "http://localhost:5000/server",
      VITE_WEB_URL: "http://localhost:3000"
    },
    include: ["**/*.test.ts"]
  },
  pack: {
    clean: true,
    deps: {
      alwaysBundle: [/./],
      onlyBundle: false
    },
    // The worker is a deployable executable, not a published library. Generating
    // declarations here traverses every bundled dependency and exhausts the heap.
    dts: false,
    entry: "./src/index.ts",
    format: "esm",
    minify: true,
    outDir: "./.output",
    sourcemap: true
  }
});
