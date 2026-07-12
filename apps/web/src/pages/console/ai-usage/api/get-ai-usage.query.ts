import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getAiUsageQueryOptions() {
  return orpc.console.aiUsage.queryOptions();
}

export function useGetAiUsageQuery() {
  return useQuery(getAiUsageQueryOptions());
}

export type AiUsageQueryResult = Awaited<ReturnType<typeof client.console.aiUsage>>;
