import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getWorkspacesQueryOptions() {
  return orpc.admin.workspaces.list.queryOptions({ input: {} });
}

export function useGetWorkspacesQuery() {
  return useQuery(getWorkspacesQueryOptions());
}

export type WorkspacesQueryResult = Awaited<ReturnType<typeof client.admin.workspaces.list>>;
