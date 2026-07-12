#!/usr/bin/env node
/** Validate the pre-release framework exception table and reject stale pins. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const policyPath =
  process.env.FRAMEWORK_EXCEPTIONS_PATH ?? join(root, "docs/SUPPLY-CHAIN-EXCEPTIONS.md");
const today = process.env.GOVERNANCE_TODAY ?? new Date().toISOString().slice(0, 10);
const document = readFileSync(policyPath, "utf8");

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
const section = document.match(/## Pre-release framework pins\s+([\s\S]*?)(?=\n## |$)/)?.[1];

if (!section) {
  console.error("Missing 'Pre-release framework pins' section.");
  process.exit(1);
}

const rows = section
  .split("\n")
  .filter((line) => line.trim().startsWith("|") && !/^\s*\|\s*[-:]+/.test(line))
  .slice(1)
  .map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim())
  );

if (rows.length === 0) {
  console.error("Framework exception table must contain at least one exception.");
  process.exit(1);
}

const invalid = [];
const expired = [];
for (const [index, cells] of rows.entries()) {
  if (cells.length !== 5) {
    invalid.push(`row ${index + 1}: expected 5 columns, found ${cells.length}`);
    continue;
  }
  const [rawPackage, pin, reviewBy, rationale, mitigation] = cells;
  const packageName = rawPackage.replaceAll("`", "");
  if (!packageName || !pin || !rationale || !mitigation) {
    invalid.push(`${packageName || `row ${index + 1}`}: all fields must be non-empty`);
  }
  if (!isIsoDate(reviewBy)) {
    invalid.push(`${packageName}: review date must be YYYY-MM-DD`);
  } else if (reviewBy < today) {
    expired.push(`${packageName} (review by ${reviewBy})`);
  }
}

if (invalid.length > 0) {
  console.error("Invalid framework exception entries:");
  for (const entry of invalid) console.error(`  - ${entry}`);
  process.exit(1);
}

if (expired.length > 0) {
  console.error("Expired framework exception entries:");
  for (const entry of expired) console.error(`  - ${entry}`);
  process.exit(1);
}

console.log(`Framework exception check passed (${rows.length} time-bounded pins).`);
