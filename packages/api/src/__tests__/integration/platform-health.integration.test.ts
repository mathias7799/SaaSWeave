/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import { createCallerFor, integrationIt } from "./harness";

describe.sequential("platform and health routers", () => {
  integrationIt("platform.plans returns the public plan catalog", async () => {
    const caller = await createCallerFor({
      seed: {
        email: "public@integration.test",
        memberId: "unused",
        name: "Public",
        organizationId: "unused",
        organizationName: "Unused",
        organizationSlug: "unused",
        role: "owner",
        sessionId: "unused",
        userId: "unused"
      },
      session: null
    });

    const plans = await caller.platform.plans();

    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]?.id).toBeTruthy();
  });

  integrationIt("platform.settings returns the public settings subset", async () => {
    const caller = await createCallerFor({
      seed: {
        email: "public@integration.test",
        memberId: "unused",
        name: "Public",
        organizationId: "unused",
        organizationName: "Unused",
        organizationSlug: "unused",
        role: "owner",
        sessionId: "unused",
        userId: "unused"
      },
      session: null
    });

    const settings = await caller.platform.settings();

    expect(settings.platformName).toBeTruthy();
    expect(settings).not.toHaveProperty("billingMode");
  });

  integrationIt("health.live reports healthy status", async () => {
    const caller = await createCallerFor({
      seed: {
        email: "health@integration.test",
        memberId: "unused",
        name: "Health",
        organizationId: "unused",
        organizationName: "Unused",
        organizationSlug: "unused",
        role: "owner",
        sessionId: "unused",
        userId: "unused"
      },
      session: null
    });

    const live = await caller.health.live();

    expect(live.status).toBe("healthy");
    expect(live.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  integrationIt("health.ready checks database, redis, and queues", async () => {
    const caller = await createCallerFor({
      seed: {
        email: "health@integration.test",
        memberId: "unused",
        name: "Health",
        organizationId: "unused",
        organizationName: "Unused",
        organizationSlug: "unused",
        role: "owner",
        sessionId: "unused",
        userId: "unused"
      },
      session: null
    });

    const ready = await caller.health.ready();

    expect(ready.status).toBe("healthy");
    expect(ready.checks.database.status).toBe("healthy");
    expect(ready.checks.redis.status).toBe("healthy");
    expect(ready.checks.queues.status).toBe("healthy");
  });
});
