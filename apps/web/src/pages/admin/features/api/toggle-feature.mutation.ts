import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type ToggleFeatureInput = Parameters<typeof orpcClient.admin.features.toggleGlobal>[0];
export type ToggleFeatureMutationResult = Awaited<
  ReturnType<typeof client.admin.features.toggleGlobal>
>;

export function toggleFeatureMutationOptions(
  options?: UseMutationOptions<ToggleFeatureMutationResult, Error, ToggleFeatureInput>
) {
  return {
    mutationFn: (input: ToggleFeatureInput) => orpcClient.admin.features.toggleGlobal(input),
    ...options
  };
}

export function useToggleFeatureMutation(
  options?: UseMutationOptions<ToggleFeatureMutationResult, Error, ToggleFeatureInput>
) {
  return useMutation(toggleFeatureMutationOptions(options));
}
