import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const plansQueryKeys = {
  all() {
    return orpc.platform.plans.queryKey();
  }
};

export function getPlansQueryOptions() {
  return orpc.platform.plans.queryOptions();
}

export function useGetPlansQuery() {
  return useQuery(getPlansQueryOptions());
}

export type PlansQueryResult = Awaited<ReturnType<typeof client.platform.plans>>;
