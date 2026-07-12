import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { SecurityPage } from "@/pages/console/security";

// Better Auth 2FA endpoints (enable/verify/disable) are not gated here; only the
// console surface is hidden when `two_factor` is disabled for the workspace.
export const Route = createFileRoute("/{-$locale}/(console-layout)/app/security/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "two_factor");
    }
  },
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/security", locale: params.locale },
      description: "Manage your password and see where you're signed in.",
      robots: { follow: false, index: false },
      title: "Security"
    }),
  component: SecurityPage
});
