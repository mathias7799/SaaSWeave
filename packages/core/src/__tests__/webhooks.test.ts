import { describe, expect, it } from "vite-plus/test";

import {
  WEBHOOK_EVENTS,
  WebhookEventSchema,
  WebhookPayloadSchema,
  buildWebhookPayload
} from "@saasweave/core/webhooks";

describe("webhook events", () => {
  it("includes core workspace events", () => {
    expect(WEBHOOK_EVENTS).toContain("member.added");
    expect(WEBHOOK_EVENTS).toContain("usage.recorded");
    expect(WEBHOOK_EVENTS).toContain("api_key.created");
  });

  it("validates known event names", () => {
    expect(WebhookEventSchema.safeParse("usage.recorded").success).toBe(true);
    expect(WebhookEventSchema.safeParse("unknown.event").success).toBe(false);
  });

  it("builds webhook payloads with stable shape", () => {
    const payload = buildWebhookPayload(
      "org_1",
      "member.added",
      { userId: "u1" },
      "2026-01-01T00:00:00.000Z",
      "wh_test_1"
    );
    expect(payload).toEqual({
      id: "wh_test_1",
      createdAt: "2026-01-01T00:00:00.000Z",
      data: { userId: "u1" },
      event: "member.added",
      organizationId: "org_1"
    });
    expect(WebhookPayloadSchema.safeParse(payload).success).toBe(true);
  });
});
