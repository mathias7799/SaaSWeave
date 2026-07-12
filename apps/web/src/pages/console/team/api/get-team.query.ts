import { useQuery, useQueryClient } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const teamQueryKeys = {
  all() {
    return orpc.console.team.queryOptions().queryKey;
  }
};

export function getTeamQueryOptions() {
  return orpc.console.team.queryOptions();
}

export function useGetTeamQuery() {
  return useQuery(getTeamQueryOptions());
}

export function useInvalidateTeamQuery() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: teamQueryKeys.all() });
}

export type TeamQueryResult = Awaited<ReturnType<typeof client.console.team>>;
