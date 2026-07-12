import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { PricingPage } from "@/pages/pricing";

export const Route = createFileRoute("/{-$locale}/(root-layout)/pricing/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orpc.platform.plans.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/pricing", locale: params.locale },
      description: "Simple, transparent pricing. Pick a plan and start today.",
      title: "Pricing"
    }),
  component: PricingPage
});
