import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type UpdatePlanInput = Parameters<typeof orpcClient.admin.plans.update>[0];
export type UpdatePlanMutationResult = Awaited<ReturnType<typeof client.admin.plans.update>>;

export function updatePlanMutationOptions(
  options?: UseMutationOptions<UpdatePlanMutationResult, Error, UpdatePlanInput>
) {
  return {
    mutationFn: (input: UpdatePlanInput) => orpcClient.admin.plans.update(input),
    ...options
  };
}

export function useUpdatePlanMutation(
  options?: UseMutationOptions<UpdatePlanMutationResult, Error, UpdatePlanInput>
) {
  return useMutation(updatePlanMutationOptions(options));
}
