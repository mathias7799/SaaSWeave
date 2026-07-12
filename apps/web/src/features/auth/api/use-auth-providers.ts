import { useQuery } from "@tanstack/react-query";

import { getAuthProvidersQueryOptions } from "@/features/auth/api/auth-providers.query";

export function useAuthProviders() {
  return useQuery(getAuthProvidersQueryOptions());
}
