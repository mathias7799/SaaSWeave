import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { AiUsagePage } from "@/pages/console/ai-usage";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/ai-usage/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "ai_assistant");
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.console.aiUsage.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/ai-usage", locale: params.locale },
      description: "AI token consumption, per-model cost, and feature-level attribution.",
      robots: { follow: false, index: false },
      title: "AI usage"
    }),
  component: AiUsagePage
});
