import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vite-plus/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];

function temporaryFile(name: string, contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), "governance-gate-"));
  temporaryDirectories.push(directory);
  const path = join(directory, name);
  writeFileSync(path, contents, "utf8");
  return path;
}

function run(script: string, args: string[], env: Record<string, string>): string {
  return execFileSync(process.execPath, [join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GOVERNANCE_TODAY: "2026-07-12", ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("audit allowlist governance", () => {
  const emptyAudit = JSON.stringify({ advisories: {} });

  it("rejects incomplete exceptions", () => {
    const auditPath = temporaryFile("audit.json", emptyAudit);
    const allowlistPath = temporaryFile(
      "allowlist.json",
      JSON.stringify({ exceptions: [{ id: "GHSA-example", review_by: "2026-08-01" }] })
    );

    expect(() =>
      run("scripts/ci/audit-allowlist-check.mjs", [auditPath], {
        AUDIT_ALLOWLIST_PATH: allowlistPath
      })
    ).toThrow();
  });

  it("accepts a complete current exception", () => {
    const auditPath = temporaryFile("audit.json", emptyAudit);
    const allowlistPath = temporaryFile(
      "allowlist.json",
      JSON.stringify({
        exceptions: [
          {
            added_date: "2026-07-01",
            affected_path: "vite > esbuild",
            exploitability: "Build-time only; CI input is trusted.",
            id: "GHSA-example",
            owner: "platform",
            review_by: "2026-08-01",
            upstream_url: "https://github.com/advisories/GHSA-example"
          }
        ]
      })
    );

    expect(
      run("scripts/ci/audit-allowlist-check.mjs", [auditPath], {
        AUDIT_ALLOWLIST_PATH: allowlistPath
      })
    ).toContain("passed");
  });
});

describe("framework exception governance", () => {
  it("rejects an expired framework pin", () => {
    const policyPath = temporaryFile(
      "exceptions.md",
      "## Pre-release framework pins\n\n| Package | Pin | Review by | Rationale | Mitigation |\n| --- | --- | --- | --- | --- |\n| `nitro` | nightly | 2026-07-11 | Required APIs | Exact pin |\n"
    );

    expect(() =>
      run("scripts/ci/framework-exceptions-check.mjs", [], {
        FRAMEWORK_EXCEPTIONS_PATH: policyPath
      })
    ).toThrow();
  });
});
