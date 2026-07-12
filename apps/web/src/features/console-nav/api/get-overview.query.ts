import { useQuery } from "@tanstack/react-query";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

/** Shares the cache key with the overview page — cheap when it's already loaded. */
export function useGetSidebarOverviewQuery() {
  return useQuery(orpc.console.overview.queryOptions());
}
