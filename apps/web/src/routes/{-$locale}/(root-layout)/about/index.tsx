import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { AboutPage } from "@/pages/about";

export const Route = createFileRoute("/{-$locale}/(root-layout)/about/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/about", locale: params.locale },
      description: "The operations console for AI-native teams.",
      title: "About"
    }),
  component: AboutPage
});
