import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { WebhooksPage } from "@/pages/console/webhooks";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/webhooks/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "webhooks");
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.console.webhooks.list.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/webhooks", locale: params.locale },
      description: "Configure outbound webhooks for workspace events.",
      robots: { follow: false, index: false },
      title: "Webhooks"
    }),
  component: WebhooksPage
});
