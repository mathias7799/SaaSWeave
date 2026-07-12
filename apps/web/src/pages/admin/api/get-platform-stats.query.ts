import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getPlatformStatsQueryOptions() {
  return orpc.admin.platformStats.queryOptions();
}

export function useGetPlatformStatsQuery() {
  return useQuery(getPlatformStatsQueryOptions());
}

export type PlatformStatsQueryResult = Awaited<ReturnType<typeof client.admin.platformStats>>;
