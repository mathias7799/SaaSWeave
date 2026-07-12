import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { TeamPage } from "@/pages/console/team";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/team/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "team_management");
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.console.team.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/team", locale: params.locale },
      description: "Manage workspace members, roles, and seat usage.",
      robots: { follow: false, index: false },
      title: "Team"
    }),
  component: TeamPage
});
