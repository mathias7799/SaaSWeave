/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

const PUBLIC_WEBHOOK_URL = "https://example.com/webhooks/integration";

async function seedWebhooksFeature(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedOrganizationPlan(seed.organizationId);
  await seedOrganizationFeatureFlags(seed.organizationId, { webhooks: true });
}

describe.sequential("console webhooks", () => {
  integrationIt("list returns an empty array before any endpoints exist", async () => {
    const seed = await seedOrgWithOwner();
    await seedWebhooksFeature(seed);
    const caller = await createCallerFor({ seed });

    const endpoints = await caller.console.webhooks.list();

    expect(endpoints).toEqual([]);
  });

  integrationIt("create registers an endpoint and returns a signing secret", async () => {
    const seed = await seedOrgWithOwner();
    await seedWebhooksFeature(seed);
    const caller = await createCallerFor({ seed });

    const created = await caller.console.webhooks.create({
      events: ["usage.recorded"],
      url: PUBLIC_WEBHOOK_URL
    });

    expect(created.secret.startsWith("whsec_")).toBe(true);
    const listed = await caller.console.webhooks.list();
    expect(listed).toEqual([
      expect.objectContaining({
        enabled: true,
        events: ["usage.recorded"],
        url: PUBLIC_WEBHOOK_URL
      })
    ]);
  });

  integrationIt("create rejects blocked private-network URLs (INVALID_URL)", async () => {
    const seed = await seedOrgWithOwner();
    await seedWebhooksFeature(seed);
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () =>
        caller.console.webhooks.create({
          events: ["usage.recorded"],
          url: "http://127.0.0.1/hook"
        }),
      "INVALID_URL"
    );
  });

  integrationIt(
    "setEnabled, deliveries, sendTest, and delete manage an endpoint lifecycle",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedWebhooksFeature(seed);
      const caller = await createCallerFor({ seed });
      const created = await caller.console.webhooks.create({
        events: ["usage.recorded"],
        url: PUBLIC_WEBHOOK_URL
      });

      await caller.console.webhooks.setEnabled({ enabled: false, id: created.id });
      const listed = await caller.console.webhooks.list();
      expect(listed[0]?.enabled).toBe(false);

      const deliveries = await caller.console.webhooks.deliveries({ endpointId: created.id });
      expect(deliveries).toEqual([]);

      const testResult = await caller.console.webhooks.sendTest({ id: created.id });
      expect(testResult.ok).toBeTypeOf("boolean");
      expect(testResult.responseStatus).toBeTypeOf("number");

      const deleted = await caller.console.webhooks.delete({ id: created.id });
      expect(deleted).toEqual({ ok: true });
      expect(await caller.console.webhooks.list()).toEqual([]);
    }
  );

  integrationIt("delete returns NOT_FOUND for unknown endpoint ids", async () => {
    const seed = await seedOrgWithOwner();
    await seedWebhooksFeature(seed);
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.webhooks.delete({ id: "missing-endpoint" }),
      "NOT_FOUND"
    );
  });

  integrationIt("setEnabled returns NOT_FOUND for unknown endpoint ids", async () => {
    const seed = await seedOrgWithOwner();
    await seedWebhooksFeature(seed);
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.webhooks.setEnabled({ enabled: false, id: "missing-endpoint" }),
      "NOT_FOUND"
    );
  });
});
