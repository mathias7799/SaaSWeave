import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminWorkspaceDetailPage } from "@/pages/admin/workspaces";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/workspaces/$id/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      orpc.admin.workspaces.detail.queryOptions({ input: { id: params.id } })
    ),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: `/admin/workspaces/${params.id}`, locale: params.locale },
      description: "Plan, team, activity, and feature overrides for one workspace.",
      robots: { follow: false, index: false },
      title: "Workspace detail"
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { id } = Route.useParams();
  return <AdminWorkspaceDetailPage id={id} />;
}
