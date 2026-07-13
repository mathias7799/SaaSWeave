#!/usr/bin/env node
/**
 * Risk-based per-package line coverage thresholds (minimum floors).
 * Run after unit tests with coverage enabled per package.
 */
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

/** Package filter → minimum line coverage percent. */
const THRESHOLDS = {
  "@saasweave/server": 90,
  "@saasweave/web": 90,
  "@saasweave/db": 90,
  "@saasweave/i18n": 90,
  "@saasweave/ui": 90,
  "@saasweave/core": 90,
  "@saasweave/cache": 90,
  "@saasweave/logger": 90,
  "@saasweave/mailer": 90,
  "@saasweave/env": 90,
  "@saasweave/auth": 90,
  "@saasweave/jobs": 90,
  "@saasweave/app": 90,
  "@saasweave/api": 90,
  "@saasweave/worker": 90,
  "@saasweave/observability": 90,
  "@saasweave/seo": 90
};

const packages = Object.keys(THRESHOLDS);
let failed = false;

function readLineCoverage(summaryPath) {
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const lines = summary.total?.lines?.pct;
  if (typeof lines !== "number" || !Number.isFinite(lines)) {
    throw new Error("coverage-summary.json is missing total.lines.pct");
  }
  return lines;
}

for (const pkg of packages) {
  const filter = pkg === "@saasweave/worker" ? "@saasweave/worker" : pkg;
  const reportDirectory = `/tmp/saasweave-coverage/${pkg.replaceAll(/[^a-z0-9-]/gi, "-")}`;
  const summaryPath = join(reportDirectory, "coverage-summary.json");
  rmSync(reportDirectory, { force: true, recursive: true });
  // API integration tests cover its transport and persistence boundaries. This is their sole
  // full-suite CI invocation; the integration job retains only the non-instrumented memory guard.
  const testCommand =
    pkg === "@saasweave/api"
      ? `VITEST_ALL=1 pnpm --filter ${filter} exec vp test --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=${reportDirectory}`
      : `pnpm --filter ${filter} exec vp test --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=${reportDirectory}`;
  try {
    execSync(`${testCommand} 2>&1`, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        BETTER_AUTH_SECRET:
          process.env.BETTER_AUTH_SECRET ?? "coverage-only-secret-000000000000000000000000",
        COVERAGE_RUN: "1",
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://postgres:changeme@localhost:5432/saasweave_test",
        NODE_ENV: process.env.NODE_ENV ?? "development",
        REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379/15"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const lines = readLineCoverage(summaryPath);
    const min = THRESHOLDS[pkg];
    if (lines < min) {
      console.error(`coverage-gate: ${pkg} line coverage ${lines}% < ${min}%`);
      failed = true;
    } else {
      console.log(`coverage-gate: ${pkg} — ${lines}% lines (min ${min}%)`);
    }
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    console.error(`coverage-gate: ${pkg} test run or coverage report failed`);
    console.error(output || error.message);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("coverage-gate: OK");
