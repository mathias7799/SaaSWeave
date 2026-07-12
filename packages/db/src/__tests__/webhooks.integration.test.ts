import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  getEnabledWebhookTargets,
  getWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  recordWebhookDelivery,
  setWebhookEndpointEnabled
} from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

const PUBLIC_WEBHOOK_URL = "https://example.com/webhooks/integration";

describe.sequential("webhooks", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates, lists, enables, and deletes webhook endpoints", async () => {
    const seed = await seedOrgWithOwner();

    const created = await createWebhookEndpoint({
      events: ["usage.recorded", "member.joined"],
      organizationId: seed.organizationId,
      url: PUBLIC_WEBHOOK_URL
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.secret.startsWith("whsec_")).toBe(true);

    const listed = await listWebhookEndpoints(seed.organizationId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.url).toBe(PUBLIC_WEBHOOK_URL);
    expect(listed[0]?.enabled).toBe(true);

    const fetched = await getWebhookEndpoint(seed.organizationId, created.id);
    expect(fetched?.events).toEqual(["usage.recorded", "member.joined"]);

    const disabled = await setWebhookEndpointEnabled(seed.organizationId, created.id, false);
    expect(disabled).toBe(true);

    const targets = await getEnabledWebhookTargets(seed.organizationId, "usage.recorded");
    expect(targets).toHaveLength(0);

    await setWebhookEndpointEnabled(seed.organizationId, created.id, true);
    const enabledTargets = await getEnabledWebhookTargets(seed.organizationId, "usage.recorded");
    expect(enabledTargets).toHaveLength(1);
    expect(enabledTargets[0]?.endpointId).toBe(created.id);

    const deleted = await deleteWebhookEndpoint(seed.organizationId, created.id);
    expect(deleted).toBe(true);
    expect(await listWebhookEndpoints(seed.organizationId)).toHaveLength(0);

    const missingDelete = await deleteWebhookEndpoint(seed.organizationId, created.id);
    expect(missingDelete).toBe(false);
  });

  it("records and lists webhook deliveries", async () => {
    const seed = await seedOrgWithOwner();
    const created = await createWebhookEndpoint({
      events: ["usage.recorded"],
      organizationId: seed.organizationId,
      url: PUBLIC_WEBHOOK_URL
    });

    await recordWebhookDelivery({
      endpointId: created.id,
      eventType: "usage.recorded",
      payload: { quantity: 10 },
      responseBody: "ok",
      responseStatus: 200,
      status: "delivered"
    });
    await recordWebhookDelivery({
      endpointId: created.id,
      eventType: "usage.recorded",
      payload: { quantity: 5 },
      responseStatus: null,
      status: "failed"
    });

    const deliveries = await listWebhookDeliveries(seed.organizationId, created.id, 10);
    expect(deliveries).toHaveLength(2);
    const statuses = deliveries.map((entry) => entry.status);
    expect(statuses).toContain("delivered");
    expect(statuses).toContain("failed");
  });
});
