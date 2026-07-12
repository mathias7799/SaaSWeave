import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const emailTemplatesQueryKeys = {
  all() {
    return orpc.admin.emails.list.queryKey();
  }
};

export function getEmailTemplatesQueryOptions() {
  return orpc.admin.emails.list.queryOptions();
}

export function useGetEmailTemplatesQuery() {
  return useQuery(getEmailTemplatesQueryOptions());
}

export type EmailTemplatesQueryResult = Awaited<ReturnType<typeof client.admin.emails.list>>;
