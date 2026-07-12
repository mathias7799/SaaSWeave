import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { generateAppSeo } from "@/shared/lib/seo";

import { AcceptInvitePage } from "@/pages/accept-invite";

export const Route = createFileRoute("/{-$locale}/(centered-layout)/(guest)/accept-invite/")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/accept-invite", locale: params.locale },
      description: "Accept a workspace invitation.",
      robots: { follow: false, index: false },
      title: "Accept invitation"
    }),
  component: AcceptInvitePage
});
