import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

import { generateAppSeo } from "@/shared/lib/seo";

import { requireConsoleFeature } from "@/features/console-nav";

import { NotificationsPage } from "@/pages/console/notifications";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/notifications/")({
  beforeLoad: async ({ context, preload }) => {
    if (!preload) {
      await requireConsoleFeature(context.queryClient, "notifications");
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(orpc.console.notifications.list.queryOptions()),
  head: ({ params }) =>
    generateAppSeo({
      alternates: { canonicalPath: "/app/notifications", locale: params.locale },
      description: "Your workspace notifications and account updates.",
      robots: { follow: false, index: false },
      title: "Notifications"
    }),
  component: NotificationsPage
});
