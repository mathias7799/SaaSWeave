import { type InferClientErrors } from "@orpc/client";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type RevokeApiKeyInput = Parameters<typeof orpcClient.console.apiKeys.revoke>[0];
export type RevokeApiKeyMutationResult = Awaited<ReturnType<typeof client.console.apiKeys.revoke>>;
export type RevokeApiKeyMutationError = InferClientErrors<typeof orpcClient.console.apiKeys.revoke>;

export function revokeApiKeyMutationOptions(
  options?: UseMutationOptions<
    RevokeApiKeyMutationResult,
    RevokeApiKeyMutationError,
    RevokeApiKeyInput
  >
) {
  return {
    mutationFn: (input: RevokeApiKeyInput) => orpcClient.console.apiKeys.revoke(input),
    ...options
  };
}

export function useRevokeApiKeyMutation(
  options?: UseMutationOptions<
    RevokeApiKeyMutationResult,
    RevokeApiKeyMutationError,
    RevokeApiKeyInput
  >
) {
  return useMutation(revokeApiKeyMutationOptions(options));
}
