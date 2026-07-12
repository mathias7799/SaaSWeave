import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { ForgotPasswordForm } from "@/features/auth";

import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/{-$locale}/(centered-layout)/(guest)/forgot-password/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/forgot-password", locale: params.locale },
      description: `Reset the password for your ${appConfig.site.shortName} account.`,
      robots: { follow: false, index: false },
      title: "Forgot Password"
    }),
  component: ForgotPasswordForm
});
