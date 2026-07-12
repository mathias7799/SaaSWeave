import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

export type RequestDataExportMutationResult = Awaited<
  ReturnType<typeof client.console.dataExport.request>
>;

export function requestDataExportMutationOptions(
  options?: UseMutationOptions<RequestDataExportMutationResult, Error, void>
) {
  return {
    mutationFn: () => orpcClient.console.dataExport.request(),
    ...options
  };
}

export function useRequestDataExportMutation(
  options?: UseMutationOptions<RequestDataExportMutationResult, Error, void>
) {
  return useMutation(requestDataExportMutationOptions(options));
}
