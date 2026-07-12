import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveUnitTestQueuePrefix, resolveUnitTestRedisUrl } from "#@/__tests__/test-env";

describe("unit test env helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats an empty REDIS_URL as disabled", () => {
    vi.stubEnv("REDIS_URL", "");
    expect(resolveUnitTestRedisUrl()).toBeUndefined();
  });

  it("defaults REDIS_URL for local runs when unset", () => {
    vi.stubEnv("REDIS_URL", undefined);
    vi.stubEnv("SKIP_REDIS_UNIT_TESTS", undefined);
    expect(resolveUnitTestRedisUrl()).toBe("redis://localhost:6379/15");
  });

  it("disables Redis suites when SKIP_REDIS_UNIT_TESTS is set", () => {
    vi.stubEnv("SKIP_REDIS_UNIT_TESTS", "1");
    expect(resolveUnitTestRedisUrl()).toBeUndefined();
  });

  it("uses an explicit queue prefix when provided", () => {
    vi.stubEnv("QUEUE_PREFIX", "custom-prefix");
    vi.stubEnv("GITHUB_RUN_ID", undefined);
    expect(resolveUnitTestQueuePrefix()).toBe("custom-prefix");
  });

  it("generates a unique queue prefix per invocation when unset", () => {
    vi.stubEnv("QUEUE_PREFIX", undefined);
    vi.stubEnv("GITHUB_RUN_ID", undefined);
    const first = resolveUnitTestQueuePrefix();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1);
    const second = resolveUnitTestQueuePrefix();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^vitest-\d+-/);
  });

  it("scopes CI queue prefixes to the workflow run", () => {
    vi.stubEnv("QUEUE_PREFIX", undefined);
    vi.stubEnv("GITHUB_RUN_ID", "12345");
    vi.stubEnv("GITHUB_RUN_ATTEMPT", "2");
    expect(resolveUnitTestQueuePrefix()).toBe(`vitest-ci-12345-2-${process.pid}`);
  });
});
