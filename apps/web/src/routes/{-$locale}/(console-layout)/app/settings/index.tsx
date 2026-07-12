import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { getAuthUserQueryOptions } from "@saasweave/auth/react/tanstack-start/queries";

import { generateAppSeo } from "@/shared/lib/seo";

import { SettingsPage } from "@/pages/console/settings";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/settings/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/settings", locale: params.locale },
      description: "Workspace configuration, data export, and account details.",
      robots: { follow: false, index: false },
      title: "Settings"
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { data: user } = useQuery(getAuthUserQueryOptions());

  if (!user) return null;

  return <SettingsPage userEmail={user.email} userName={user.name} />;
}
