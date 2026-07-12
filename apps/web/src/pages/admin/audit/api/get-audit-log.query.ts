import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getAuditLogQueryOptions() {
  return orpc.admin.auditLog.queryOptions();
}

export function useGetAuditLogQuery() {
  return useQuery(getAuditLogQueryOptions());
}

export type AuditLogQueryResult = Awaited<ReturnType<typeof client.admin.auditLog>>;
