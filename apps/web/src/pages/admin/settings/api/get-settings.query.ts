import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const adminSettingsQueryKeys = {
  all() {
    return orpc.admin.settings.get.queryKey();
  }
};

export function getAdminSettingsQueryOptions() {
  return orpc.admin.settings.get.queryOptions();
}

export function useGetAdminSettingsQuery() {
  return useQuery(getAdminSettingsQueryOptions());
}

export type AdminSettingsQueryResult = Awaited<ReturnType<typeof client.admin.settings.get>>;
