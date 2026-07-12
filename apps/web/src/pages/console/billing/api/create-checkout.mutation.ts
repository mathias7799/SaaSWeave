import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { type client } from "@saasweave/api/client/tanstack-start/orpc";
import { client as orpcClient } from "@saasweave/api/client/tanstack-start/orpc";

type CheckoutInput = Parameters<typeof orpcClient.console.checkout>[0];
export type CreateCheckoutMutationResult = Awaited<ReturnType<typeof client.console.checkout>>;

export function createCheckoutMutationOptions(
  options?: UseMutationOptions<CreateCheckoutMutationResult, Error, CheckoutInput>
) {
  return {
    mutationFn: (input: CheckoutInput) => orpcClient.console.checkout(input),
    ...options
  };
}

export function useCreateCheckoutMutation(
  options?: UseMutationOptions<CreateCheckoutMutationResult, Error, CheckoutInput>
) {
  return useMutation(createCheckoutMutationOptions(options));
}
