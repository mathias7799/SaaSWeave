import { render } from "react-email";

import { EMAIL_TEMPLATES, getTemplate, type EmailTemplate } from "#@/templates/registry";

export type RenderedEmail = { subject: string; html: string; text: string };

function interpolate(input: string, values: Record<string, string>): string {
  return input.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

/** Default values for a template's fields (copy + data), keyed by field key. */
export function templateDefaults(template: EmailTemplate): Record<string, string> {
  return Object.fromEntries(template.fields.map((field) => [field.key, field.default]));
}

/**
 * Render a template to subject + HTML + plain text. `values` supplies runtime
 * data (recipient name, URLs, …); `copyOverrides` supplies admin-edited copy.
 * Precedence: field defaults < copy overrides < runtime values.
 */
export async function renderTemplate(
  key: string,
  values: Record<string, string> = {},
  copyOverrides: Record<string, string> = {},
  subjectOverride?: string | null
): Promise<RenderedEmail | null> {
  const template = getTemplate(key);
  if (!template) return null;

  const merged = { ...templateDefaults(template), ...copyOverrides, ...values };
  const resolved = Object.fromEntries(
    Object.entries(merged).map(([field, value]) => [field, interpolate(value, merged)])
  );

  const subjectSource =
    subjectOverride && subjectOverride.length > 0 ? subjectOverride : template.subject;
  const subject = interpolate(subjectSource, resolved);
  const html = await render(template.Component(resolved));
  const text = await render(template.Component(resolved), { plainText: true });
  return { html, subject, text };
}

export { EMAIL_TEMPLATES, getTemplate };
