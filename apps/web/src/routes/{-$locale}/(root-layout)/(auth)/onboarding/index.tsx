import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { validateNavigateTo } from "@saasweave/i18n/tanstack-start/lib/validate-navigate-to";

import { generateAppSeo } from "@/shared/lib/seo";

import { OnboardingPage } from "@/pages/onboarding";

import { routeTree } from "@/routeTree.gen";

const onboardingSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .catch(undefined)
    .transform((val) =>
      validateNavigateTo({
        fallbackTo: "/app",
        routeTree,
        shouldIncludeRoute: (route) => !route.id.includes("(guest)"),
        to: val
      })
    )
});

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/onboarding/")({
  validateSearch: onboardingSearchSchema,
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/onboarding", locale: params.locale },
      description: "Set up your workspace and invite your team.",
      robots: { follow: false, index: false },
      title: "Welcome"
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { redirect } = Route.useSearch();
  return <OnboardingPage redirectTo={redirect} />;
}
