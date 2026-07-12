import { type InferClientErrors } from "@orpc/client";
import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type CreatePlanInput = Parameters<typeof orpcClient.admin.plans.create>[0];
export type CreatePlanMutationResult = Awaited<ReturnType<typeof client.admin.plans.create>>;
export type CreatePlanMutationError = InferClientErrors<typeof orpcClient.admin.plans.create>;

export function createPlanMutationOptions(
  options?: UseMutationOptions<CreatePlanMutationResult, CreatePlanMutationError, CreatePlanInput>
) {
  return {
    mutationFn: (input: CreatePlanInput) => orpcClient.admin.plans.create(input),
    ...options
  };
}

export function useCreatePlanMutation(
  options?: UseMutationOptions<CreatePlanMutationResult, CreatePlanMutationError, CreatePlanInput>
) {
  return useMutation(createPlanMutationOptions(options));
}
