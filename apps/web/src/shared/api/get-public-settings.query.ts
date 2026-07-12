import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const publicSettingsQueryKeys = {
  all() {
    return orpc.platform.settings.queryKey();
  }
};

export function getPublicSettingsQueryOptions() {
  return orpc.platform.settings.queryOptions();
}

export function useGetPublicSettingsQuery() {
  return useQuery(getPublicSettingsQueryOptions());
}

export type PublicSettingsQueryResult = Awaited<ReturnType<typeof client.platform.settings>>;
