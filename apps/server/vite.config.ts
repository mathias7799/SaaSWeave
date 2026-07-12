import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.ts"]
  },
  pack: {
    clean: true,
    deps: {
      alwaysBundle: [/./],
      onlyBundle: false
    },
    dts: false,
    entry: "./src/index.ts",
    format: "esm",
    minify: true,
    outDir: "./.output",
    sourcemap: true
  }
});
