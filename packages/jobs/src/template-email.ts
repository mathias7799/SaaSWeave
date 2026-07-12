import { getEmailCopy, recordEmailDelivery } from "@saasweave/db";
import { sendTemplate, type SendTemplateDeps, type SendTemplateMeta } from "@saasweave/mailer";

/** DB-backed copy lookup and delivery logging for transactional template sends. */
export const templateEmailDeps: SendTemplateDeps = {
  getCopy: getEmailCopy,
  recordDelivery: recordEmailDelivery
};

/** Run a template email with admin copy overrides and delivery recording. */
export async function runTemplateEmail(
  key: string,
  to: string,
  values: Record<string, string> = {},
  meta: SendTemplateMeta = {}
): Promise<void> {
  await sendTemplate(key, to, values, meta, templateEmailDeps);
}
