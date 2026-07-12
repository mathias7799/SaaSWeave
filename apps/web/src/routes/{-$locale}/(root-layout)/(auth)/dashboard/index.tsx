import { createFileRoute } from "@tanstack/react-router";

import { redirect } from "@saasweave/i18n/tanstack-start/lib/redirect";

/**
 * The dashboard now lives in the dedicated console shell at `/app`.
 * This route is kept as a redirect so existing links keep working.
 */
export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/dashboard/")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  }
});
