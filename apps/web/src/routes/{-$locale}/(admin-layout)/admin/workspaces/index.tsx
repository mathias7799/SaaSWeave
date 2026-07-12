import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminWorkspacesPage } from "@/pages/admin/workspaces";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/workspaces/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.admin.workspaces.list.queryOptions({ input: {} })),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin/workspaces", locale: params.locale },
      description: "Every customer workspace with plan, seats, and health.",
      robots: { follow: false, index: false },
      title: "Workspaces"
    }),
  component: AdminWorkspacesPage
});
