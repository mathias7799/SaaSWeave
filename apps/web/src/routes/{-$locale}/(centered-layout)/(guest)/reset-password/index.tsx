import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { generateAppSeo } from "@/shared/lib/seo";

import { ResetPasswordForm } from "@/features/auth";

import { appConfig } from "@/config/app.config";

const resetPasswordSearchSchema = z.object({
  token: z.string().optional()
});

export const Route = createFileRoute("/{-$locale}/(centered-layout)/(guest)/reset-password/")({
  validateSearch: resetPasswordSearchSchema,
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/reset-password", locale: params.locale },
      description: `Set a new password for your ${appConfig.site.shortName} account.`,
      robots: { follow: false, index: false },
      title: "Reset Password"
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { token } = Route.useSearch();
  return <ResetPasswordForm token={token} />;
}
