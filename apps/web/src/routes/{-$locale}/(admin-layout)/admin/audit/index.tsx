import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminAuditPage } from "@/pages/admin/audit";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/audit/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.admin.auditLog.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin/audit", locale: params.locale },
      description: "Platform-wide audit trail.",
      robots: { follow: false, index: false },
      title: "Audit log"
    }),
  component: AdminAuditPage
});
