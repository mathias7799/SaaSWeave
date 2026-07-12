import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type UpdateWorkspacePlanInput = Parameters<typeof orpcClient.admin.workspaces.updatePlan>[0];
export type UpdateWorkspacePlanMutationResult = Awaited<
  ReturnType<typeof client.admin.workspaces.updatePlan>
>;

export function updateWorkspacePlanMutationOptions(
  options?: UseMutationOptions<UpdateWorkspacePlanMutationResult, Error, UpdateWorkspacePlanInput>
) {
  return {
    mutationFn: (input: UpdateWorkspacePlanInput) => orpcClient.admin.workspaces.updatePlan(input),
    ...options
  };
}

export function useUpdateWorkspacePlanMutation(
  options?: UseMutationOptions<UpdateWorkspacePlanMutationResult, Error, UpdateWorkspacePlanInput>
) {
  return useMutation(updateWorkspacePlanMutationOptions(options));
}
