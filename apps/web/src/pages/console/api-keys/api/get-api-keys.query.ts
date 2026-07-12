import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const apiKeysQueryKeys = {
  all() {
    return orpc.console.apiKeys.list.queryKey();
  }
};

export function getApiKeysQueryOptions() {
  return orpc.console.apiKeys.list.queryOptions();
}

export function useGetApiKeysQuery() {
  return useQuery(getApiKeysQueryOptions());
}

export type ApiKeysQueryResult = Awaited<ReturnType<typeof client.console.apiKeys.list>>;
