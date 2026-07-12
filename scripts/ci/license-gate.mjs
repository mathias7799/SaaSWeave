#!/usr/bin/env node
/**
 * Validate production dependency licenses against .github/approved-licenses.json.
 * Usage: node scripts/ci/license-gate.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const policy = JSON.parse(readFileSync(join(root, ".github/approved-licenses.json"), "utf8"));
const allowed = new Set(policy.allowed.map((s) => s.toUpperCase()));
const documented = new Map(policy.documentedExceptions.map((e) => [e.package, e.spdx]));

function normalizeLicense(license) {
  return license.trim().replace(/^MIT License$/i, "MIT");
}

function isAllowedLicense(license) {
  const normalized = normalizeLicense(license).replace(/[()]/g, "");
  if (normalized.toUpperCase() === "UNKNOWN") return false;
  if (/\sOR\s/i.test(normalized)) {
    return normalized.split(/\sOR\s/i).some((part) => allowed.has(part.trim().toUpperCase()));
  }
  return allowed.has(normalized.toUpperCase());
}

const raw = execSync("pnpm licenses list --prod --json", {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

const byLicense = JSON.parse(raw);
const entries = [];
for (const [license, packages] of Object.entries(byLicense)) {
  for (const pkg of packages) {
    entries.push({ name: pkg.name, license: pkg.license ?? license });
  }
}
const violations = [];

for (const row of entries) {
  const name = row.name;
  const license = (row.license ?? "UNKNOWN").trim();
  if (!name) continue;

  const documentedSpdx = documented.get(name);
  if (documentedSpdx) {
    if (license.toUpperCase() === "UNKNOWN") continue;
    if (license.toUpperCase() === documentedSpdx.toUpperCase()) continue;
  }

  const normalized = normalizeLicense(license);
  if (license === "UNKNOWN" || !isAllowedLicense(normalized)) {
    violations.push({ name, license });
  }
}

if (violations.length > 0) {
  console.error("License gate failed — unapproved production licenses:");
  for (const v of violations) {
    console.error(`  - ${v.name}: ${v.license}`);
  }
  process.exit(1);
}

console.log(`License gate passed (${entries.length} production packages).`);
