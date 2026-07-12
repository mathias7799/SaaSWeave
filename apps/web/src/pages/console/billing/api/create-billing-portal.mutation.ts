import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { type client } from "@saasweave/api/client/tanstack-start/orpc";
import { client as orpcClient } from "@saasweave/api/client/tanstack-start/orpc";

export type CreateBillingPortalMutationResult = Awaited<
  ReturnType<typeof client.console.billingPortal>
>;

export function createBillingPortalMutationOptions(
  options?: UseMutationOptions<CreateBillingPortalMutationResult, Error, void>
) {
  return {
    mutationFn: () => orpcClient.console.billingPortal(),
    ...options
  };
}

export function useCreateBillingPortalMutation(
  options?: UseMutationOptions<CreateBillingPortalMutationResult, Error, void>
) {
  return useMutation(createBillingPortalMutationOptions(options));
}
