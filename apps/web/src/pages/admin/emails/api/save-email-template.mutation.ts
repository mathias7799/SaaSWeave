import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type SaveEmailTemplateInput = Parameters<typeof orpcClient.admin.emails.save>[0];
export type SaveEmailTemplateMutationResult = Awaited<ReturnType<typeof client.admin.emails.save>>;

export function saveEmailTemplateMutationOptions(
  options?: UseMutationOptions<SaveEmailTemplateMutationResult, Error, SaveEmailTemplateInput>
) {
  return {
    mutationFn: (input: SaveEmailTemplateInput) => orpcClient.admin.emails.save(input),
    ...options
  };
}

export function useSaveEmailTemplateMutation(
  options?: UseMutationOptions<SaveEmailTemplateMutationResult, Error, SaveEmailTemplateInput>
) {
  return useMutation(saveEmailTemplateMutationOptions(options));
}
