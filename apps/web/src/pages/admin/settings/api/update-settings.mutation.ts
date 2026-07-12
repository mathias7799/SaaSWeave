import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type UpdateSettingsInput = Parameters<typeof orpcClient.admin.settings.update>[0];
export type UpdateSettingsMutationResult = Awaited<ReturnType<typeof client.admin.settings.update>>;

export function updateSettingsMutationOptions(
  options?: UseMutationOptions<UpdateSettingsMutationResult, Error, UpdateSettingsInput>
) {
  return {
    mutationFn: (input: UpdateSettingsInput) => orpcClient.admin.settings.update(input),
    ...options
  };
}

export function useUpdateSettingsMutation(
  options?: UseMutationOptions<UpdateSettingsMutationResult, Error, UpdateSettingsInput>
) {
  return useMutation(updateSettingsMutationOptions(options));
}
