import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const WILDCARD_EXPORT_PACKAGES = new Set(["@saasweave/ui", "@saasweave/seo"]);

const PACKAGE_ROOTS = [
  "packages/core",
  "packages/env",
  "packages/mailer",
  "packages/db",
  "packages/cache",
  "packages/app",
  "packages/jobs",
  "packages/auth",
  "packages/api",
  "packages/logger",
  "packages/i18n"
];

function readPackageName(packageRoot: string): string {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, packageRoot, "package.json"), "utf8")
  ) as {
    name: string;
  };
  return manifest.name;
}

function listExportSubpaths(packageRoot: string): string[] {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, packageRoot, "package.json"), "utf8")
  ) as {
    exports?: Record<string, string>;
  };
  const exports = manifest.exports ?? {};
  return Object.keys(exports).filter((key) => key !== ".");
}

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__" || entry === "dist") continue;
      walkSourceFiles(absolute, files);
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(absolute);
    }
  }
  return files;
}

describe("package boundary rules", () => {
  it("does not use wildcard exports on domain packages", () => {
    for (const packageRoot of PACKAGE_ROOTS) {
      const name = readPackageName(packageRoot);
      expect(WILDCARD_EXPORT_PACKAGES.has(name)).toBe(false);
    }
  });

  it("documents explicit subpath exports for core, env, and mailer", () => {
    for (const packageRoot of ["packages/core", "packages/env", "packages/mailer"]) {
      const subpaths = listExportSubpaths(packageRoot);
      expect(subpaths.length).toBeGreaterThan(0);
      expect(subpaths.some((subpath) => subpath.includes("*"))).toBe(false);
    }
  });

  it("rejects deep imports into another package src tree from apps", () => {
    const offenders: string[] = [];
    const appRoots = ["apps/web/src", "apps/server/src", "apps/worker/src"];

    for (const appRoot of appRoots) {
      const absoluteAppRoot = join(repoRoot, appRoot);
      for (const file of walkSourceFiles(absoluteAppRoot)) {
        const source = readFileSync(file, "utf8");
        const matches = source.matchAll(/@saasweave\/[^'"\s]+\/src\//g);
        for (const match of matches) {
          offenders.push(`${relative(repoRoot, file)} → ${match[0]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
