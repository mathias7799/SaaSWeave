import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { getOverviewQueryOptions, OverviewPage } from "@/pages/console/overview";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(getOverviewQueryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app", locale: params.locale },
      description: "Workspace overview, usage metrics, plan allowance, and recent activity.",
      robots: { follow: false, index: false },
      title: "Overview"
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { user } = Route.useRouteContext();

  if (!user) return null;

  return <OverviewPage userName={user.name} />;
}
