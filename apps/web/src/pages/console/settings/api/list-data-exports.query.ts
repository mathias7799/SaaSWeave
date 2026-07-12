import { useQuery } from "@tanstack/react-query";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";

export function useListDataExportsQuery() {
  return useQuery(orpc.console.dataExport.list.queryOptions());
}
