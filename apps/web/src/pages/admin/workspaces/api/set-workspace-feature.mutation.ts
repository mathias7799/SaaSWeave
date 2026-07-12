import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type SetWorkspaceFeatureInput = Parameters<typeof orpcClient.admin.features.setForOrganization>[0];
export type SetWorkspaceFeatureMutationResult = Awaited<
  ReturnType<typeof client.admin.features.setForOrganization>
>;

export function setWorkspaceFeatureMutationOptions(
  options?: UseMutationOptions<SetWorkspaceFeatureMutationResult, Error, SetWorkspaceFeatureInput>
) {
  return {
    mutationFn: (input: SetWorkspaceFeatureInput) =>
      orpcClient.admin.features.setForOrganization(input),
    ...options
  };
}

export function useSetWorkspaceFeatureMutation(
  options?: UseMutationOptions<SetWorkspaceFeatureMutationResult, Error, SetWorkspaceFeatureInput>
) {
  return useMutation(setWorkspaceFeatureMutationOptions(options));
}
