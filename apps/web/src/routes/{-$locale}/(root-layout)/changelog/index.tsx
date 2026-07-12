import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { ChangelogPage } from "@/pages/changelog";

export const Route = createFileRoute("/{-$locale}/(root-layout)/changelog/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/changelog", locale: params.locale },
      description: "Everything shipped to the platform, newest first.",
      title: "Changelog"
    }),
  component: ChangelogPage
});
