import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export const workspaceDetailQueryKeys = {
  byId(id: string) {
    return orpc.admin.workspaces.detail.queryKey({ input: { id } });
  }
};

export function getWorkspaceDetailQueryOptions(id: string) {
  return orpc.admin.workspaces.detail.queryOptions({ input: { id } });
}

export function useGetWorkspaceDetailQuery(id: string) {
  return useQuery(getWorkspaceDetailQueryOptions(id));
}

export type WorkspaceDetailQueryResult = Awaited<ReturnType<typeof client.admin.workspaces.detail>>;
