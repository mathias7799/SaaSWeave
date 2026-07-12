#!/usr/bin/env node
/**
 * Representative capacity smoke gate for CI.
 * Run: pnpm test:capacity:smoke
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportDir = join(__dirname, "../../docs/capacity");
const reportPath = process.env.CAPACITY_REPORT_PATH ?? join(reportDir, "CAPACITY-SMOKE-REPORT.md");

const targets = {
  exportHeapDeltaMaxBytes: 12 * 1_024 * 1_024,
  p95RpcMs: 500,
  cacheInvalidateMs: 50
};

async function measure(label, fn) {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { durationMs, label, result };
}

async function main() {
  const lines = [
    "# Capacity smoke report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Targets",
    "",
    `- Export heap delta max: ${targets.exportHeapDeltaMaxBytes} bytes`,
    `- RPC p95 smoke ceiling: ${targets.p95RpcMs} ms`,
    `- Cache tag invalidation smoke ceiling: ${targets.cacheInvalidateMs} ms`,
    "",
    "## Smoke measurements",
    ""
  ];

  const { cacheInvalidateTag, cacheSet, closeRedis, getMemoryCacheStats } =
    await import("../../packages/cache/src/index.ts");

  const cacheWrites = await measure("cache-writes-200", async () => {
    for (let index = 0; index < 200; index += 1) {
      await cacheSet(`capacity:${index}`, { index }, { tags: ["capacity-smoke"] });
    }
    return getMemoryCacheStats();
  });

  const cacheInvalidate = await measure("cache-invalidate-tag", async () => {
    return cacheInvalidateTag("capacity-smoke");
  });

  lines.push(`- cache writes (200 entries): ${cacheWrites.durationMs.toFixed(1)} ms`);
  lines.push(
    `- cache invalidate tag: ${cacheInvalidate.durationMs.toFixed(1)} ms (removed ~${cacheInvalidate.result})`
  );
  lines.push(`- memory cache entries after writes: ${cacheWrites.result.entries}`);
  lines.push(`- memory cache bytes after writes: ${cacheWrites.result.bytes}`);

  const passed =
    cacheInvalidate.durationMs <= targets.cacheInvalidateMs && cacheWrites.result.entries <= 1_000;

  lines.push("", "## Result", "", passed ? "PASS" : "FAIL");
  lines.push("", "## Reproduce", "", "```bash", "pnpm test:capacity:smoke", "```");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  await closeRedis();

  if (!passed) {
    console.error(`Capacity smoke failed. See ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Capacity smoke passed. Report: ${reportPath}`);
}

await main();
