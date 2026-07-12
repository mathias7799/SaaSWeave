import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type CreateApiKeyInput = Parameters<typeof orpcClient.console.apiKeys.create>[0];
export type CreateApiKeyMutationResult = Awaited<ReturnType<typeof client.console.apiKeys.create>>;

export function createApiKeyMutationOptions(
  options?: UseMutationOptions<CreateApiKeyMutationResult, Error, CreateApiKeyInput>
) {
  return {
    mutationFn: (input: CreateApiKeyInput) => orpcClient.console.apiKeys.create(input),
    ...options
  };
}

export function useCreateApiKeyMutation(
  options?: UseMutationOptions<CreateApiKeyMutationResult, Error, CreateApiKeyInput>
) {
  return useMutation(createApiKeyMutationOptions(options));
}
