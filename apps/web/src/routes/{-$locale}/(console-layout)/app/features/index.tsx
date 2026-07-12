import { createFileRoute } from "@tanstack/react-router";

import { redirect } from "@saasweave/i18n/tanstack-start/lib/redirect";

export const Route = createFileRoute("/{-$locale}/(console-layout)/app/features/")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  }
});
