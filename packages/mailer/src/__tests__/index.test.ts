import { Resend } from "resend";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
  mailEnv,
  mockCreateTransport,
  mockLoggerEmit,
  mockLoggerError,
  mockResendSend,
  mockSendMail
} = vi.hoisted(() => {
  const mailEnv = {
    MAIL_FROM: "SaaSWeave <hello@example.com>",
    MAIL_PROVIDER: "console" as "console" | "resend" | "smtp",
    RESEND_API_KEY: "",
    SMTP_URL: ""
  };

  const mockLoggerEmit = vi.fn();
  const mockLoggerError = vi.fn();
  const mockResendSend = vi.fn();
  const mockSendMail = vi.fn();
  const mockCreateTransport = vi.fn(() => {
    return { sendMail: mockSendMail };
  });

  return {
    mailEnv,
    mockCreateTransport,
    mockLoggerEmit,
    mockLoggerError,
    mockResendSend,
    mockSendMail
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: mailEnv
  };
});

vi.mock("@saasweave/logger/server", () => {
  return {
    createLogger: () => {
      return {
        emit: mockLoggerEmit,
        error: mockLoggerError
      };
    }
  };
});

vi.mock("resend", () => {
  return {
    Resend: vi.fn(function ResendMock(this: { emails: { send: typeof mockResendSend } }) {
      this.emails = { send: mockResendSend };
    })
  };
});

vi.mock("nodemailer", () => {
  return {
    default: {
      createTransport: mockCreateTransport
    }
  };
});

const {
  EMAIL_TEMPLATES,
  getTemplate,
  isMailLive,
  renderTemplate,
  sendEmail,
  sendTemplate,
  templateDefaults
} = await import("#@/index");

const sampleEmail = {
  html: "<p>Hello</p>",
  subject: "Test subject",
  text: "Hello",
  to: "user@example.com"
};

function resetMailEnv(): void {
  mailEnv.MAIL_FROM = "SaaSWeave <hello@example.com>";
  mailEnv.MAIL_PROVIDER = "console";
  mailEnv.RESEND_API_KEY = "";
  mailEnv.SMTP_URL = "";
}

describe("mailer exports", () => {
  it("re-exports template registry helpers", () => {
    expect(EMAIL_TEMPLATES.length).toBeGreaterThan(0);
    expect(getTemplate("welcome")).toBeDefined();
    expect(getTemplate("missing-template")).toBeUndefined();
  });

  it("re-exports render helpers", async () => {
    const template = getTemplate("welcome");
    expect(template).toBeDefined();
    expect(templateDefaults(template!)).toMatchObject({ name: expect.any(String) });

    const rendered = await renderTemplate("welcome", { name: "Jane" });
    expect(rendered).not.toBeNull();
    expect(rendered!.subject).toContain("Jane");
  });
});

describe("isMailLive", () => {
  beforeEach(() => {
    resetMailEnv();
  });

  it("returns false for console provider", () => {
    mailEnv.MAIL_PROVIDER = "console";
    expect(isMailLive()).toBe(false);
  });

  it("returns false for resend without an API key", () => {
    mailEnv.MAIL_PROVIDER = "resend";
    mailEnv.RESEND_API_KEY = "";
    expect(isMailLive()).toBe(false);
  });

  it("returns true for resend with an API key", () => {
    mailEnv.MAIL_PROVIDER = "resend";
    mailEnv.RESEND_API_KEY = "re_test_key";
    expect(isMailLive()).toBe(true);
  });

  it("returns false for smtp without a transport URL", () => {
    mailEnv.MAIL_PROVIDER = "smtp";
    mailEnv.SMTP_URL = "";
    expect(isMailLive()).toBe(false);
  });

  it("returns true for smtp with a transport URL", () => {
    mailEnv.MAIL_PROVIDER = "smtp";
    mailEnv.SMTP_URL = "smtp://user:pass@localhost:587";
    expect(isMailLive()).toBe(true);
  });
});

