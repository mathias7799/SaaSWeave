import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminPlansPage } from "@/pages/admin/plans";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/plans/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.admin.platformStats.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin/plans", locale: params.locale },
      description: "Define plans, pricing, and the platform billing model.",
      robots: { follow: false, index: false },
      title: "Plans & catalog"
    }),
  component: AdminPlansPage
});
