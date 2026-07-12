import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { getAuthStateQueryOptions } from "#@/react/tanstack-start/queries";

export function useAuth() {
  const { data, isPending } = useQuery(getAuthStateQueryOptions());
  return {
    impersonatedBy: data?.impersonatedBy ?? null,
    isPending,
    user: data?.user ?? null
  };
}

export function useAuthSuspense() {
  const { data } = useSuspenseQuery(getAuthStateQueryOptions());
  return {
    impersonatedBy: data.impersonatedBy,
    user: data.user
  };
}
