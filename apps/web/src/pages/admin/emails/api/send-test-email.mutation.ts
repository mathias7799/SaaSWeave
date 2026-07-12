import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { client as orpcClient, type client } from "@saasweave/api/client/tanstack-start/orpc";

type SendTestEmailInput = Parameters<typeof orpcClient.admin.emails.sendTest>[0];
export type SendTestEmailMutationResult = Awaited<ReturnType<typeof client.admin.emails.sendTest>>;

export function sendTestEmailMutationOptions(
  options?: UseMutationOptions<SendTestEmailMutationResult, Error, SendTestEmailInput>
) {
  return {
    mutationFn: (input: SendTestEmailInput) => orpcClient.admin.emails.sendTest(input),
    ...options
  };
}

export function useSendTestEmailMutation(
  options?: UseMutationOptions<SendTestEmailMutationResult, Error, SendTestEmailInput>
) {
  return useMutation(sendTestEmailMutationOptions(options));
}
