import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

type PackageJson = {
  exports?: Record<string, string | { default: string }>;
};

function readPackageJson(relativePath: string): PackageJson {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8")) as PackageJson;
}

function exportPaths(pkg: PackageJson): string[] {
  return Object.keys(pkg.exports ?? {});
}

describe("package export surfaces", () => {
  it("core exposes explicit subpaths only", () => {
    const core = readPackageJson("packages/core/package.json");
    expect(exportPaths(core).some((entry) => entry.includes("*"))).toBe(false);
  });

  it("env exposes explicit server and web subpaths only", () => {
    const env = readPackageJson("packages/env/package.json");
    expect(exportPaths(env).some((entry) => entry.includes("*"))).toBe(false);
  });

  it("ui exposes explicit component and utility subpaths only", () => {
    const ui = readPackageJson("packages/ui/package.json");
    expect(exportPaths(ui).some((entry) => entry.includes("*"))).toBe(false);
  });

  it("api browser client avoids server-only imports", () => {
    const browserClient = readFileSync(
      join(repoRoot, "packages/api/src/client/browser/orpc.ts"),
      "utf8"
    );
    expect(browserClient.includes("@saasweave/env/server/env")).toBe(false);
    expect(browserClient.includes("@saasweave/db")).toBe(false);
    expect(browserClient.includes("@saasweave/auth")).toBe(false);
  });

  it("worker app does not depend on api", () => {
    const worker = readPackageJson("apps/worker/package.json") as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(worker.dependencies ?? {})).not.toContain("@saasweave/api");
  });
});
