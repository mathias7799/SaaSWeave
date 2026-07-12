import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { AuditPage } from "@/pages/console/audit";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/audit/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "audit_logs");
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.console.auditLog.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/audit", locale: params.locale },
      description: "Every member, billing, and settings change in your workspace.",
      robots: { follow: false, index: false },
      title: "Audit log"
    }),
  component: AuditPage
});
