import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveQueuePrefix } from "#@/queue-prefix";

describe("resolveQueuePrefix", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the live process env over the validated server default", () => {
    vi.stubEnv("QUEUE_PREFIX", "runtime-prefix");
    expect(resolveQueuePrefix()).toBe("runtime-prefix");
  });
});
