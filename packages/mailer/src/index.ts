import "@tanstack/react-start/server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";

import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";

import { renderTemplate } from "#@/render";

const log = createLogger({ operation: "server__mailer" });

export { EMAIL_TEMPLATES, getTemplate } from "#@/templates/registry";
export type { EmailTemplate, TemplateField } from "#@/templates/registry";
export { renderTemplate, templateDefaults } from "#@/render";
export type { RenderedEmail } from "#@/render";

export type EmailDeliveryStatus = "sent" | "logged" | "failed";

export type EmailCopyOverride = {
  subject: string | null;
  copy: Record<string, string>;
};

export type EmailDeliveryRecord = {
  templateKey: string;
  recipient: string;
  subject: string;
  status: EmailDeliveryStatus;
  provider: string;
  error?: string | null;
  organizationId?: string | null;
};

export type SendTemplateDeps = {
  getCopy: (key: string) => Promise<EmailCopyOverride>;
  recordDelivery: (record: EmailDeliveryRecord) => Promise<void>;
};

const defaultSendTemplateDeps: SendTemplateDeps = {
  getCopy: async () => {
    return { copy: {}, subject: null };
  },
  recordDelivery: async () => {}
};

export type SendEmailInput = { to: string; subject: string; html: string; text: string };

export function isMailLive(): boolean {
  const provider = ENV_SERVER.MAIL_PROVIDER;
  if (provider === "resend") return ENV_SERVER.RESEND_API_KEY.length > 0;
  if (provider === "smtp") return ENV_SERVER.SMTP_URL.length > 0;
  return false;
}

/**
 * Send one email through the configured provider. With MAIL_PROVIDER=console
 * (the default) it logs instead of sending, so the template runs with no setup.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const from = ENV_SERVER.MAIL_FROM;
  const provider = ENV_SERVER.MAIL_PROVIDER;

  if (provider === "resend" && ENV_SERVER.RESEND_API_KEY) {
    const resend = new Resend(ENV_SERVER.RESEND_API_KEY);
    await resend.emails.send({
      from,
      html: input.html,
      subject: input.subject,
      text: input.text,
      to: input.to
    });
    return;
  }

  if (provider === "smtp" && ENV_SERVER.SMTP_URL) {
    const transport = nodemailer.createTransport(ENV_SERVER.SMTP_URL);
    await transport.sendMail({
      from,
      html: input.html,
      subject: input.subject,
      text: input.text,
      to: input.to
    });
    return;
  }

  log.emit({
    event: "email_console_mode",
    reason: "mail_provider_not_configured",
    subject: input.subject,
    to: input.to
  });
}

export type SendTemplateMeta = { organizationId?: string | null };

/**
 * Render a template (applying copy/subject overrides from `deps.getCopy`) and
 * send it. `values` supplies runtime data. When `deps.recordDelivery` is
 * provided, every attempt is written to the delivery log. Rethrows on send
 * failure so queue workers can retry.
 */
export async function sendTemplate(
  key: string,
  to: string,
  values: Record<string, string> = {},
  meta: SendTemplateMeta = {},
  deps: SendTemplateDeps = defaultSendTemplateDeps
): Promise<void> {
  const provider = ENV_SERVER.MAIL_PROVIDER;
  let subject = key;

  const override = await deps.getCopy(key);
  const rendered = await renderTemplate(key, values, override.copy, override.subject);
  if (!rendered) return;
  subject = rendered.subject;

  const record = async (status: EmailDeliveryStatus, error: string | null) => {
    try {
      await deps.recordDelivery({
        error,
        organizationId: meta.organizationId ?? null,
        provider,
        recipient: to,
        status,
        subject,
        templateKey: key
      });
    } catch (recordError) {
      log.error(recordError instanceof Error ? recordError : String(recordError), {
        event: "email_delivery_record_failed",
        template: key
      });
    }
  };

  try {
    await sendEmail({ html: rendered.html, subject: rendered.subject, text: rendered.text, to });
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught);
    log.error(caught instanceof Error ? caught : String(caught), {
      event: "email_template_failed",
      template: key
    });
    await record("failed", error);
    throw caught;
  }
  await record(isMailLive() ? "sent" : "logged", null);
}