describe("sendEmail", () => {
  beforeEach(() => {
    resetMailEnv();
    mockLoggerEmit.mockReset();
    mockResendSend.mockReset();
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
    vi.mocked(Resend).mockClear();
    mockResendSend.mockResolvedValue(undefined);
    mockSendMail.mockResolvedValue(undefined);
  });

  it("logs in console mode when no live provider is configured", async () => {
    await sendEmail(sampleEmail);

    expect(mockLoggerEmit).toHaveBeenCalledWith({
      event: "email_console_mode",
      reason: "mail_provider_not_configured",
      subject: sampleEmail.subject,
      to: sampleEmail.to
    });
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("sends through resend when configured", async () => {
    mailEnv.MAIL_PROVIDER = "resend";
    mailEnv.RESEND_API_KEY = "re_live_key";

    await sendEmail(sampleEmail);

    expect(Resend).toHaveBeenCalledWith("re_live_key");
    expect(mockResendSend).toHaveBeenCalledWith({
      from: mailEnv.MAIL_FROM,
      html: sampleEmail.html,
      subject: sampleEmail.subject,
      text: sampleEmail.text,
      to: sampleEmail.to
    });
    expect(mockLoggerEmit).not.toHaveBeenCalled();
  });

  it("falls back to console mode when resend has no API key", async () => {
    mailEnv.MAIL_PROVIDER = "resend";
    mailEnv.RESEND_API_KEY = "";

    await sendEmail(sampleEmail);

    expect(mockResendSend).not.toHaveBeenCalled();
    expect(mockLoggerEmit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "email_console_mode" })
    );
  });

  it("sends through smtp when configured", async () => {
    mailEnv.MAIL_PROVIDER = "smtp";
    mailEnv.SMTP_URL = "smtp://user:pass@localhost:587";

    await sendEmail(sampleEmail);

    expect(mockCreateTransport).toHaveBeenCalledWith("smtp://user:pass@localhost:587");
    expect(mockSendMail).toHaveBeenCalledWith({
      from: mailEnv.MAIL_FROM,
      html: sampleEmail.html,
      subject: sampleEmail.subject,
      text: sampleEmail.text,
      to: sampleEmail.to
    });
    expect(mockLoggerEmit).not.toHaveBeenCalled();
  });
});

