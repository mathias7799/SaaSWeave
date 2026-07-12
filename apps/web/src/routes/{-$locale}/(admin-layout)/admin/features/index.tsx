import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminFeaturesPage } from "@/pages/admin/features";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/features/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin/features", locale: params.locale },
      description: "Enable or disable workspace capabilities across the platform.",
      robots: { follow: false, index: false },
      title: "Platform features"
    }),
  component: AdminFeaturesPage
});
