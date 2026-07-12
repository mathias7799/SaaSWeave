import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { getEmailCopy, recordEmailDelivery, sendTemplate } = vi.hoisted(() => {
  return {
    getEmailCopy: vi.fn(),
    recordEmailDelivery: vi.fn(),
    sendTemplate: vi.fn()
  };
});

vi.mock("@saasweave/db", () => {
  return {
    getEmailCopy,
    recordEmailDelivery
  };
});

vi.mock("@saasweave/mailer", () => {
  return {
    sendTemplate
  };
});

const { runTemplateEmail, templateEmailDeps } = await import("#@/template-email");

describe("templateEmailDeps", () => {
  it("wires db copy lookup and delivery recording into the mailer", () => {
    expect(templateEmailDeps.getCopy).toBe(getEmailCopy);
    expect(templateEmailDeps.recordDelivery).toBe(recordEmailDelivery);
  });
});

describe("runTemplateEmail", () => {
  beforeEach(() => {
    sendTemplate.mockReset();
    sendTemplate.mockResolvedValue(undefined);
  });

  it("delegates to sendTemplate with db-backed deps and defaults", async () => {
    await runTemplateEmail("welcome", "user@example.com");

    expect(sendTemplate).toHaveBeenCalledWith(
      "welcome",
      "user@example.com",
      {},
      {},
      templateEmailDeps
    );
  });

  it("forwards template values and organization metadata", async () => {
    await runTemplateEmail(
      "invite",
      "member@example.com",
      { orgName: "Acme" },
      { organizationId: "org_1" }
    );

    expect(sendTemplate).toHaveBeenCalledWith(
      "invite",
      "member@example.com",
      { orgName: "Acme" },
      { organizationId: "org_1" },
      templateEmailDeps
    );
  });
});
