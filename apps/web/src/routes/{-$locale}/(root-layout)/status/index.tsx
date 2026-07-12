import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { StatusPage } from "@/pages/status";

export const Route = createFileRoute("/{-$locale}/(root-layout)/status/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/status", locale: params.locale },
      description: "Live platform status and dependency health.",
      title: "Status"
    }),
  component: StatusPage
});
