import { useQuery } from "@tanstack/react-query";

import { type client, orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function getConsoleAuditLogQueryOptions() {
  return orpc.console.auditLog.queryOptions();
}

export function useGetConsoleAuditLogQuery() {
  return useQuery(getConsoleAuditLogQueryOptions());
}

export type ConsoleAuditLogQueryResult = Awaited<ReturnType<typeof client.console.auditLog>>;
