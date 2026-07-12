#!/usr/bin/env node
/**
 * Validate audit allowlist entries are current and not expired.
 * Usage: node scripts/ci/audit-allowlist-check.mjs [audit.json]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const auditPath = process.argv[2] ?? "/tmp/audit.json";
const allowlistPath =
  process.env.AUDIT_ALLOWLIST_PATH ?? join(root, ".github/audit-allowlist.json");

const requiredFields = [
  "id",
  "affected_path",
  "exploitability",
  "owner",
  "added_date",
  "review_by",
  "upstream_url"
];

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

const allowlistDoc = JSON.parse(readFileSync(allowlistPath, "utf8"));
if (!Array.isArray(allowlistDoc.exceptions)) {
  console.error("Audit allowlist must contain an exceptions array.");
  process.exit(1);
}

const today = process.env.GOVERNANCE_TODAY ?? new Date().toISOString().slice(0, 10);
const allowedIds = new Set();
const expired = [];
const invalid = [];

for (const [index, entry] of allowlistDoc.exceptions.entries()) {
  const label = entry?.id || `entry ${index + 1}`;
  for (const field of requiredFields) {
    if (typeof entry?.[field] !== "string" || entry[field].trim() === "") {
      invalid.push(`${label}: missing non-empty ${field}`);
    }
  }
  if (!isIsoDate(entry?.added_date)) invalid.push(`${label}: added_date must be YYYY-MM-DD`);
  if (!isIsoDate(entry?.review_by)) invalid.push(`${label}: review_by must be YYYY-MM-DD`);
  if (isIsoDate(entry?.added_date) && entry.added_date > today) {
    invalid.push(`${label}: added_date cannot be in the future`);
  }
  if (
    isIsoDate(entry?.added_date) &&
    isIsoDate(entry?.review_by) &&
    entry.review_by < entry.added_date
  ) {
    invalid.push(`${label}: review_by precedes added_date`);
  }
  if (typeof entry?.upstream_url === "string" && !/^https:\/\//.test(entry.upstream_url)) {
    invalid.push(`${label}: upstream_url must use https://`);
  }
  if (allowedIds.has(entry?.id)) invalid.push(`${label}: duplicate advisory id`);
  if (isIsoDate(entry?.review_by) && entry.review_by < today) {
    expired.push(`${entry.id} (review_by ${entry.review_by})`);
  }
  if (typeof entry?.id === "string" && entry.id) allowedIds.add(entry.id);
}

if (invalid.length > 0) {
  console.error("Invalid audit allowlist entries:");
  for (const entry of invalid) console.error(`  - ${entry}`);
  process.exit(1);
}

if (expired.length > 0) {
  console.error("Expired audit allowlist entries:");
  for (const e of expired) console.error(`  - ${e}`);
  process.exit(1);
}

let audit;
try {
  audit = JSON.parse(readFileSync(auditPath, "utf8"));
} catch {
  console.error(`Missing or invalid audit JSON at ${auditPath}`);
  process.exit(1);
}

const blocking = [];
for (const adv of Object.values(audit.advisories ?? {})) {
  const ghsa = adv.github_advisory_id ?? "";
  if (!allowedIds.has(ghsa)) {
    blocking.push(`${ghsa} (${adv.module_name}): ${adv.title}`);
  }
}

if (blocking.length > 0) {
  console.error("Blocking production advisories not on allowlist:");
  for (const b of blocking) console.error(`  - ${b}`);
  process.exit(1);
}

console.log("Audit allowlist check passed.");
