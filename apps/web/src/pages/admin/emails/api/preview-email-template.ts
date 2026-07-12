import { client } from "@saasweave/api/client/tanstack-start/orpc";

type PreviewEmailTemplateInput = Parameters<typeof client.admin.emails.preview>[0];

export function previewEmailTemplate(input: PreviewEmailTemplateInput) {
  return client.admin.emails.preview(input);
}
