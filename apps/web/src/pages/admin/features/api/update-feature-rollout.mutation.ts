import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type UpdateFeatureRolloutInput = Parameters<typeof orpcClient.admin.features.updateRollout>[0];
export type UpdateFeatureRolloutMutationResult = Awaited<
  ReturnType<typeof client.admin.features.updateRollout>
>;

export function updateFeatureRolloutMutationOptions(
  options?: UseMutationOptions<UpdateFeatureRolloutMutationResult, Error, UpdateFeatureRolloutInput>
) {
  return {
    mutationFn: (input: UpdateFeatureRolloutInput) =>
      orpcClient.admin.features.updateRollout(input),
    ...options
  };
}

export function useUpdateFeatureRolloutMutation(
  options?: UseMutationOptions<UpdateFeatureRolloutMutationResult, Error, UpdateFeatureRolloutInput>
) {
  return useMutation(updateFeatureRolloutMutationOptions(options));
}