describe("sendTemplate", () => {
  const recordDelivery = vi.fn();
  const getCopy = vi.fn();

  beforeEach(() => {
    resetMailEnv();
    recordDelivery.mockReset();
    getCopy.mockReset();
    mockLoggerEmit.mockReset();
    mockLoggerError.mockReset();
    mockResendSend.mockReset();
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
    vi.mocked(Resend).mockClear();
    mockResendSend.mockResolvedValue(undefined);
    mockSendMail.mockResolvedValue(undefined);
    recordDelivery.mockResolvedValue(undefined);
    getCopy.mockResolvedValue({ copy: {}, subject: null });
  });

  it("uses default deps without throwing when deps are omitted", async () => {
    await expect(
      sendTemplate("welcome", "user@example.com", { name: "Jane" })
    ).resolves.toBeUndefined();
    expect(mockLoggerEmit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "email_console_mode" })
    );
  });

  it("returns early for unknown templates without recording delivery", async () => {
    await sendTemplate("unknown-template", "user@example.com", {}, {}, { getCopy, recordDelivery });

    expect(getCopy).toHaveBeenCalledWith("unknown-template");
    expect(recordDelivery).not.toHaveBeenCalled();
  });

  it("renders with copy overrides and records console delivery", async () => {
    getCopy.mockResolvedValue({
      copy: { heading: "Custom welcome heading" },
      subject: "Hello {name}"
    });

    await sendTemplate(
      "welcome",
      "user@example.com",
      { actionUrl: "https://saasweave.io/app", name: "Jane" },
      { organizationId: "org_123" },
      { getCopy, recordDelivery }
    );

    expect(getCopy).toHaveBeenCalledWith("welcome");
    expect(recordDelivery).toHaveBeenCalledWith({
      error: null,
      organizationId: "org_123",
      provider: "console",
      recipient: "user@example.com",
      status: "logged",
      subject: "Hello Jane",
      templateKey: "welcome"
    });
  });

  it("records sent delivery when resend is live", async () => {
    mailEnv.MAIL_PROVIDER = "resend";
    mailEnv.RESEND_API_KEY = "re_live_key";

    await sendTemplate(
      "magic-link",
      "user@example.com",
      {
        actionUrl: "https://saasweave.io/sign-in",
        name: "Jane"
      },
      {},
      { getCopy, recordDelivery }
    );

    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: mailEnv.MAIL_FROM,
        to: "user@example.com"
      })
    );
    expect(recordDelivery).toHaveBeenCalledWith({
      error: null,
      organizationId: null,
      provider: "resend",
      recipient: "user@example.com",
      status: "sent",
      subject: "Your SaaSWeave sign-in link",
      templateKey: "magic-link"
    });
  });

  it("records sent delivery when smtp is live", async () => {
    mailEnv.MAIL_PROVIDER = "smtp";
    mailEnv.SMTP_URL = "smtp://user:pass@localhost:587";

    await sendTemplate(
      "welcome",
      "user@example.com",
      {
        actionUrl: "https://saasweave.io/app",
        name: "Jane"
      },
      {},
      { getCopy, recordDelivery }
    );

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: mailEnv.MAIL_FROM,
        to: "user@example.com"
      })
    );
    expect(recordDelivery).toHaveBeenCalledWith({
      error: null,
      organizationId: null,
      provider: "smtp",
      recipient: "user@example.com",
      status: "sent",
      subject: "Welcome to SaaSWeave, Jane",
      templateKey: "welcome"
    });
  });

  it("records failed delivery and rethrows provider errors", async () => {
    mailEnv.MAIL_PROVIDER = "resend";
    mailEnv.RESEND_API_KEY = "re_live_key";
    mockResendSend.mockRejectedValue(new Error("Resend API error"));

    await expect(
      sendTemplate(
        "welcome",
        "user@example.com",
        {
          actionUrl: "https://saasweave.io/app",
          name: "Jane"
        },
        {},
        { getCopy, recordDelivery }
      )
    ).rejects.toThrow("Resend API error");

    expect(mockLoggerError).toHaveBeenCalledWith(expect.any(Error), {
      event: "email_template_failed",
      template: "welcome"
    });
    expect(recordDelivery).toHaveBeenCalledWith({
      error: "Resend API error",
      organizationId: null,
      provider: "resend",
      recipient: "user@example.com",
      status: "failed",
      subject: "Welcome to SaaSWeave, Jane",
      templateKey: "welcome"
    });
  });

  it("records non-Error provider failures with a string message", async () => {
    mailEnv.MAIL_PROVIDER = "smtp";
    mailEnv.SMTP_URL = "smtp://user:pass@localhost:587";
    mockSendMail.mockRejectedValue("smtp transport down");

    await expect(
      sendTemplate(
        "welcome",
        "user@example.com",
        {
          actionUrl: "https://saasweave.io/app",
          name: "Jane"
        },
        {},
        { getCopy, recordDelivery }
      )
    ).rejects.toBe("smtp transport down");

    expect(mockLoggerError).toHaveBeenCalledWith("smtp transport down", {
      event: "email_template_failed",
      template: "welcome"
    });
    expect(recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "smtp transport down",
        status: "failed"
      })
    );
  });

  it("logs but does not throw when recordDelivery fails after a successful send", async () => {
    recordDelivery.mockRejectedValue(new Error("delivery log unavailable"));

    await expect(
      sendTemplate(
        "welcome",
        "user@example.com",
        {
          actionUrl: "https://saasweave.io/app",
          name: "Jane"
        },
        {},
        { getCopy, recordDelivery }
      )
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(expect.any(Error), {
      event: "email_delivery_record_failed",
      template: "welcome"
    });
  });

  it("logs non-Error recordDelivery failures without throwing", async () => {
    recordDelivery.mockRejectedValue("delivery log write failed");

    await expect(
      sendTemplate(
        "welcome",
        "user@example.com",
        {
          actionUrl: "https://saasweave.io/app",
          name: "Jane"
        },
        {},
        { getCopy, recordDelivery }
      )
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith("delivery log write failed", {
      event: "email_delivery_record_failed",
      template: "welcome"
    });
  });
});
