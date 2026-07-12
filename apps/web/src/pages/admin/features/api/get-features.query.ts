import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const featuresQueryKeys = {
  all() {
    return orpc.admin.features.list.queryKey({ input: {} });
  }
};

export function getFeaturesQueryOptions() {
  return orpc.admin.features.list.queryOptions({ input: {} });
}

export function useGetFeaturesQuery() {
  return useQuery(getFeaturesQueryOptions());
}

export type FeaturesQueryResult = Awaited<ReturnType<typeof client.admin.features.list>>;
export type AdminFeature = FeaturesQueryResult["features"][number];
