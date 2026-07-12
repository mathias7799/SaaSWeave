import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getBillingQueryOptions() {
  return orpc.console.billing.queryOptions();
}

export function useGetBillingQuery() {
  return useQuery(getBillingQueryOptions());
}

export type BillingQueryResult = Awaited<ReturnType<typeof client.console.billing>>;
