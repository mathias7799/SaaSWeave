import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { BatchJobsPage } from "@/pages/console/batch-jobs";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/batch-jobs/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "batch_jobs");
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.console.batches.list.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/batch-jobs", locale: params.locale },
      description: "Run async batch jobs with per-item progress tracking.",
      robots: { follow: false, index: false },
      title: "Batch jobs"
    }),
  component: BatchJobsPage
});
