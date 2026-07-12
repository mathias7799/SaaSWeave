/** Resolves Redis URL for jobs package tests (empty string disables Redis suites). */
export function resolveUnitTestRedisUrl(): string | undefined {
  if (process.env.SKIP_REDIS_UNIT_TESTS === "1") return undefined;

  const raw = process.env.REDIS_URL;
  if (raw === "") return undefined;
  if (raw) return raw;
  return "redis://localhost:6379/15";
}

/** Unique BullMQ prefix per test invocation so CI jobs and local workers never collide. */
export function resolveUnitTestQueuePrefix(): string {
  const explicit = process.env.QUEUE_PREFIX?.trim();
  if (explicit) return explicit;

  const runId = process.env.GITHUB_RUN_ID;
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
  if (runId) {
    return `vitest-ci-${runId}-${runAttempt}-${process.pid}`;
  }

  return `vitest-${process.pid}-${Date.now().toString(36)}`;
}
