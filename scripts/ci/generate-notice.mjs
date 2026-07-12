#!/usr/bin/env node
/**
 * Generate NOTICE from production dependency licenses.
 * Usage: node scripts/ci/generate-notice.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const policy = JSON.parse(readFileSync(join(root, ".github/approved-licenses.json"), "utf8"));
const copyleftAttribution = new Map(
  (policy.copyleftAttributions ?? []).map((entry) => [entry.package, entry])
);
const raw = execSync("pnpm licenses list --prod --json", {
  cwd: root,
  encoding: "utf8"
});
const byLicense = JSON.parse(raw);
const entries = [];
for (const [license, packages] of Object.entries(byLicense)) {
  for (const pkg of packages) {
    entries.push({ name: pkg.name, license: pkg.license ?? license });
  }
}

const lines = [
  "SaaSWeave (saasweave) - third-party notices",
  "Generated deterministically from the production dependency lockfile.",
  "",
  "This file lists production npm dependencies and their SPDX license identifiers.",
  "Copyleft entries also include policy-owned copyright and canonical license-text metadata.",
  "See docs/LICENSE-POLICY.md for approval policy and documented exceptions.",
  ""
];

const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

for (const row of sorted) {
  const name = row.name;
  let license = row.license ?? "UNKNOWN";
  if (name === "@paper-design/shaders" || name === "@paper-design/shaders-react") {
    license = "Apache-2.0 (registry; see docs/LICENSE-POLICY.md)";
  }
  const attribution = copyleftAttribution.get(name);
  if (/LGPL|MPL/.test(license)) {
    if (!attribution?.copyrightHolder || !attribution?.licenseTextUrl) {
      throw new Error(`Missing copyleft attribution policy for ${name}`);
    }
    lines.push(
      `${name} — ${license}; copyright: ${attribution.copyrightHolder}; license text: ${attribution.licenseTextUrl}`
    );
  } else {
    lines.push(`${name} — ${license}`);
  }
}

writeFileSync(join(root, "NOTICE"), `${lines.join("\n")}\n`);
console.log(`Wrote NOTICE (${sorted.length} packages).`);
