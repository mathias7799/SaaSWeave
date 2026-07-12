import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const isRedisEnabled = vi.fn();
const enqueueTemplateEmail = vi.fn();
const enqueueNotification = vi.fn();
const enqueueWebhookDelivery = vi.fn();
const runTemplateEmail = vi.fn();
const createNotifications = vi.fn();
const getEnabledWebhookTargets = vi.fn();
const deliverWebhookHttp = vi.fn();

vi.mock("@saasweave/cache", () => {
  return {
    isRedisEnabled: () => isRedisEnabled()
  };
});

vi.mock("#@/queues", () => {
  return {
    enqueueNotification: (...args: unknown[]) => enqueueNotification(...args),
    enqueueTemplateEmail: (...args: unknown[]) => enqueueTemplateEmail(...args),
    enqueueWebhookDelivery: (...args: unknown[]) => enqueueWebhookDelivery(...args)
  };
});

vi.mock("#@/template-email", () => {
  return {
    runTemplateEmail: (...args: unknown[]) => runTemplateEmail(...args)
  };
});

vi.mock("@saasweave/db", () => {
  return {
    createNotifications: (...args: unknown[]) => createNotifications(...args),
    deliverWebhookHttp: (...args: unknown[]) => deliverWebhookHttp(...args),
    getEnabledWebhookTargets: (...args: unknown[]) => getEnabledWebhookTargets(...args)
  };
});

const { dispatchNotification, dispatchTemplateEmail } = await import("#@/dispatch");
const { dispatchOrgWebhook } = await import("#@/webhook-dispatch");

describe("dispatchTemplateEmail", () => {
  beforeEach(() => {
    isRedisEnabled.mockReset();
    enqueueTemplateEmail.mockReset();
    runTemplateEmail.mockReset();
    enqueueTemplateEmail.mockResolvedValue(undefined);
    runTemplateEmail.mockResolvedValue(undefined);
  });

  it("enqueues when Redis is enabled", async () => {
    isRedisEnabled.mockReturnValue(true);
    const data = {
      key: "welcome",
      meta: { organizationId: "org_1" },
      to: "user@example.com",
      values: { name: "Ada" }
    };

    await dispatchTemplateEmail(data);

    expect(enqueueTemplateEmail).toHaveBeenCalledWith(data);
    expect(runTemplateEmail).not.toHaveBeenCalled();
  });

  it("runs inline when Redis is disabled", async () => {
    isRedisEnabled.mockReturnValue(false);

    await dispatchTemplateEmail({
      key: "welcome",
      to: "user@example.com",
      values: { name: "Ada" },
      meta: { organizationId: "org_1" }
    });

    expect(runTemplateEmail).toHaveBeenCalledWith(
      "welcome",
      "user@example.com",
      { name: "Ada" },
      { organizationId: "org_1" }
    );
    expect(enqueueTemplateEmail).not.toHaveBeenCalled();
  });
});

describe("dispatchNotification", () => {
  beforeEach(() => {
    isRedisEnabled.mockReset();
    enqueueNotification.mockReset();
    createNotifications.mockReset();
    enqueueNotification.mockResolvedValue(undefined);
    createNotifications.mockResolvedValue(undefined);
  });

  it("enqueues when Redis is enabled", async () => {
    isRedisEnabled.mockReturnValue(true);
    const data = {
      audience: { kind: "user" as const, userId: "user_1" },
      organizationId: "org_1",
      title: "Hello",
      type: "info"
    };

    await dispatchNotification(data);

    expect(enqueueNotification).toHaveBeenCalledWith(data);
    expect(createNotifications).not.toHaveBeenCalled();
  });

  it("creates notifications inline when Redis is disabled", async () => {
    isRedisEnabled.mockReturnValue(false);
    const data = {
      audience: { kind: "user" as const, userId: "user_1" },
      organizationId: "org_1",
      title: "Hello",
      type: "info"
    };

    await dispatchNotification(data);

    expect(createNotifications).toHaveBeenCalledWith(data);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });
});

describe("dispatchOrgWebhook", () => {
  beforeEach(() => {
    isRedisEnabled.mockReset();
    enqueueWebhookDelivery.mockReset();
    deliverWebhookHttp.mockReset();
    getEnabledWebhookTargets.mockReset();
    enqueueWebhookDelivery.mockResolvedValue(undefined);
    deliverWebhookHttp.mockResolvedValue({ ok: true, responseBody: "", responseStatus: 200 });
    getEnabledWebhookTargets.mockResolvedValue([
      {
        endpointId: "ep_1",
        secret: "whsec_test",
        url: "https://example.com/hook"
      }
    ]);
  });

  it("enqueues webhook delivery when Redis is enabled", async () => {
    isRedisEnabled.mockReturnValue(true);

    await dispatchOrgWebhook("org_1", "member.added", { userId: "u1" });

    expect(enqueueWebhookDelivery).toHaveBeenCalledOnce();
    expect(deliverWebhookHttp).not.toHaveBeenCalled();
    expect(enqueueWebhookDelivery.mock.calls[0]?.[0]).toMatchObject({
      endpointId: "ep_1",
      url: "https://example.com/hook"
    });
  });

  it("delivers inline when Redis is disabled", async () => {
    isRedisEnabled.mockReturnValue(false);

    await dispatchOrgWebhook("org_1", "member.added", { userId: "u1" });

    expect(deliverWebhookHttp).toHaveBeenCalledOnce();
    expect(enqueueWebhookDelivery).not.toHaveBeenCalled();
  });
});

describe("dispatch error handling", () => {
  beforeEach(() => {
    isRedisEnabled.mockReset();
    enqueueTemplateEmail.mockReset();
    enqueueNotification.mockReset();
    runTemplateEmail.mockReset();
    createNotifications.mockReset();
  });

  it("swallows template email enqueue failures", async () => {
    isRedisEnabled.mockReturnValue(true);
    enqueueTemplateEmail.mockRejectedValue(new Error("queue unavailable"));

    await expect(
      dispatchTemplateEmail({ key: "welcome", to: "user@example.com" })
    ).resolves.toBeUndefined();
  });

  it("swallows inline template email failures", async () => {
    isRedisEnabled.mockReturnValue(false);
    runTemplateEmail.mockRejectedValue(new Error("mailer unavailable"));

    await expect(
      dispatchTemplateEmail({ key: "welcome", to: "user@example.com" })
    ).resolves.toBeUndefined();
  });

  it("swallows notification enqueue failures", async () => {
    isRedisEnabled.mockReturnValue(true);
    enqueueNotification.mockRejectedValue(new Error("queue unavailable"));

    await expect(
      dispatchNotification({
        audience: { kind: "user", userId: "user_1" },
        organizationId: "org_1",
        title: "Hello",
        type: "info"
      })
    ).resolves.toBeUndefined();
  });

  it("swallows inline notification failures", async () => {
    isRedisEnabled.mockReturnValue(false);
    createNotifications.mockRejectedValue(new Error("database unavailable"));

    await expect(
      dispatchNotification({
        audience: { kind: "user", userId: "user_1" },
        organizationId: "org_1",
        title: "Hello",
        type: "info"
      })
    ).resolves.toBeUndefined();
  });
});
