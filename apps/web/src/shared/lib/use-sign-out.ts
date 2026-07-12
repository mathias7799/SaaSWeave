import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { authClient } from "@saasweave/auth/react/auth-client";
import { authQueryKeys } from "@saasweave/auth/react/tanstack-start/queries";

export function useSignOut(onSignedOut?: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useCallback(async () => {
    await authClient.signOut({
      fetchOptions: {
        onResponse: async () => {
          queryClient.removeQueries({ queryKey: authQueryKeys.state });
          await router.invalidate();
          await onSignedOut?.();
        }
      }
    });
  }, [onSignedOut, queryClient, router]);
}
