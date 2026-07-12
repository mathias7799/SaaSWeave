import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminEmailsPage } from "@/pages/admin/emails";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/emails/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.admin.emails.list.queryOptions()),
      context.queryClient.ensureQueryData(orpc.admin.emails.deliveries.queryOptions())
    ]),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin/emails", locale: params.locale },
      description: "Edit and preview transactional email templates.",
      robots: { follow: false, index: false },
      title: "Transactional emails"
    }),
  component: AdminEmailsPage
});
