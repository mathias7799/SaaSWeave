import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminAnalyticsPage } from "@/pages/admin/analytics";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.admin.platformStats.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin", locale: params.locale },
      description: "Platform-wide revenue, retention, and plan analytics.",
      robots: { follow: false, index: false },
      title: "Platform analytics"
    }),
  component: AdminAnalyticsPage
});
