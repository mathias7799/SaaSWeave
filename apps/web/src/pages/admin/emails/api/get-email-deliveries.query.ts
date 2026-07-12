import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const emailDeliveriesQueryKeys = {
  all() {
    return orpc.admin.emails.deliveries.queryKey();
  }
};

export function getEmailDeliveriesQueryOptions() {
  return orpc.admin.emails.deliveries.queryOptions();
}

export function useGetEmailDeliveriesQuery() {
  return useQuery(getEmailDeliveriesQueryOptions());
}

export type EmailDeliveriesQueryResult = Awaited<ReturnType<typeof client.admin.emails.deliveries>>;
