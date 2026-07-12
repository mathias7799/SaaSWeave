import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { ApiKeysPage } from "@/pages/console/api-keys";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/api-keys/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "api_keys");
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.console.apiKeys.list.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/api-keys", locale: params.locale },
      description: "Generate and manage API keys for scripts and integrations.",
      robots: { follow: false, index: false },
      title: "API keys"
    }),
  component: ApiKeysPage
});
