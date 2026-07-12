import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WILDCARD_EXPORT_PACKAGES = new Set(["@saasweave/i18n", "@saasweave/seo", "@saasweave/ui"]);
const TOOLING_PACKAGE = "@saasweave/tsconfig";

const ALLOWED_EDGES: Record<string, string[]> = {
  "@saasweave/api": ["app", "auth", "cache", "core", "db", "env", "jobs", "logger", "mailer"],
  "@saasweave/app": ["cache", "core", "db", "env", "logger", "observability"],
  "@saasweave/auth": ["db", "env", "jobs", "observability"],
  "@saasweave/cache": ["env", "logger", "observability"],
  "@saasweave/core": [],
  "@saasweave/db": ["core", "env", "logger", "observability"],
  "@saasweave/env": [],
  "@saasweave/i18n": [],
  "@saasweave/jobs": ["app", "cache", "core", "db", "env", "logger", "mailer", "observability"],
  "@saasweave/logger": ["core"],
  "@saasweave/mailer": ["env", "logger"],
  "@saasweave/observability": ["env"],
  "@saasweave/seo": [],
  "@saasweave/server": [
    "api",
    "app",
    "auth",
    "cache",
    "core",
    "db",
    "env",
    "logger",
    "observability"
  ],
  "@saasweave/ui": [],
  "@saasweave/web": ["api", "auth", "core", "env", "i18n", "logger", "seo", "ui"],
  "@saasweave/worker": ["app", "cache", "db", "env", "jobs", "logger", "observability"]
};

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
  name: string;
};

function workspaceRoots(): string[] {
  return ["apps", "packages"].flatMap((group) =>
    readdirSync(join(repoRoot, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${group}/${entry.name}`)
      .filter((root) => {
        try {
          return readManifest(root).name.startsWith("@saasweave/");
        } catch {
          return false;
        }
      })
  );
}

function readManifest(packageRoot: string): Manifest {
  return JSON.parse(readFileSync(join(repoRoot, packageRoot, "package.json"), "utf8")) as Manifest;
}

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (["node_modules", "__tests__", "dist", ".output"].includes(entry)) continue;
      walkSourceFiles(absolute, files);
    } else if (/\.(?:ts|tsx)$/.test(entry)) {
      files.push(absolute);
    }
  }
  return files;
}

describe("package boundary rules", () => {
  const roots = workspaceRoots();

  it("defines an allowed dependency graph for every app and package", () => {
    expect(roots.map((root) => readManifest(root).name).sort()).toEqual(
      Object.keys(ALLOWED_EDGES).sort()
    );
  });

  it("keeps workspace dependencies within the allowed graph", () => {
    const offenders: string[] = [];
    for (const root of roots) {
      const manifest = readManifest(root);
      const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
      const allowed = new Set(
        ALLOWED_EDGES[manifest.name].map((name) => `@saasweave/${name}`).concat(TOOLING_PACKAGE)
      );
      for (const dependency of Object.keys(dependencies).filter((name) =>
        name.startsWith("@saasweave/")
      )) {
        if (!allowed.has(dependency)) offenders.push(`${manifest.name} -> ${dependency}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("allows wildcard exports only for designated presentation packages", () => {
    const offenders: string[] = [];
    for (const root of roots.filter((root) => root.startsWith("packages/"))) {
      const manifest = readManifest(root);
      const wildcard = Object.keys(manifest.exports ?? {}).some((key) => key.includes("*"));
      if (wildcard && !WILDCARD_EXPORT_PACKAGES.has(manifest.name)) offenders.push(manifest.name);
    }
    expect(offenders).toEqual([]);
  });

  it("rejects deep imports into any workspace src tree", () => {
    const offenders: string[] = [];
    for (const root of roots) {
      const conventionalSourceRoot = join(repoRoot, root, "src");
      const sourceRoot = existsSync(conventionalSourceRoot)
        ? conventionalSourceRoot
        : join(repoRoot, root);
      for (const file of walkSourceFiles(sourceRoot)) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(/@saasweave\/[^'"\s]+\/src\//g)) {
          offenders.push(`${relative(repoRoot, file)} -> ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
