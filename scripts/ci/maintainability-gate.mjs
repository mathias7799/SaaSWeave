#!/usr/bin/env node
/**
 * Blocking maintainability gate for CI:
 * - zero lint warnings from `vp check`
 * - Fallow dead-code and architecture clean
 * - duplication below configured threshold
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

const duplicationThreshold = 5;

function run(command) {
  return execSync(command, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

let failed = false;

try {
  const checkOutput = run("pnpm exec vp check 2>&1");
  const warningMatch = checkOutput.match(/Found 0 errors and (\d+) warnings/);
  const noIssues = checkOutput.includes("Found no warnings");
  const warningCount = warningMatch ? Number(warningMatch[1]) : noIssues ? 0 : null;
  if (warningCount === null) {
    console.error("maintainability-gate: could not parse vp check warning count");
    failed = true;
  } else if (warningCount > 0) {
    console.error(`maintainability-gate: vp check reported ${warningCount} warnings (budget: 0)`);
    console.error(checkOutput);
    failed = true;
  } else {
    console.log("maintainability-gate: vp check — 0 warnings");
  }
} catch (error) {
  console.error("maintainability-gate: vp check failed");
  console.error(error.stdout ?? "");
  console.error(error.stderr ?? "");
  failed = true;
}

function parseJsonFromCommandOutput(output) {
  const start = output.search(/^\s*\{/m);
  if (start === -1) {
    throw new Error("No JSON payload found in command output");
  }
  return JSON.parse(output.slice(start));
}

const fallowMetrics = [
  ["unused_files", "unused file(s)"],
  ["unresolved_imports", "unresolved import(s)"],
  ["unlisted_dependencies", "unlisted dependency/dependencies"],
  ["circular_dependencies", "circular dependency cycle(s)"],
  ["boundary_violations", "boundary violation(s)"]
];

function evaluateFallowReport(report) {
  const summary = report.check?.summary ?? report.summary;
  if (!summary || typeof summary !== "object") {
    throw new Error("Fallow JSON is missing check.summary");
  }

  for (const [field, label] of fallowMetrics) {
    const count = summary[field];
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Fallow JSON has invalid ${field}`);
    }
    if (count > 0) {
      console.error(`maintainability-gate: ${count} ${label}`);
      failed = true;
    }
  }

  const dupPercent =
    report.dupes?.stats?.duplication_percentage ??
    report.dupes?.summary?.duplicated_percent ??
    report.duplicates?.duplicated_percent;
  if (typeof dupPercent !== "number" || !Number.isFinite(dupPercent)) {
    throw new Error("Fallow JSON is missing a numeric duplication percentage");
  }
  if (dupPercent > duplicationThreshold) {
    console.error(
      `maintainability-gate: duplication ${dupPercent.toFixed(1)}% exceeds threshold ${duplicationThreshold}%`
    );
    failed = true;
  }

  if (!failed) {
    console.log(
      `maintainability-gate: fallow - 0 unused files/imports, unlisted dependencies, cycles, and boundary violations; duplication ${dupPercent.toFixed(1)}% within ${duplicationThreshold}%`
    );
  }
}

try {
  const fallowOutput = run("pnpm fallow --format json 2>&1");
  evaluateFallowReport(parseJsonFromCommandOutput(fallowOutput));
} catch (error) {
  const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  if (output) {
    try {
      evaluateFallowReport(parseJsonFromCommandOutput(output));
      if (error.status !== 0) {
        console.error(`maintainability-gate: fallow exited with status ${error.status}`);
        failed = true;
      }
    } catch (parseError) {
      console.error("maintainability-gate: fallow failed");
      console.error(parseError.message);
      console.error(output);
      failed = true;
    }
  } else {
    console.error("maintainability-gate: fallow failed", error.message);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("maintainability-gate: OK");
