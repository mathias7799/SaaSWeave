import { createFileRoute } from "@tanstack/react-router";

import { generateAppSeo } from "@/shared/lib/seo";

import { AdminUsersPage } from "@/pages/admin/users";

export const Route = createFileRoute("/{-$locale}/(admin-layout)/admin/users/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/admin/users", locale: params.locale },
      description: "Every account on the platform. Grant admin access or ban accounts.",
      robots: { follow: false, index: false },
      title: "Users"
    }),
  component: AdminUsersPage
});
