import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminSettingsPage } from "@/pages/admin/settings";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/settings/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin/settings", locale: params.locale },
      description: "Global configuration for the SaaSWeave platform.",
      robots: { follow: false, index: false },
      title: "Platform settings"
    }),
  component: AdminSettingsPage
});
