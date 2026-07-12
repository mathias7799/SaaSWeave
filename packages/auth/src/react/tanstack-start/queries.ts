import { type QueryClient, queryOptions } from "@tanstack/react-query";

import { $getAuthState } from "#@/react/tanstack-start/functions";

export const authQueryKeys = {
  state: ["auth", "state"] as const
};

export function getAuthStateQueryOptions() {
  return queryOptions({
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    refetchOnMount: false,
    queryKey: authQueryKeys.state,
    queryFn: ({ signal }) => $getAuthState({ signal }),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000)
  });
}

export function getAuthUserQueryOptions() {
  return queryOptions({
    ...getAuthStateQueryOptions(),
    select: (state) => state.user
  });
}

/**
 * Load auth state in route `beforeLoad` guards.
 *
 * Always use {@link getAuthStateQueryOptions} here — not {@link getAuthUserQueryOptions}.
 * `ensureQueryData` returns raw queryFn data; with `select`, the result is still the full
 * state object, so a null user would look "logged in".
 */
export async function ensureAuthState(
  queryClient: QueryClient,
  options?: { preload?: boolean }
): Promise<AuthQueryResult> {
  return queryClient.ensureQueryData(
    options?.preload
      ? getAuthStateQueryOptions()
      : { ...getAuthStateQueryOptions(), revalidateIfStale: true }
  );
}

export type AuthQueryResult = Awaited<ReturnType<typeof $getAuthState>>;
export type AuthUserQueryResult = AuthQueryResult["user"];
