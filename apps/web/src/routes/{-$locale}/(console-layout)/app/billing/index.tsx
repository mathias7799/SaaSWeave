import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { BillingPage } from "@/pages/console/billing";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/billing/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "billing_portal");
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.console.billing.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/billing", locale: params.locale },
      description: "Plan, usage-based estimate, metered usage, and invoice history.",
      robots: { follow: false, index: false },
      title: "Billing"
    }),
  component: BillingPage
});
