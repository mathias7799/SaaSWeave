import { type QueryClient } from "@tanstack/react-query";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { redirect } from "@saasweave/i18n/tanstack-start/lib/redirect";

/** Redirect to workspace overview when a gated console route is not enabled. */
export async function requireConsoleFeature(queryClient: QueryClient, featureKey: string) {
  const features = await queryClient.ensureQueryData(orpc.console.features.queryOptions());
  const feature = features.find((entry) => entry.key === featureKey);
  if (!feature?.enabledForOrg) {
    throw redirect({ to: "/app" });
  }
}
