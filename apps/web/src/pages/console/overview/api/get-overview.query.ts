import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getOverviewQueryOptions() {
  return orpc.console.overview.queryOptions();
}

export function useGetOverviewQuery() {
  return useQuery(getOverviewQueryOptions());
}

export type OverviewQueryResult = Awaited<ReturnType<typeof client.console.overview>>;
