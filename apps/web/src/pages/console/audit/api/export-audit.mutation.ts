import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type ExportAuditInput = Parameters<typeof orpcClient.console.auditExport.export>[0];
export type ExportAuditMutationResult = Awaited<
  ReturnType<typeof client.console.auditExport.export>
>;

export function exportAuditMutationOptions(
  options?: UseMutationOptions<ExportAuditMutationResult, Error, ExportAuditInput>
) {
  return {
    mutationFn: (input: ExportAuditInput) => orpcClient.console.auditExport.export(input),
    ...options
  };
}

export function useExportAuditMutation(
  options?: UseMutationOptions<ExportAuditMutationResult, Error, ExportAuditInput>
) {
  return useMutation(exportAuditMutationOptions(options));
}
