import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { ProfilePage } from "@/pages/console/profile";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/profile/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.console.profile.get.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/profile", locale: params.locale },
      description: "Manage your personal account profile.",
      robots: { follow: false, index: false },
      title: "Profile"
    }),
  component: ProfilePage
});
