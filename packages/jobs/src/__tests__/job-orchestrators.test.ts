import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const processDataExportRequest = vi.fn();
const applyStripeWebhookInline = vi.fn();
const processQueuedStripeWebhook = vi.fn();
const dispatchNotification = vi.fn();
const dispatchTemplateEmail = vi.fn();

vi.mock("@saasweave/app/data-export/process", () => {
  return { processDataExportRequest: (...args: unknown[]) => processDataExportRequest(...args) };
});

vi.mock("@saasweave/app/stripe/webhook-process", () => {
  return {
    applyStripeWebhookInline: (...args: unknown[]) => applyStripeWebhookInline(...args),
    processQueuedStripeWebhook: (...args: unknown[]) => processQueuedStripeWebhook(...args)
  };
});

vi.mock("#@/dispatch", () => {
  return {
    dispatchNotification: (...args: unknown[]) => dispatchNotification(...args),
    dispatchTemplateEmail: (...args: unknown[]) => dispatchTemplateEmail(...args)
  };
});

const { runDataExportJob } = await import("#@/data-export-job");
const { applyStripeWebhookJob, processQueuedStripeWebhookJob } = await import("#@/stripe-webhook");

describe("data export job orchestration", () => {
  beforeEach(() => {
    processDataExportRequest.mockReset();
    dispatchNotification.mockReset();
  });

  it("notifies the requesting user when an export becomes ready", async () => {
    processDataExportRequest.mockResolvedValue({
      notify: { organizationId: "org_1", requestedByUserId: "user_1" },
      status: "ready"
    });

    await runDataExportJob("export_1");

    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: { kind: "user", userId: "user_1" },
        organizationId: "org_1",
        type: "data_export.ready"
      })
    );
  });

  it("does not notify for incomplete or failed exports", async () => {
    processDataExportRequest.mockResolvedValue({ status: "processing" });

    await runDataExportJob("export_2");

    expect(dispatchNotification).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook side effects", () => {
  const subscriptionCreatedEmail = {
    manageUrl: "https://app.example.test/billing",
    organizationId: "org_1",
    ownerEmail: "owner@example.test",
    ownerName: "Ada",
    planName: "Pro"
  };

  beforeEach(() => {
    applyStripeWebhookInline.mockReset();
    processQueuedStripeWebhook.mockReset();
    dispatchTemplateEmail.mockReset();
  });

  it("processes queued payloads and sends subscription email side effects", async () => {
    processQueuedStripeWebhook.mockResolvedValue({ subscriptionCreatedEmail });

    await processQueuedStripeWebhookJob({ eventId: "evt_1", payload: "{}", type: "invoice.paid" });

    expect(processQueuedStripeWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_1" }),
      expect.stringMatching(/\/app\/billing$/)
    );
    expect(dispatchTemplateEmail).toHaveBeenCalledWith({
      key: "subscription",
      meta: { organizationId: "org_1" },
      to: "owner@example.test",
      values: {
        manageUrl: subscriptionCreatedEmail.manageUrl,
        name: "Ada",
        planName: "Pro"
      }
    });
  });

  it("applies inline events without sending email when no side effect is returned", async () => {
    applyStripeWebhookInline.mockResolvedValue({ subscriptionCreatedEmail: null });

    await applyStripeWebhookJob({ id: "evt_2", type: "customer.updated" } as never);

    expect(applyStripeWebhookInline).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt_2" }),
      expect.stringMatching(/\/app\/billing$/)
    );
    expect(dispatchTemplateEmail).not.toHaveBeenCalled();
  });
});
