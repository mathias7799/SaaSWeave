import { type InferClientErrors } from "@orpc/client";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type RemovePlanInput = Parameters<typeof orpcClient.admin.plans.remove>[0];
export type RemovePlanMutationResult = Awaited<ReturnType<typeof client.admin.plans.remove>>;
export type RemovePlanMutationError = InferClientErrors<typeof orpcClient.admin.plans.remove>;

export function removePlanMutationOptions(
  options?: UseMutationOptions<RemovePlanMutationResult, RemovePlanMutationError, RemovePlanInput>
) {
  return {
    mutationFn: (input: RemovePlanInput) => orpcClient.admin.plans.remove(input),
    ...options
  };
}

export function useRemovePlanMutation(
  options?: UseMutationOptions<RemovePlanMutationResult, RemovePlanMutationError, RemovePlanInput>
) {
  return useMutation(removePlanMutationOptions(options));
}
