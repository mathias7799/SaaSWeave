import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getConsoleFeaturesQueryOptions() {
  return orpc.console.features.queryOptions();
}

export function useGetConsoleFeaturesQuery() {
  return useQuery(getConsoleFeaturesQueryOptions());
}

export type ConsoleFeaturesQueryResult = Awaited<ReturnType<typeof client.console.features>>;
export type ConsoleFeature = ConsoleFeaturesQueryResult[number];
